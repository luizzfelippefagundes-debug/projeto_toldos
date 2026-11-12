import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { gerarPdfOsServidor } from "@/lib/pdf-os-servidor"
import { formatarNumeroOrcamento } from "@/lib/orcamento-pdf"
import type { Orcamento } from "@/lib/types"

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const sql = getSql()

  const rows = await sql`SELECT * FROM assinaturas_os WHERE id = ${token} LIMIT 1`
  if (rows.length === 0) {
    return new NextResponse("Assinatura não encontrada", { status: 404 })
  }

  const reg = rows[0]
  const orcRows = await sql`SELECT * FROM orcamentos WHERE id = ${reg.orcamento_id} LIMIT 1`
  if (orcRows.length === 0) {
    return new NextResponse("Orçamento não encontrado", { status: 404 })
  }

  const r = orcRows[0]
  const orcamento: Orcamento = {
    id: r.id,
    numero: r.numero,
    clienteId: r.cliente_id,
    item: r.item,
    materialFechado: r.material_fechado,
    servicoFechado: r.servico_fechado,
    totalFechado: r.total_fechado ? Number(r.total_fechado) : undefined,
    ajusteManual: Number(r.ajuste_manual ?? 0),
    anexoNome: r.anexo_nome,
    status: r.status,
    criadoEm: typeof r.criado_em === "string" ? r.criado_em : r.criado_em.toISOString(),
    fechadoEm: r.fechado_em ? (typeof r.fechado_em === "string" ? r.fechado_em : r.fechado_em.toISOString()) : undefined,
    validadeDias: r.validade_dias || 7,
  }

  const clienteRows = await sql`SELECT nome, telefone FROM clientes WHERE id = ${r.cliente_id} LIMIT 1`
  const clienteNome = (clienteRows[0]?.nome as string) ?? "Cliente"
  const clienteTelefone = (clienteRows[0]?.telefone as string) ?? undefined

  const pdf = await gerarPdfOsServidor(orcamento, clienteNome, clienteTelefone, reg.assinatura_data || undefined)
  const nomeArquivo = `OS-${formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)}-assinada.pdf`

  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nomeArquivo}"`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  })
}
