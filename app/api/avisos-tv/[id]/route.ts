import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await getSql()`DELETE FROM avisos_tv WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Erro ao deletar aviso:", error)
    return NextResponse.json({ error: "Erro ao deletar aviso" }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { ativo } = await req.json()
    const sql = getSql()
    try {
      await sql`ALTER TABLE avisos_tv ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true`
    } catch {
      // ignora
    }
    await sql`UPDATE avisos_tv SET ativo = ${ativo} WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Erro ao atualizar status do aviso:", error)
    return NextResponse.json({ error: "Erro ao atualizar status" }, { status: 500 })
  }
}
