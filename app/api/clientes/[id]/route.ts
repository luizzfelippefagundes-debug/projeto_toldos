import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const b = await req.json()
  await getSql()`
    UPDATE clientes
    SET nome = ${b.nome}, telefone = ${b.telefone}, email = ${b.email ?? null}
    WHERE id = ${id}
  `
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await getSql()`DELETE FROM clientes WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
