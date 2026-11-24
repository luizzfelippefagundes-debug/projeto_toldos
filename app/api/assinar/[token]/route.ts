import { NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { getSql } from "@/lib/db"
import { garantirTabelaAssinaturasOs } from "@/lib/migracoes"
import { gerarPdfOsServidor } from "@/lib/pdf-os-servidor"
import { gerarPdfContratoServidor } from "@/lib/pdf-contrato-servidor"
import { formatarNumeroOrcamento } from "@/lib/orcamento-pdf"
import { enviarDocumentoWhatsapp } from "@/lib/evolution-api"
import { registrarMensagemBot } from "@/lib/bot-registro"
import type { Orcamento } from "@/lib/types"
import { notificarNovaDemandaOrcamento } from "@/lib/notificacoes-producao"

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  await garantirTabelaAssinaturasOs()

  const sql = getSql()
  const rows = await sql`SELECT * FROM assinaturas_os WHERE id = ${token} LIMIT 1`
  if (rows.length === 0) {
    return NextResponse.json({ erro: "Link inválido" }, { status: 404 })
  }

  const reg = rows[0]
  if (new Date(reg.expira_em) < new Date()) {
    return NextResponse.json({ erro: "Link expirado" }, { status: 410 })
  }

  const orcRows = await sql`SELECT * FROM orcamentos WHERE id = ${reg.orcamento_id} LIMIT 1`
  if (orcRows.length === 0) {
    return NextResponse.json({ erro: "Orçamento não encontrado" }, { status: 404 })
  }

  const r = orcRows[0]
  const clienteRows = await sql`SELECT nome, telefone, cpf FROM clientes WHERE id = ${r.cliente_id} LIMIT 1`
  const clienteNome = (clienteRows[0]?.nome as string) ?? "Cliente"
  const clienteCpf = (clienteRows[0]?.cpf as string) ?? null

  return NextResponse.json({
    assinado: !!reg.assinado_em,
    assinadoEm: reg.assinado_em ?? null,
    pdfUrl: reg.pdf_url ?? null,
    orcamentoId: reg.orcamento_id,
    orcamentoNumero: r.numero,
    orcamentoCriadoEm: r.criado_em,
    clienteNome,
    clienteCpf,
    totalFechado: r.total_fechado ? Number(r.total_fechado) : null,
  })
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  await garantirTabelaAssinaturasOs()

  const { assinaturaData, documentoIdentificacao } = await req.json()
  if (!assinaturaData) {
    return NextResponse.json({ erro: "assinaturaData obrigatório" }, { status: 400 })
  }

  const sql = getSql()
  const rows = await sql`SELECT * FROM assinaturas_os WHERE id = ${token} LIMIT 1`
  if (rows.length === 0) {
    return NextResponse.json({ erro: "Link inválido" }, { status: 404 })
  }

  const reg = rows[0]
  if (new Date(reg.expira_em) < new Date()) {
    return NextResponse.json({ erro: "Link expirado" }, { status: 410 })
  }
  if (reg.assinado_em) {
    return NextResponse.json({ erro: "Documento já assinado" }, { status: 409 })
  }

  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? ""
  const agora = new Date().toISOString()

  await sql`
    UPDATE assinaturas_os
    SET assinado_em = ${agora}, assinatura_data = ${assinaturaData}, ip_assinante = ${ip}, documento_assinante = ${documentoIdentificacao || null}
    WHERE id = ${token}
  `

  // Atualiza o CPF/CNPJ do cliente se foi fornecido na assinatura
  if (documentoIdentificacao && reg.orcamento_id) {
    const oRows = await sql`SELECT cliente_id FROM orcamentos WHERE id = ${reg.orcamento_id} LIMIT 1`
    if (oRows.length > 0 && oRows[0].cliente_id) {
      await sql`
        UPDATE clientes
        SET cpf = ${documentoIdentificacao}
        WHERE id = ${oRows[0].cliente_id}
      `
    }
  }

  // Cliente assinou → entra na produção agora
  await sql`
    UPDATE orcamentos
    SET status_producao = 'aprovado'
    WHERE id = ${reg.orcamento_id} AND (status_producao IS NULL OR status_producao = 'aguardando')
  `

  // Gera PDF com assinatura do cliente e envia para a empresa no WhatsApp
  const orcRows = await sql`SELECT * FROM orcamentos WHERE id = ${reg.orcamento_id} LIMIT 1`
  if (orcRows.length > 0) {
    const r = orcRows[0]
    const orcamento = {
      id: r.id,
      numero: r.numero,
      clienteId: r.cliente_id,
      item: r.item,
      materialFechado: r.material_fechado,
      servicoFechado: r.servico_fechado,
      totalFechado: r.total_fechado ? Number(r.total_fechado) : undefined,
      ajusteManual: Number(r.ajuste_manual ?? 0),
      anexoNome: r.anexo_nome,
      status: r.status,
      criadoEm: r.criado_em,
      fechadoEm: r.fechado_em,
    } as Orcamento

    const clienteRows = await sql`SELECT nome, telefone, cpf, email FROM clientes WHERE id = ${r.cliente_id} LIMIT 1`
    const clienteNome = (clienteRows[0]?.nome as string) ?? "Cliente"
    const clienteTelefone = (clienteRows[0]?.telefone as string) ?? undefined
    const clienteCpf = (clienteRows[0]?.cpf as string) ?? undefined
    const clienteEmail = (clienteRows[0]?.email as string) ?? undefined

    try {
      const numeroFormatado = formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)
      const pdf = await gerarPdfOsServidor(orcamento, clienteNome, clienteTelefone, assinaturaData)
      const nomeArquivo = `OS-${numeroFormatado}-assinada.pdf`

      // Gera o Contrato Oficial de Prestação de Serviços assinado
      let pdfContrato: Buffer | null = null
      const nomeArquivoContrato = `Contrato-CTR-${numeroFormatado}-assinado.pdf`
      try {
        pdfContrato = await gerarPdfContratoServidor(
          orcamento,
          clienteNome,
          clienteTelefone,
          clienteCpf,
          clienteEmail,
          assinaturaData,
          agora
        )
      } catch (errContrato) {
        console.error("[assinar] falha ao gerar pdf do contrato:", errContrato)
      }

      // Salva o PDF no Vercel Blob para ficar acessível no sistema (se configurado)
      try {
        const blob = await put(`os-assinadas/${nomeArquivo}`, pdf, {
          access: "public",
          contentType: "application/pdf",
          addRandomSuffix: false,
          allowOverwrite: true,
        })
        await sql`UPDATE assinaturas_os SET pdf_url = ${blob.url} WHERE id = ${token}`

        if (pdfContrato) {
          await put(`contratos-assinados/${nomeArquivoContrato}`, pdfContrato, {
            access: "public",
            contentType: "application/pdf",
            addRandomSuffix: false,
            allowOverwrite: true,
          })
        }
      } catch (errBlob) {
        console.warn("[assinar] upload do blob falhou ou token não configurado:", errBlob)
      }

      const numeroEmpresa = process.env.WHATSAPP_EMPRESA_NUMERO
      if (numeroEmpresa) {
        await enviarDocumentoWhatsapp(
          numeroEmpresa,
          (pdfContrato || pdf).toString("base64"),
          pdfContrato ? nomeArquivoContrato : nomeArquivo,
          `✅ ${clienteNome} assinou o Contrato e a OS nº ${numeroFormatado}!`
        )
      }

      // Envia cópia do contrato de serviço assinado para o cliente
      if (clienteTelefone) {
        const nomeExibido = clienteNome.split(" ")[0]
        const mensagemContrato = `Olá${nomeExibido ? `, ${nomeExibido}` : ""}! 🎉 Obrigado por assinar a Ordem de Serviço!\n\n📄 Segue em anexo o seu *Contrato de Prestação de Serviços assinado digitalmente* para você guardar.\n\nO seu pedido já foi aprovado e encaminhado para a produção! Qualquer dúvida estamos à disposição. 😊`

        // Envia o Contrato oficial em anexo
        await enviarDocumentoWhatsapp(
          clienteTelefone,
          (pdfContrato || pdf).toString("base64"),
          pdfContrato ? nomeArquivoContrato : nomeArquivo,
          mensagemContrato
        )

        await registrarMensagemBot({
          clienteId: r.cliente_id ?? null,
          clienteNome,
          telefone: clienteTelefone,
          texto: `📄 Contrato de serviço assinado enviado ao cliente: ${pdfContrato ? nomeArquivoContrato : nomeArquivo}`,
          origem: "automatica",
          autor: "bot",
        })
      }
      // Notifica a equipe de produção (Colaboradores) no WhatsApp
      notificarNovaDemandaOrcamento({
        numero: orcamento.numero,
        clienteNome,
        material: orcamento.materialFechado || (orcamento.item as any)?.materialNome || null,
        servico: orcamento.servicoFechado || (orcamento.item as any)?.servicoNome || null,
        dimensoes: (orcamento.item as any)?.largura && (orcamento.item as any)?.altura
          ? `${(orcamento.item as any).largura}m x ${(orcamento.item as any).altura}m`
          : null,
      }).catch((err) =>
        console.error("[assinar] falha ao notificar equipe de producao:", err)
      )
    } catch (errPdf) {
      console.error("[assinar] falha ao gerar/enviar contrato de serviço:", errPdf)
    }
  }

  return NextResponse.json({ ok: true })
}
