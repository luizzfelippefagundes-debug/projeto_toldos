import { NextResponse } from "next/server"
import { ehTemaTv, salvarTemaTv } from "@/lib/tema-tv"

// Fica fora de /api/tv pra exigir login: só quem usa o sistema troca o tema da TV.
export async function PUT(req: Request) {
  const body = await req.json().catch(() => null)
  if (!ehTemaTv(body?.tema)) {
    return NextResponse.json({ error: "Tema inválido" }, { status: 400 })
  }
  await salvarTemaTv(body.tema)
  return NextResponse.json({ tema: body.tema })
}
