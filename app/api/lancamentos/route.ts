import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import type { LancamentoFinanceiro } from "@/lib/types"

function rowToLancamento(r: Record<string, unknown>): LancamentoFinanceiro {
  return {
    id: r.id as string,
    descricao: r.descricao as string,
    tipo: r.tipo as LancamentoFinanceiro["tipo"],
    categoria: r.categoria as string,
    valor: Number(r.valor),
    vencimento: r.vencimento as string,
    status: r.status as LancamentoFinanceiro["status"],
    pagoEm: (r.pago_em as string) ?? undefined,
    origem: r.origem as LancamentoFinanceiro["origem"],
    origemId: (r.origem_id as string) ?? null,
    criadoEm: r.criado_em as string,
    clienteId: (r.cliente_id as string) ?? undefined,
    formaPagamento: (r.forma_pagamento as LancamentoFinanceiro["formaPagamento"]) ?? undefined,
    numeroBoleto: (r.numero_boleto as string) ?? undefined,
  }
}

export async function GET() {
  const rows = await getSql()`SELECT * FROM lancamentos_financeiros ORDER BY vencimento DESC`
  return NextResponse.json(rows.map(rowToLancamento))
}

export async function POST(req: Request) {
  const b: LancamentoFinanceiro = await req.json()
  await getSql()`
    INSERT INTO lancamentos_financeiros (
      id, descricao, tipo, categoria, valor, vencimento, status, pago_em,
      origem, origem_id, criado_em, cliente_id, forma_pagamento, numero_boleto
    ) VALUES (
      ${b.id}, ${b.descricao}, ${b.tipo}, ${b.categoria}, ${b.valor},
      ${b.vencimento}, ${b.status}, ${b.pagoEm ?? null}, ${b.origem},
      ${b.origemId ?? null}, ${b.criadoEm}, ${b.clienteId ?? null},
      ${b.formaPagamento ?? null}, ${b.numeroBoleto ?? null}
    )
  `
  return NextResponse.json(b, { status: 201 })
}
