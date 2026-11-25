import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { garantirTabelaAssinaturasOs } from "@/lib/migracoes"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await garantirTabelaAssinaturasOs()

  const sql = getSql()
  const semPrefixo = id.startsWith("orc-") ? id.slice(4) : id
  const comPrefixo = id.startsWith("orc-") ? id : `orc-${id}`

  const rows = await sql`
    SELECT id, assinado_em, assinatura_data, pdf_url, criado_em, expira_em
    FROM assinaturas_os
    WHERE orcamento_id = ${id} OR orcamento_id = ${comPrefixo} OR orcamento_id = ${semPrefixo}
    ORDER BY criado_em DESC
    LIMIT 1
  `

  if (rows.length === 0) return NextResponse.json(null)

  const r = rows[0]
  const assinado = !!r.assinado_em
  return NextResponse.json({
    token: r.id,
    assinado,
    assinadoEm: r.assinado_em ?? null,
    assinaturaData: r.assinatura_data ?? null,
    pdfUrl: assinado ? `/api/assinar/${r.id}/pdf` : (r.pdf_url ?? null),
    criadoEm: r.criado_em,
    expiraEm: r.expira_em,
  })
}
