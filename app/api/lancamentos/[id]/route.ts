import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { excluirComHistorico } from "@/lib/historico-exclusoes"
import { garantirColunasLancamentos } from "@/lib/migracoes"
import { enviarReciboLancamento, type ResultadoRecibo } from "@/lib/recibo-whatsapp"
import type { LancamentoFinanceiro } from "@/lib/types"

// Recebimento marcado como pago agora (não uma baixa retroativa de parcelas
// antigas, que usa a data do vencimento): esse é o que gera recibo automático.
const JANELA_RECIBO_MS = 36 * 60 * 60 * 1000

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const b: LancamentoFinanceiro = await req.json()
  await garantirColunasLancamentos()
  // O subselect com FOR UPDATE lê o status anterior e trava a linha na mesma
  // instrução: dois PUTs simultâneos não conseguem os dois ver "pendente" e
  // mandar o recibo em dobro.
  const linhas = await getSql()`
    UPDATE lancamentos_financeiros AS l SET
      descricao=${b.descricao}, tipo=${b.tipo}, categoria=${b.categoria},
      valor=${b.valor}, vencimento=${b.vencimento}, status=${b.status},
      pago_em=${b.pagoEm ?? null}, origem=${b.origem}, origem_id=${b.origemId ?? null},
      criado_em=${b.criadoEm}, cliente_id=${b.clienteId ?? null},
      forma_pagamento=${b.formaPagamento ?? null}, numero_boleto=${b.numeroBoleto ?? null},
      parcela=${b.parcela ?? null},
      pessoal=${b.pessoal === true},
      despesa_fixa=${b.despesaFixa === true},
      observacoes=${b.observacoes ?? null},
      pix_copia_cola=${b.pixCopiaECola ?? null}
    FROM (SELECT id, status FROM lancamentos_financeiros WHERE id=${id} FOR UPDATE) AS antes
    WHERE l.id = antes.id
    RETURNING antes.status AS status_anterior
  `

  const virouPago = linhas.length > 0 && linhas[0].status_anterior !== "pago" && b.status === "pago"
  const pagoAgora = b.pagoEm ? Date.now() - new Date(b.pagoEm).getTime() < JANELA_RECIBO_MS : false
  let reciboWhatsapp: ResultadoRecibo | undefined
  if (virouPago && pagoAgora && b.tipo === "receita") {
    try {
      reciboWhatsapp = await enviarReciboLancamento(id)
    } catch (err: any) {
      console.error("[lancamentos] falha no recibo automático:", err)
      reciboWhatsapp = { ok: false, status: 500, erro: err?.message || String(err) }
    }
    if (!reciboWhatsapp.ok) console.error("[lancamentos] recibo automático não enviado:", id, reciboWhatsapp.erro)
  }

  return NextResponse.json(reciboWhatsapp ? { ...b, reciboWhatsapp } : b)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await excluirComHistorico("lancamentos_financeiros", id)
  return new NextResponse(null, { status: 204 })
}
