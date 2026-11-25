import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { garantirColunasOrcamentos } from "@/lib/migracoes"
import { excluirComHistorico } from "@/lib/historico-exclusoes"
import type { Orcamento } from "@/lib/types"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const b: Orcamento = await req.json()
  await garantirColunasOrcamentos()
  await getSql()`
    UPDATE orcamentos SET
      numero=${b.numero}, cliente_id=${b.clienteId}, item=${JSON.stringify(b.item)},
      quantidade_material_debitada=${b.quantidadeMaterialDebitada ?? null},
      material_fechado=${b.materialFechado ? JSON.stringify(b.materialFechado) : null},
      servico_fechado=${b.servicoFechado ? JSON.stringify(b.servicoFechado) : null},
      total_fechado=${b.totalFechado ?? null}, ajuste_manual=${b.ajusteManual},
      anexo_nome=${b.anexoNome ?? null}, anexo_url=${b.anexoUrl ?? null},
      status=${b.status}, criado_em=${b.criadoEm}, fechado_em=${b.fechadoEm ?? null},
      validade_dias=${b.validadeDias ?? null},
      retorno=${b.retorno ? JSON.stringify(b.retorno) : null},
      status_producao=COALESCE(${b.statusProducao ?? null}, status_producao),
      os_emitida_em=COALESCE(${b.osEmitidaEm ?? null}, os_emitida_em),
      arte_url=COALESCE(${b.arteUrl ?? null}, arte_url),
      arte_aprovada_em=COALESCE(${b.arteAprovadaEm ?? null}, arte_aprovada_em),
      observacao=COALESCE(${b.observacao ?? null}, observacao),
      origem=COALESCE(${b.origem ?? null}, origem),
      foto_pronto_url=COALESCE(${b.fotoProntoUrl ?? null}, foto_pronto_url)
    WHERE id=${id}
  `
  return NextResponse.json(b)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await excluirComHistorico("orcamentos", id)
  return new NextResponse(null, { status: 204 })
}
