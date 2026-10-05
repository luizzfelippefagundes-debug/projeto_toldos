import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import type { Servico } from "@/lib/types"

export async function GET() {
  const rows = await getSql()`SELECT * FROM servicos ORDER BY nome`
  const servicos: Servico[] = rows.map((r) => ({
    id: r.id,
    nome: r.nome,
    formaCobranca: r.forma_cobranca,
    valor: Number(r.valor),
    ferramentas: r.ferramentas ?? undefined,
  }))
  return NextResponse.json(servicos)
}

export async function POST(req: Request) {
  const b: Servico = await req.json()
  await getSql()`
    INSERT INTO servicos (id, nome, forma_cobranca, valor, ferramentas)
    VALUES (${b.id}, ${b.nome}, ${b.formaCobranca}, ${b.valor}, ${b.ferramentas ?? null})
  `
  return NextResponse.json(b, { status: 201 })
}
