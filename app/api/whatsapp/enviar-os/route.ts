import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { enviarDocumentoWhatsapp } from "@/lib/evolution-api"
import { gerarPdfOsServidor } from "@/lib/pdf-os-servidor"
import { formatarNumeroOrcamento } from "@/lib/orcamento-pdf"
import type { Orcamento } from "@/lib/types"

export async function POST(req: Request) {
  const { orcamentoId, telefone } = await req.json()

  if (!orcamentoId || !telefone) {
    return NextResponse.json({ erro: "orcamentoId e telefone obrigatórios" }, { status: 400 })
  }

  const sql = getSql()
  const rows = await sql`SELECT * FROM orcamentos WHERE id = ${orcamentoId} LIMIT 1`
  if (rows.length === 0) {
    return NextResponse.json({ erro: "Orçamento não encontrado" }, { status: 404 })
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
    criadoEm: r.criado_em,
    fechadoEm: r.fechado_em,
    validadeDias: r.validade_dias ?? undefined,
  } as Orcamento

  const clienteRows = await sql`SELECT nome, telefone FROM clientes WHERE id = ${orcamento.clienteId} LIMIT 1`
  const clienteNome = (clienteRows[0]?.nome as string) ?? "Cliente"
  const clienteTelefone = (clienteRows[0]?.telefone as string) ?? undefined

  const pdf = await gerarPdfOsServidor(orcamento, clienteNome, clienteTelefone)
  const nomeArquivo = `OS-${formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)}.pdf`

  await enviarDocumentoWhatsapp(
    telefone,
    pdf.toString("base64"),
    nomeArquivo,
    `📋 Segue a Ordem de Serviço nº ${formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)} da Toldos Print!`
  )

  return NextResponse.json({ ok: true })
}
