import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { enviarDocumentoWhatsapp } from "@/lib/evolution-api"
import { gerarPdfContratoServidor } from "@/lib/pdf-contrato-servidor"
import { formatarNumeroOrcamento } from "@/lib/orcamento-pdf"
import { registrarMensagemBot } from "@/lib/bot-registro"
import type { Orcamento } from "@/lib/types"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { orcamentoId, numero, telefone } = body

    if (!orcamentoId && !numero) {
      return NextResponse.json({ erro: "orcamentoId ou numero obrigatório" }, { status: 400 })
    }

    const sql = getSql()
    let rows: any[] = []
    if (orcamentoId) {
      const semPrefixo = orcamentoId.startsWith("orc-") ? orcamentoId.slice(4) : orcamentoId
      const comPrefixo = orcamentoId.startsWith("orc-") ? orcamentoId : `orc-${orcamentoId}`
      rows = await sql`
        SELECT * FROM orcamentos 
        WHERE id = ${orcamentoId} OR id = ${comPrefixo} OR id = ${semPrefixo} 
        LIMIT 1
      `
    } else {
      rows = await sql`SELECT * FROM orcamentos WHERE numero = ${Number(numero)} LIMIT 1`
    }

    if (rows.length === 0) {
      return NextResponse.json({ erro: "Orçamento não encontrado" }, { status: 404 })
    }

    const r = rows[0]
    const orcamento: Orcamento = {
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
      validadeDias: r.validade_dias ?? undefined,
    }

    const clienteRows = await sql`SELECT nome, telefone, cpf, email FROM clientes WHERE id = ${r.cliente_id} LIMIT 1`
    const cliente = clienteRows[0]
    if (!cliente) {
      return NextResponse.json({ erro: "Cliente não encontrado" }, { status: 404 })
    }

    const assinaturas = await sql`SELECT * FROM assinaturas_os WHERE orcamento_id = ${r.id} ORDER BY assinado_em DESC LIMIT 1`
    const assinatura = assinaturas[0]
    if (!assinatura) {
      return NextResponse.json({ erro: "Nenhuma assinatura encontrada para esta OS" }, { status: 404 })
    }

    const destinoTelefone = (telefone || cliente.telefone) as string
    if (!destinoTelefone) {
      return NextResponse.json({ erro: "Telefone do cliente não cadastrado" }, { status: 400 })
    }

    const numeroFormatado = formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)
    const nomeArquivoContrato = `Contrato-CTR-${numeroFormatado}-assinado.pdf`

    const pdfContrato = await gerarPdfContratoServidor(
      orcamento,
      cliente.nome,
      destinoTelefone,
      cliente.cpf,
      cliente.email,
      assinatura.assinatura_data,
      assinatura.assinado_em as string
    )

    const nomeExibido = (cliente.nome as string).split(" ")[0]
    const mensagemContrato = `Olá${nomeExibido ? `, ${nomeExibido}` : ""}! 🎉 Obrigado por assinar a Ordem de Serviço!\n\n📄 Segue em anexo o seu *Contrato de Prestação de Serviços assinado digitalmente* para você guardar.\n\nO seu pedido já foi aprovado e encaminhado para a produção! Qualquer dúvida estamos à disposição. 😊`

    const envio = await enviarDocumentoWhatsapp(
      destinoTelefone,
      pdfContrato.toString("base64"),
      nomeArquivoContrato,
      mensagemContrato
    )

    await registrarMensagemBot({
      clienteId: r.cliente_id,
      clienteNome: cliente.nome,
      telefone: destinoTelefone,
      texto: `📄 Contrato de serviço assinado reenviado diretamente ao cliente: ${nomeArquivoContrato}`,
      origem: "automatica",
      autor: "bot",
    })

    return NextResponse.json({
      ok: true,
      enviadoPara: destinoTelefone,
      cliente: cliente.nome,
      numero: orcamento.numero,
      envio,
    })
  } catch (err: any) {
    console.error("[reenviar-contrato] erro:", err)
    return NextResponse.json({ erro: err?.message || String(err) }, { status: 500 })
  }
}
