import { NextResponse } from "next/server"
import { ehTemaTv, salvarTemaTv } from "@/lib/tema-tv"
import { getSql } from "@/lib/db"

// Fica fora de /api/tv pra exigir login: só quem usa o sistema troca o tema da TV.
export async function PUT(req: Request) {
  const body = await req.json().catch(() => null)
  if (!ehTemaTv(body?.tema)) {
    return NextResponse.json({ error: "Tema inválido" }, { status: 400 })
  }
  await salvarTemaTv(body.tema)
  try {
    const sql = getSql()
    const confRows = await sql`SELECT valor FROM configuracoes WHERE chave = 'tv_config'`
    if (confRows[0]?.valor) {
      const atual = JSON.parse(confRows[0].valor)
      atual.tema = body.tema
      await sql`UPDATE configuracoes SET valor = ${JSON.stringify(atual)} WHERE chave = 'tv_config'`
    }
  } catch {}
  return NextResponse.json({ tema: body.tema })
}
