import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import type { Acabamento } from "@/lib/types"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const b: Acabamento = await req.json()
  const sql = getSql()
  await sql`
    UPDATE acabamentos
    SET nome = ${b.nome}, preco_unitario = ${b.precoUnitario}, unidade = ${b.unidade}
    WHERE id = ${id}
  `
  return NextResponse.json(b)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sql = getSql()
  await sql`DELETE FROM acabamentos WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
