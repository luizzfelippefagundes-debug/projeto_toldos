import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"

export async function GET() {
  try {
    const sql = getSql()
    const rows = await sql`SELECT valor FROM configuracoes WHERE chave = 'ordem_cards_producao'`
    if (rows.length > 0 && rows[0].valor) {
      const ordem = JSON.parse(rows[0].valor)
      if (Array.isArray(ordem)) {
        return NextResponse.json({ ordem })
      }
    }
    return NextResponse.json({ ordem: [] })
  } catch (err: any) {
    console.error("[producao/ordem] erro ao buscar ordem:", err)
    return NextResponse.json({ ordem: [] })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { ordem } = body
    if (!Array.isArray(ordem)) {
      return NextResponse.json({ erro: "Lista de ordem inválida" }, { status: 400 })
    }

    const sql = getSql()
    await sql`
      INSERT INTO configuracoes (chave, valor)
      VALUES ('ordem_cards_producao', ${JSON.stringify(ordem)})
      ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor
    `

    return NextResponse.json({ ok: true, ordem })
  } catch (err: any) {
    console.error("[producao/ordem] erro ao salvar ordem:", err)
    return NextResponse.json({ erro: err?.message || "Erro ao salvar ordem" }, { status: 500 })
  }
}
