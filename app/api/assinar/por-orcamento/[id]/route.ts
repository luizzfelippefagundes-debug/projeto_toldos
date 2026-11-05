import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { garantirTabelaAssinaturasOs } from "@/lib/migracoes"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await garantirTabelaAssinaturasOs()

  const sql = getSql()
  const rows = await sql`
    SELECT id, assinado_em, pdf_url, criado_em, expira_em
    FROM assinaturas_os
    WHERE orcamento_id = ${id}
    ORDER BY criado_em DESC
    LIMIT 1
  `

  if (rows.length === 0) return NextResponse.json(null)

  const r = rows[0]
  return NextResponse.json({
    token: r.id,
    assinado: !!r.assinado_em,
    assinadoEm: r.assinado_em ?? null,
    pdfUrl: r.pdf_url ?? null,
    criadoEm: r.criado_em,
    expiraEm: r.expira_em,
  })
}
