import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import type { Material } from "@/lib/types"

export async function GET() {
  const rows = await getSql()`SELECT * FROM materiais ORDER BY nome`
  const materiais: Material[] = rows.map((r) => ({
    id: r.id,
    nome: r.nome,
    tipo: r.tipo,
    unidade: r.unidade,
    precoUnitario: Number(r.preco_unitario),
    estoqueMinimo: Number(r.estoque_minimo),
    quantidadeEstoque: Number(r.quantidade_estoque),
  }))
  return NextResponse.json(materiais)
}

export async function POST(req: Request) {
  const b: Material = await req.json()
  await getSql()`
    INSERT INTO materiais (id, nome, tipo, unidade, preco_unitario, estoque_minimo, quantidade_estoque)
    VALUES (${b.id}, ${b.nome}, ${b.tipo}, ${b.unidade}, ${b.precoUnitario}, ${b.estoqueMinimo}, ${b.quantidadeEstoque})
  `
  return NextResponse.json(b, { status: 201 })
}
