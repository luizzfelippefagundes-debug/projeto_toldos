import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"

export async function GET() {
  try {
    const sql = getSql()
    try {
      await sql`ALTER TABLE avisos_tv ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true`
    } catch {
      // ignora se a coluna já existe
    }
    const rows = await sql`
      SELECT id, mensagem, criado_em, cor, icone, som, COALESCE(ativo, true) as ativo 
      FROM avisos_tv 
      ORDER BY criado_em DESC
    `
    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Erro ao listar avisos da TV:", error)
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { id, mensagem, criado_em, cor, icone, som, ativo } = await req.json()
    const sql = getSql()
    try {
      await sql`ALTER TABLE avisos_tv ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true`
    } catch {
      // ignora se já existe
    }
    await sql`
      INSERT INTO avisos_tv (id, mensagem, criado_em, cor, icone, som, ativo)
      VALUES (${id}, ${mensagem}, ${criado_em}, ${cor ?? "azul"}, ${icone ?? "📢"}, ${som ?? false}, ${ativo ?? true})
    `
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error("Erro ao criar aviso da TV:", error)
    return NextResponse.json({ error: "Erro ao criar aviso" }, { status: 500 })
  }
}
