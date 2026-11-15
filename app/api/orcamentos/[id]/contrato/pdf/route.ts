import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { gerarPdfContratoServidor } from "@/lib/pdf-contrato-servidor"
import { formatarNumeroOrcamento } from "@/lib/orcamento-pdf"
import type { Orcamento } from "@/lib/types"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sql = getSql()

  const semPrefixo = id.startsWith("orc-") ? id.slice(4) : id
  const comPrefixo = id.startsWith("orc-") ? id : `orc-${id}`

  const orcRows = await sql`
    SELECT * FROM orcamentos 
    WHERE id = ${id} OR id = ${comPrefixo} OR id = ${semPrefixo} 
    LIMIT 1
  `

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

  const cliRows = await sql`SELECT nome, telefone, cpf, email FROM clientes WHERE id = ${r.cliente_id} LIMIT 1`
  const clienteNome = (cliRows[0]?.nome as string) ?? "Cliente"
  const clienteTelefone = (cliRows[0]?.telefone as string) ?? undefined
  const clienteCpf = (cliRows[0]?.cpf as string) ?? undefined
  const clienteEmail = (cliRows[0]?.email as string) ?? undefined

  // Busca se já foi assinado
  const assRows = await sql`
    SELECT assinatura_data, assinado_em 
    FROM assinaturas_os 
    WHERE orcamento_id = ${r.id} AND assinado_em IS NOT NULL
    ORDER BY criado_em DESC 
    LIMIT 1
  `
  const assinaturaData = assRows[0]?.assinatura_data || undefined
  const dataAssinatura = assRows[0]?.assinado_em || undefined

  const pdf = await gerarPdfContratoServidor(
    orcamento,
    clienteNome,
    clienteTelefone,
    clienteCpf,
    clienteEmail,
    assinaturaData,
    dataAssinatura
  )

  const nomeArquivo = `Contrato-CTR-${formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)}${assinaturaData ? "-assinado" : ""}.pdf`

  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nomeArquivo}"`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  })
}
