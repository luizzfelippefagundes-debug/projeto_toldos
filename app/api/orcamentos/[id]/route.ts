import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import type { Orcamento } from "@/lib/types"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const b: Orcamento = await req.json()
  await getSql()`
    UPDATE orcamentos SET
      numero=${b.numero}, cliente_id=${b.clienteId}, item=${JSON.stringify(b.item)},
      quantidade_material_debitada=${b.quantidadeMaterialDebitada ?? null},
      material_fechado=${b.materialFechado ? JSON.stringify(b.materialFechado) : null},
      servico_fechado=${b.servicoFechado ? JSON.stringify(b.servicoFechado) : null},
      total_fechado=${b.totalFechado ?? null}, ajuste_manual=${b.ajusteManual},
      anexo_nome=${b.anexoNome ?? null}, anexo_url=${b.anexoUrl ?? null},
      status=${b.status}, criado_em=${b.criadoEm}, fechado_em=${b.fechadoEm ?? null},
      validade_dias=${b.validadeDias ?? null}
    WHERE id=${id}
  `
  return NextResponse.json(b)
}
