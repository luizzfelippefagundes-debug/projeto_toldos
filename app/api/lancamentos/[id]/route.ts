import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import type { LancamentoFinanceiro } from "@/lib/types"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const b: LancamentoFinanceiro = await req.json()
  await getSql()`
    UPDATE lancamentos_financeiros SET
      descricao=${b.descricao}, tipo=${b.tipo}, categoria=${b.categoria},
      valor=${b.valor}, vencimento=${b.vencimento}, status=${b.status},
      pago_em=${b.pagoEm ?? null}, origem=${b.origem}, origem_id=${b.origemId ?? null},
      criado_em=${b.criadoEm}, cliente_id=${b.clienteId ?? null},
      forma_pagamento=${b.formaPagamento ?? null}, numero_boleto=${b.numeroBoleto ?? null}
    WHERE id=${id}
  `
  return NextResponse.json(b)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await getSql()`DELETE FROM lancamentos_financeiros WHERE id=${id}`
  return new NextResponse(null, { status: 204 })
}
