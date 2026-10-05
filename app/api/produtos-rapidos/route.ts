import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import type { ProdutoRapido } from "@/lib/types"

export async function GET() {
  const rows = await getSql()`SELECT * FROM produtos_rapidos ORDER BY nome`
  const produtos: ProdutoRapido[] = rows.map((r) => ({
    id: r.id as string,
    nome: r.nome as string,
    categoria: r.categoria as ProdutoRapido["categoria"],
    prazoDias: Number(r.prazo_dias),
    temAcabamento: r.tem_acabamento as boolean,
    variantes: r.variantes as ProdutoRapido["variantes"],
  }))
  return NextResponse.json(produtos)
}

export async function POST(req: Request) {
  const b: ProdutoRapido = await req.json()
  await getSql()`
    INSERT INTO produtos_rapidos (id, nome, categoria, prazo_dias, tem_acabamento, variantes)
    VALUES (${b.id}, ${b.nome}, ${b.categoria}, ${b.prazoDias}, ${b.temAcabamento}, ${JSON.stringify(b.variantes)})
  `
  return NextResponse.json(b, { status: 201 })
}
