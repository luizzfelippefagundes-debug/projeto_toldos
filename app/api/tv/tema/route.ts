import { NextResponse } from "next/server"
import { lerTemaTv } from "@/lib/tema-tv"

// Público (como o resto de /api/tv): o Painel TV não tem login.
export async function GET() {
  const tema = await lerTemaTv()
  return NextResponse.json({ tema }, { headers: { "Cache-Control": "no-store" } })
}
