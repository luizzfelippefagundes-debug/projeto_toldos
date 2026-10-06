import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await getSql()`DELETE FROM avisos_tv WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
