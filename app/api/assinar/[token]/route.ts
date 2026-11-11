import { NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { getSql } from "@/lib/db"
import { garantirTabelaAssinaturasOs } from "@/lib/migracoes"
import { gerarPdfOsServidor } from "@/lib/pdf-os-servidor"
import { formatarNumeroOrcamento } from "@/lib/orcamento-pdf"
import { enviarDocumentoWhatsapp } from "@/lib/evolution-api"
import { registrarMensagemBot } from "@/lib/bot-registro"
import type { Orcamento } from "@/lib/types"

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
  const clienteRows = await sql`SELECT nome, telefone FROM clientes WHERE id = ${r.cliente_id} LIMIT 1`
  const clienteNome = (clienteRows[0]?.nome as string) ?? "Cliente"

  return NextResponse.json({
    assinado: !!reg.assinado_em,
    assinadoEm: reg.assinado_em ?? null,
    pdfUrl: reg.pdf_url ?? null,
    orcamentoNumero: r.numero,
    orcamentoCriadoEm: r.criado_em,
    clienteNome,
    totalFechado: r.total_fechado ? Number(r.total_fechado) : null,
  })
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  await garantirTabelaAssinaturasOs()

  const { assinaturaData } = await req.json()
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
    SET assinado_em = ${agora}, assinatura_data = ${assinaturaData}, ip_assinante = ${ip}
    WHERE id = ${token}
  `

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

    const clienteRows = await sql`SELECT nome, telefone FROM clientes WHERE id = ${r.cliente_id} LIMIT 1`
    const clienteNome = (clienteRows[0]?.nome as string) ?? "Cliente"
    const clienteTelefone = (clienteRows[0]?.telefone as string) ?? undefined

    try {
      const pdf = await gerarPdfOsServidor(orcamento, clienteNome, clienteTelefone, assinaturaData)
      const nomeArquivo = `OS-${formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)}-assinada.pdf`

      // Salva o PDF no Vercel Blob para ficar acessível no sistema (se configurado)
      try {
        const blob = await put(`os-assinadas/${nomeArquivo}`, pdf, {
          access: "public",
          contentType: "application/pdf",
        })
        await sql`UPDATE assinaturas_os SET pdf_url = ${blob.url} WHERE id = ${token}`
      } catch (errBlob) {
        console.warn("[assinar] upload do blob falhou ou token não configurado:", errBlob)
      }

      const numeroEmpresa = process.env.WHATSAPP_EMPRESA_NUMERO
      if (numeroEmpresa) {
        await enviarDocumentoWhatsapp(
          numeroEmpresa,
          pdf.toString("base64"),
          nomeArquivo,
          `✅ ${clienteNome} assinou a OS nº ${formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)}!`
        )
      }

      // Envia cópia do contrato de serviço assinado para o cliente
      if (clienteTelefone) {
        const nomeExibido = clienteNome.split(" ")[0]
        const mensagemContrato = `Olá${nomeExibido ? `, ${nomeExibido}` : ""}! 🎉 Obrigado por assinar a Ordem de Serviço!\n\n📄 Segue em anexo o seu *Contrato de Prestação de Serviço assinado digitalmente* para você guardar.\n\nO seu pedido já foi aprovado e encaminhado para a produção! Qualquer dúvida estamos à disposição. 😊`

        await enviarDocumentoWhatsapp(
          clienteTelefone,
          pdf.toString("base64"),
          nomeArquivo,
          mensagemContrato
        )

        await registrarMensagemBot({
          clienteId: r.cliente_id ?? null,
          clienteNome,
          telefone: clienteTelefone,
          texto: `📄 Contrato de serviço assinado enviado ao cliente: ${nomeArquivo}`,
          origem: "automatica",
          autor: "bot",
        })
      }
    } catch (errPdf) {
      console.error("[assinar] falha ao gerar/enviar contrato de serviço:", errPdf)
    }
  }

  return NextResponse.json({ ok: true })
}
