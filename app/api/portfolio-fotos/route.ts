import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"

export async function POST(req: Request) {
  const { id, categoria, url, descricao, criado_em } = await req.json()
  await getSql()`
    INSERT INTO portfolio_fotos (id, categoria, url, descricao, criado_em)
    VALUES (${id}, ${categoria}, ${url}, ${descricao ?? null}, ${criado_em})
  `
  return NextResponse.json({ ok: true }, { status: 201 })
}
