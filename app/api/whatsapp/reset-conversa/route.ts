import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"

// Endpoint interno para resetar conversa de um telefone (testes/manutenção).
// Protegido pela mesma chave CRON_SECRET.
export async function POST(request: Request) {
  const secret = request.headers.get("x-secret") ?? new URL(request.url).searchParams.get("secret")
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 })
  }

  const { telefone } = await request.json()
  if (!telefone) return NextResponse.json({ erro: "telefone obrigatório" }, { status: 400 })

  const sql = getSql()
  await sql`DELETE FROM conversas_bot WHERE telefone = ${String(telefone)}`

  return NextResponse.json({ ok: true, deletado: telefone })
}
