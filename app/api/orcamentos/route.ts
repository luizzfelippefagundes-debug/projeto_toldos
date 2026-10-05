import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import type { Orcamento } from "@/lib/types"

function rowToOrcamento(r: Record<string, unknown>): Orcamento {
  return {
    id: r.id as string,
    numero: r.numero as number,
    clienteId: r.cliente_id as string,
    item: r.item as Orcamento["item"],
    quantidadeMaterialDebitada: r.quantidade_material_debitada != null ? Number(r.quantidade_material_debitada) : undefined,
    materialFechado: (r.material_fechado as Orcamento["materialFechado"]) ?? undefined,
    servicoFechado: (r.servico_fechado as Orcamento["servicoFechado"]) ?? undefined,
    totalFechado: r.total_fechado != null ? Number(r.total_fechado) : undefined,
    ajusteManual: Number(r.ajuste_manual),
    anexoNome: (r.anexo_nome as string) ?? null,
    anexoUrl: (r.anexo_url as string) ?? undefined,
    status: r.status as Orcamento["status"],
    criadoEm: r.criado_em as string,
    fechadoEm: (r.fechado_em as string) ?? null,
    validadeDias: r.validade_dias != null ? Number(r.validade_dias) : undefined,
  }
}

export async function GET() {
  const rows = await getSql()`SELECT * FROM orcamentos ORDER BY numero DESC`
  return NextResponse.json(rows.map(rowToOrcamento))
}

export async function POST(req: Request) {
  const b: Orcamento = await req.json()
  await getSql()`
    INSERT INTO orcamentos (
      id, numero, cliente_id, item, quantidade_material_debitada,
      material_fechado, servico_fechado, total_fechado, ajuste_manual,
      anexo_nome, anexo_url, status, criado_em, fechado_em, validade_dias
    ) VALUES (
      ${b.id}, ${b.numero}, ${b.clienteId}, ${JSON.stringify(b.item)},
      ${b.quantidadeMaterialDebitada ?? null},
      ${b.materialFechado ? JSON.stringify(b.materialFechado) : null},
      ${b.servicoFechado ? JSON.stringify(b.servicoFechado) : null},
      ${b.totalFechado ?? null}, ${b.ajusteManual},
      ${b.anexoNome ?? null}, ${b.anexoUrl ?? null},
      ${b.status}, ${b.criadoEm}, ${b.fechadoEm ?? null},
      ${b.validadeDias ?? null}
    )
  `
  return NextResponse.json(b, { status: 201 })
}
