import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { enviarDocumentoWhatsapp } from "@/lib/evolution-api"
import { gerarPdfReciboServidor, type DadosReciboServidor } from "@/lib/pdf-recibo-servidor"
import { formatarMoeda } from "@/lib/format"
import { formatarNumeroOrcamento } from "@/lib/orcamento-pdf"
import { registrarMensagemBot } from "@/lib/bot-registro"

const rotuloForma: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  boleto: "Boleto",
  transferencia: "Transferência",
}

export async function POST(req: Request) {
  try {
    const { lancamentoId, telefone } = await req.json()
    if (!lancamentoId) {
      return NextResponse.json({ erro: "lancamentoId obrigatório" }, { status: 400 })
    }

    const sql = getSql()
    const rows = await sql`SELECT * FROM lancamentos_financeiros WHERE id = ${lancamentoId} LIMIT 1`
    if (rows.length === 0) {
      return NextResponse.json({ erro: "Lançamento não encontrado" }, { status: 404 })
    }

    const lancamento = rows[0]
    if (lancamento.status !== "pago") {
      return NextResponse.json({ erro: "Lançamento ainda não foi pago" }, { status: 400 })
    }

    let clienteNome = "Cliente"
    let clienteTelefone = telefone
    let clienteId = lancamento.cliente_id

    if (clienteId) {
      const cRows = await sql`SELECT nome, telefone FROM clientes WHERE id = ${clienteId} LIMIT 1`
      if (cRows.length > 0) {
        clienteNome = cRows[0].nome ?? "Cliente"
        if (!clienteTelefone) clienteTelefone = cRows[0].telefone
      }
    }

    if (!clienteTelefone) {
      return NextResponse.json({ erro: "Telefone do destinatário não informado" }, { status: 400 })
    }

    // Identifica se é parte de um orçamento para calcular número oficial e saldo
    let numeroOrcamento: string | null = null
    let sufixo = "REC"
    let resumo: DadosReciboServidor["resumo"]
    let referente = lancamento.descricao || "serviços prestados"

    const orcamentoId = lancamento.origem_id || lancamento.orcamento_id
    if (orcamentoId) {
      const oRows = await sql`SELECT numero, criado_em, total_fechado FROM orcamentos WHERE id = ${orcamentoId} LIMIT 1`
      if (oRows.length > 0) {
        const orc = oRows[0]
        numeroOrcamento = formatarNumeroOrcamento(orc.numero, orc.criado_em)

        // Busca todas as parcelas desse orçamento para calcular o saldo
        const irmaos = await sql`SELECT * FROM lancamentos_financeiros WHERE origem_id = ${orcamentoId} ORDER BY vencimento ASC`
        const ordenados = [...irmaos]
        const indice = ordenados.findIndex((l) => l.id === lancamento.id)
        sufixo = indice === 0 ? "ENTRADA" : indice > 0 ? `PARC-${indice}` : "REC"

        if (sufixo === "ENTRADA") {
          referente = `entrada do orçamento nº ${numeroOrcamento}`
        } else if (sufixo.startsWith("PARC-")) {
          referente = `parcela do orçamento nº ${numeroOrcamento}`
        } else {
          referente = `pagamento do orçamento nº ${numeroOrcamento}`
        }

        const totalOrcamento = Number(orc.total_fechado ?? 0)
        const totalPago = irmaos
          .filter((l) => l.status === "pago")
          .reduce((acc, l) => acc + Number(l.valor), 0)
        const saldo = Math.max(0, totalOrcamento - totalPago)
        const pendente = irmaos.find((l) => l.status !== "pago")

        resumo = {
          totalOrcamento,
          totalPago,
          saldo,
          vencimentoSaldo: pendente?.vencimento ? String(pendente.vencimento) : undefined,
        }
      }
    }

    const numeroRecibo = numeroOrcamento ? `${numeroOrcamento}/${sufixo}` : String(lancamento.id).slice(-6).toUpperCase()

    const dadosRecibo: DadosReciboServidor = {
      numero: numeroRecibo,
      clienteNome,
      valor: Number(lancamento.valor),
      referente,
      formaPagamento: lancamento.forma_pagamento ? rotuloForma[lancamento.forma_pagamento] : undefined,
      pagoEm: String(lancamento.pago_em || lancamento.criado_em),
      resumo,
    }

    const pdfBuffer = await gerarPdfReciboServidor(dadosRecibo, new Date())
    const nomeArquivo = `Recibo-${numeroRecibo.replace(/\//g, "-")}.pdf`

    const mensagem =
      `Olá${clienteNome ? `, ${clienteNome.split(" ")[0]}` : ""}! Recebemos seu pagamento de ${formatarMoeda(dadosRecibo.valor)} ` +
      `(${referente}). Segue o recibo oficial em anexo. ` +
      (resumo && resumo.saldo > 0 ? `Saldo restante: ${formatarMoeda(resumo.saldo)}. ` : resumo ? "Orçamento quitado! " : "") +
      "Obrigado pela confiança! — Toldos Print"

    const envio = await enviarDocumentoWhatsapp(
      clienteTelefone,
      pdfBuffer.toString("base64"),
      nomeArquivo,
      mensagem
    )

    if (!envio.ok) {
      throw new Error(envio.erro || "Falha ao enviar documento PDF pelo WhatsApp")
    }

    await registrarMensagemBot({
      clienteId: clienteId ?? null,
      clienteNome,
      telefone: clienteTelefone,
      texto: `📄 Recibo de pagamento enviado ao cliente em PDF: ${nomeArquivo}`,
      origem: "automatica",
      autor: "bot",
    })

    return NextResponse.json({
      ok: true,
      enviadoPara: clienteTelefone,
      cliente: clienteNome,
      numero: numeroRecibo,
      nomeArquivo,
    })
  } catch (err: any) {
    console.error("[enviar-recibo] erro:", err)
    return NextResponse.json({ erro: err?.message || String(err) }, { status: 500 })
  }
}
