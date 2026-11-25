import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { getSql } from "@/lib/db"
import { garantirTabelaAssinaturasOs } from "@/lib/migracoes"

export async function POST(req: Request) {
  const { orcamentoId } = await req.json()
  if (!orcamentoId) {
    return NextResponse.json({ erro: "orcamentoId obrigatório" }, { status: 400 })
  }

  await garantirTabelaAssinaturasOs()

  const sql = getSql()
  const semPrefixo = orcamentoId.startsWith("orc-") ? orcamentoId.slice(4) : orcamentoId
  const comPrefixo = orcamentoId.startsWith("orc-") ? orcamentoId : `orc-${orcamentoId}`

  const rows = await sql`
    SELECT id FROM orcamentos 
    WHERE id = ${orcamentoId} OR id = ${comPrefixo} OR id = ${semPrefixo} 
    LIMIT 1
  `
  if (rows.length === 0) {
    return NextResponse.json({ erro: "Orçamento não encontrado" }, { status: 404 })
  }

  const realOrcId = rows[0].id as string
  const token = randomUUID()
  const agora = new Date()
  const expira = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 dias

  await sql`
    INSERT INTO assinaturas_os (id, orcamento_id, criado_em, expira_em)
    VALUES (${token}, ${realOrcId}, ${agora.toISOString()}, ${expira.toISOString()})
  `

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

  const url = `${baseUrl}/assinar/${token}`

  return NextResponse.json({ token, url })
}
