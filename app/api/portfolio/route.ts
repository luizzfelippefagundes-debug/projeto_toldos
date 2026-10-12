import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"

// Pública: alimenta a galeria em /portfolio, sem necessidade de login.
export async function GET() {
  const rows = await getSql()`
    SELECT id, categoria, url, descricao, criado_em
    FROM portfolio_fotos
    ORDER BY criado_em DESC
  `
  return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } })
}
