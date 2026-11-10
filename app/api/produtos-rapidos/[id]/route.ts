import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await getSql()`DELETE FROM produtos_rapidos WHERE id = ${id}`
  return new NextResponse(null, { status: 204 })
}
