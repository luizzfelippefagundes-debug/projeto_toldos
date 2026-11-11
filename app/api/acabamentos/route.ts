import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import type { Acabamento } from "@/lib/types"
import { acabamentosSeed } from "@/lib/seed-data"

function rowToAcabamento(r: Record<string, unknown>): Acabamento {
  return {
    id: r.id as string,
    nome: r.nome as string,
    precoUnitario: Number(r.preco_unitario),
    unidade: r.unidade as string,
  }
}

export async function GET() {
  const sql = getSql()
  let rows = await sql`SELECT * FROM acabamentos ORDER BY nome`

  // Semeia os valores iniciais se a tabela estiver vazia
  if (rows.length === 0) {
    for (const a of acabamentosSeed) {
      await sql`
        INSERT INTO acabamentos (id, nome, preco_unitario, unidade)
        VALUES (${a.id}, ${a.nome}, ${a.precoUnitario}, ${a.unidade})
        ON CONFLICT (id) DO NOTHING
      `
    }
    rows = await sql`SELECT * FROM acabamentos ORDER BY nome`
  }

  return NextResponse.json(rows.map(rowToAcabamento))
}

export async function POST(req: Request) {
  const b: Acabamento = await req.json()
  const sql = getSql()
  await sql`
    INSERT INTO acabamentos (id, nome, preco_unitario, unidade)
    VALUES (${b.id}, ${b.nome}, ${b.precoUnitario}, ${b.unidade})
  `
  return NextResponse.json(b, { status: 201 })
}
