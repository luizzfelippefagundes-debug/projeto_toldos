import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const colaborador = searchParams.get("colaborador")
    const sql = getSql()

    let rows: any[] = []
    if (colaborador && colaborador !== "todos") {
      rows = await sql`
        SELECT * FROM recibos_comissao
        WHERE colaborador_nome = ${colaborador}
        ORDER BY criado_em DESC
        LIMIT 200
      `
    } else {
      rows = await sql`
        SELECT * FROM recibos_comissao
        ORDER BY criado_em DESC
        LIMIT 200
      `
    }

    return NextResponse.json({ recibos: rows }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Erro ao listar recibos de comissões:", error)
    return NextResponse.json({ error: "Erro ao buscar recibos" }, { status: 500 })
  }
}
