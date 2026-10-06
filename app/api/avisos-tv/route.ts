import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"

export async function GET() {
  const rows = await getSql()`SELECT * FROM avisos_tv ORDER BY criado_em DESC`
  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const { id, mensagem, criado_em, cor, icone, som } = await req.json()
  await getSql()`
    INSERT INTO avisos_tv (id, mensagem, criado_em, cor, icone, som)
    VALUES (${id}, ${mensagem}, ${criado_em}, ${cor ?? "azul"}, ${icone ?? "📢"}, ${som ?? false})
  `
  return NextResponse.json({ ok: true }, { status: 201 })
}
