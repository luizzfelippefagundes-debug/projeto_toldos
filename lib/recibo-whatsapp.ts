import { getSql } from "@/lib/db"
import { enviarDocumentoWhatsapp } from "@/lib/evolution-api"
import { gerarPdfReciboServidor, type DadosReciboServidor } from "@/lib/pdf-recibo-servidor"
import { formatarMoeda } from "@/lib/format"
import { formatarNumeroOrcamento } from "@/lib/orcamento-pdf"
import { registrarMensagemBot } from "@/lib/bot-registro"

const rotuloForma: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao: "Cartão",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  boleto: "Boleto",
  transferencia: "Transferência",
}

export type ResultadoRecibo =
  | { ok: true; enviadoPara: string; cliente: string; numero: string; nomeArquivo: string }
  | { ok: false; status: number; erro: string }

// Gera o PDF oficial do recibo e manda como DOCUMENTO anexado pela Evolution
// API. É o único caminho de envio de recibo: nunca mandar só o texto dizendo
// "segue em anexo" (foi o que aconteceu com o link do WhatsApp Web).
export async function enviarReciboLancamento(
  lancamentoId: string,
  telefoneDestino?: string
): Promise<ResultadoRecibo> {
  const sql = getSql()
  const rows = await sql`SELECT * FROM lancamentos_financeiros WHERE id = ${lancamentoId} LIMIT 1`
  if (rows.length === 0) return { ok: false, status: 404, erro: "Lançamento não encontrado" }

  const lancamento = rows[0]
  if (lancamento.status !== "pago") {
    return { ok: false, status: 400, erro: "Lançamento ainda não foi pago" }
  }

  let clienteNome = "Cliente"
  let clienteTelefone: string | undefined = telefoneDestino || undefined
  const clienteId = lancamento.cliente_id

  if (clienteId) {
    const cRows = await sql`SELECT nome, telefone FROM clientes WHERE id = ${clienteId} LIMIT 1`
    if (cRows.length > 0) {
      clienteNome = cRows[0].nome ?? "Cliente"
      if (!clienteTelefone) clienteTelefone = cRows[0].telefone || undefined
    }
  }

  if (!clienteTelefone) {
    return { ok: false, status: 400, erro: "Cliente sem telefone cadastrado" }
  }

  // Mesma numeração e texto da tela do recibo (app/(app)/financeiro/[id]/recibo).
  let numeroOrcamento: string | null = null
  let resumo: DadosReciboServidor["resumo"]
  let referente: string = lancamento.descricao || "serviços prestados"
  const sufixo =
    lancamento.parcela === "entrada" ? "E" : lancamento.parcela === "restante" ? "R" : "U"

  const orcamentoId = lancamento.origem === "orcamento" ? lancamento.origem_id : null
  if (orcamentoId) {
    const oRows = await sql`SELECT numero, criado_em FROM orcamentos WHERE id = ${orcamentoId} LIMIT 1`
    if (oRows.length > 0) {
      numeroOrcamento = formatarNumeroOrcamento(oRows[0].numero, oRows[0].criado_em)

      if (lancamento.parcela === "entrada") {
        const pct = /Entrada (\d+(?:[.,]\d+)?)%/.exec(lancamento.descricao ?? "")?.[1]
        referente = `entrada${pct ? ` de ${pct}%` : ""} do orçamento nº ${numeroOrcamento}`
      } else if (lancamento.parcela === "restante") {
        referente = `saldo restante do orçamento nº ${numeroOrcamento}`
      } else {
        referente = `pagamento do orçamento nº ${numeroOrcamento}`
      }

      const irmaos = await sql`
        SELECT * FROM lancamentos_financeiros
        WHERE origem = 'orcamento' AND origem_id = ${orcamentoId}
        ORDER BY vencimento ASC
      `
      const totalOrcamento = irmaos.reduce((acc, l) => acc + Number(l.valor), 0)
      const totalPago = irmaos
        .filter((l) => l.status === "pago")
        .reduce((acc, l) => acc + Number(l.valor), 0)
      const saldo = Math.max(0, Math.round((totalOrcamento - totalPago) * 100) / 100)
      const pendente = irmaos.find((l) => l.status !== "pago")
      resumo = {
        totalOrcamento,
        totalPago,
        saldo,
        vencimentoSaldo: pendente?.vencimento ? String(pendente.vencimento) : undefined,
      }
    }
  }

  const numeroRecibo = numeroOrcamento
    ? `${numeroOrcamento}/${sufixo}`
    : String(lancamento.id).slice(-6).toUpperCase()

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
    `Olá, ${clienteNome.split(" ")[0]}! Recebemos seu pagamento de ${formatarMoeda(dadosRecibo.valor)} ` +
    `(${referente}). Segue o recibo oficial em PDF. ` +
    (resumo && resumo.saldo > 0 ? `Saldo restante: ${formatarMoeda(resumo.saldo)}. ` : resumo ? "Orçamento quitado! " : "") +
    "Obrigado pela confiança! — Toldos Print"

  const envio = await enviarDocumentoWhatsapp(
    clienteTelefone,
    pdfBuffer.toString("base64"),
    nomeArquivo,
    mensagem
  )
  if (!envio.ok) {
    return { ok: false, status: 502, erro: envio.erro || "Falha ao enviar o PDF pelo WhatsApp" }
  }

  await registrarMensagemBot({
    clienteId: clienteId ?? null,
    clienteNome,
    telefone: clienteTelefone,
    texto: `📄 Recibo de pagamento enviado ao cliente em PDF: ${nomeArquivo}`,
    origem: "automatica",
    autor: "bot",
  }).catch((e) => console.error("[recibo] falha ao registrar no histórico:", e))

  return { ok: true, enviadoPara: clienteTelefone, cliente: clienteNome, numero: numeroRecibo, nomeArquivo }
}
