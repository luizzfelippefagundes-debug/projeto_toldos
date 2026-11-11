import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { garantirColunasPedidosRapidos } from "@/lib/migracoes"
import type { PedidoRapido } from "@/lib/types"

function rowToPedido(r: Record<string, unknown>): PedidoRapido {
  return {
    id: r.id as string,
    numero: r.numero as number,
    produtoId: r.produto_id as string,
    varianteId: r.variante_id as string,
    acabamento: (r.acabamento as string) ?? null,
    clienteNome: r.cliente_nome as string,
    clienteTelefone: r.cliente_telefone as string,
    observacao: r.observacao as string,
    total: Number(r.total),
    status: r.status as PedidoRapido["status"],
    criadoEm: r.criado_em as string,
    vendedorId: (r.vendedor_id as string) ?? undefined,
    produtoNome: (r.produto_nome as string) ?? undefined,
    varianteNome: (r.variante_nome as string) ?? undefined,
    prazoEntregaEm: (r.prazo_entrega_em as string) ?? undefined,
    arteUrl: (r.arte_url as string) ?? undefined,
    arteAprovadaEm: (r.arte_aprovada_em as string) ?? undefined,
  }
}

export async function GET() {
  await garantirColunasPedidosRapidos()
  const rows = await getSql()`SELECT * FROM pedidos_rapidos ORDER BY numero DESC`
  return NextResponse.json(rows.map(rowToPedido))
}

export async function POST(req: Request) {
  const b: PedidoRapido = await req.json()
  await garantirColunasPedidosRapidos()
  await getSql()`
    INSERT INTO pedidos_rapidos (
      id, numero, produto_id, variante_id, acabamento, cliente_nome,
      cliente_telefone, observacao, total, status, criado_em,
      vendedor_id, produto_nome, variante_nome, prazo_entrega_em,
      arte_url, arte_aprovada_em
    ) VALUES (
      ${b.id}, ${b.numero}, ${b.produtoId}, ${b.varianteId}, ${b.acabamento ?? null},
      ${b.clienteNome}, ${b.clienteTelefone}, ${b.observacao}, ${b.total},
      ${b.status}, ${b.criadoEm}, ${b.vendedorId ?? null}, ${b.produtoNome ?? null},
      ${b.varianteNome ?? null}, ${b.prazoEntregaEm ?? null},
      ${b.arteUrl ?? null}, ${b.arteAprovadaEm ?? null}
    )
  `
  return NextResponse.json(b, { status: 201 })
}
