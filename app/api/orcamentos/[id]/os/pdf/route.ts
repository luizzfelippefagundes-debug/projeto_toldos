import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { gerarPdfOsServidor } from "@/lib/pdf-os-servidor"
import { formatarNumeroOrcamento } from "@/lib/orcamento-pdf"
import type { Orcamento } from "@/lib/types"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sql = getSql()

  const semPrefixo = id.startsWith("orc-") ? id.slice(4) : id
  const comPrefixo = id.startsWith("orc-") ? id : `orc-${id}`

  const rows = await sql`
    SELECT * FROM orcamentos 
    WHERE id = ${id} OR id = ${comPrefixo} OR id = ${semPrefixo} 
    LIMIT 1
  `
  if (rows.length === 0) {
    return new NextResponse("Orçamento não encontrado", { status: 404 })
  }
  const r = rows[0]
  const orcamento = {
    id: r.id,
    numero: r.numero,
    clienteId: r.cliente_id,
    item: r.item,
    materialFechado: r.material_fechado,
    servicoFechado: r.servico_fechado,
    totalFechado: r.total_fechado ? Number(r.total_fechado) : undefined,
    ajusteManual: Number(r.ajuste_manual ?? 0),
    anexoNome: r.anexo_nome,
    anexoUrl: r.anexo_url,
    status: r.status,
    criadoEm: typeof r.criado_em === "string" ? r.criado_em : r.criado_em.toISOString(),
    fechadoEm: r.fechado_em ? (typeof r.fechado_em === "string" ? r.fechado_em : r.fechado_em.toISOString()) : undefined,
    validadeDias: r.validade_dias ?? undefined,
  } as Orcamento

  const clienteRows = await sql`SELECT nome, telefone FROM clientes WHERE id = ${orcamento.clienteId} LIMIT 1`
  const clienteNome = (clienteRows[0]?.nome as string) ?? "Cliente"
  const clienteTelefone = (clienteRows[0]?.telefone as string) ?? undefined

  const pdfBuffer = await gerarPdfOsServidor(orcamento, clienteNome, clienteTelefone)
  const numeroOS = formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="OS-${numeroOS}.pdf"`,
      "Cache-Control": "no-store, max-age=0",
    },
  })
}
