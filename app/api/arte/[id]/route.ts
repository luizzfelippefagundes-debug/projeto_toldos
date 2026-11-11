import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { garantirColunasOrcamentos, garantirColunasPedidosRapidos } from "@/lib/migracoes"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const limpoId = id.startsWith("orc-") ? id.slice(4) : id
  await garantirColunasOrcamentos()
  await garantirColunasPedidosRapidos()

  const sql = getSql()

  // 1. Tenta achar em orcamentos
  const orcRows = await sql`SELECT * FROM orcamentos WHERE id = ${limpoId} LIMIT 1`
  if (orcRows.length > 0) {
    const r = orcRows[0]
    const cliRows = await sql`SELECT nome, telefone FROM clientes WHERE id = ${r.cliente_id} LIMIT 1`
    const clienteNome = (cliRows[0]?.nome as string) ?? "Cliente"
    const clienteTelefone = (cliRows[0]?.telefone as string) ?? null

    const itemObj = typeof r.item === "string" ? JSON.parse(r.item) : r.item
    const descricao =
      itemObj?.servicoId && itemObj?.servicoId !== "nenhum"
        ? "Serviço + material"
        : "Orçamento de comunicação visual"

    return NextResponse.json({
      tipo: "orcamento",
      id: r.id,
      numero: r.numero,
      clienteNome,
      clienteTelefone,
      arteUrl: (r.arte_url as string) ?? null,
      arteAprovadaEm: (r.arte_aprovada_em as string) ?? null,
      status: (r.status_producao as string) ?? "arte",
      descricao,
      total: r.total_fechado ? Number(r.total_fechado) : null,
      criadoEm: r.criado_em,
    })
  }

  // 2. Tenta achar em pedidos_rapidos
  const pedRows = await sql`SELECT * FROM pedidos_rapidos WHERE id = ${limpoId} LIMIT 1`
  if (pedRows.length > 0) {
    const p = pedRows[0]
    return NextResponse.json({
      tipo: "pedido",
      id: p.id,
      numero: p.numero,
      clienteNome: p.cliente_nome as string,
      clienteTelefone: (p.cliente_telefone as string) ?? null,
      arteUrl: (p.arte_url as string) ?? null,
      arteAprovadaEm: (p.arte_aprovada_em as string) ?? null,
      status: p.status as string,
      descricao: (p.produto_nome as string) ?? "Pedido Gráfica Rápida",
      variante: (p.variante_nome as string) ?? null,
      total: Number(p.total),
      criadoEm: p.criado_em,
    })
  }

  return NextResponse.json({ erro: "Pedido ou arte não encontrado" }, { status: 404 })
}
