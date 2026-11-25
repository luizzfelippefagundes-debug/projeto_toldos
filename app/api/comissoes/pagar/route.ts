import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"

export async function POST(req: Request) {
  try {
    const {
      comissao_ids,
      colaborador_nome,
      criar_lancamento_financeiro,
      observacao,
    } = await req.json()

    if (!Array.isArray(comissao_ids) || comissao_ids.length === 0) {
      return NextResponse.json({ error: "Nenhuma comissão selecionada para pagamento" }, { status: 400 })
    }

    const sql = getSql()

    // Buscar as comissões a serem pagas para somar o total real
    const itens = await sql`
      SELECT id, valor_comissao, numero FROM comissoes_producao
      WHERE id = ANY(${comissao_ids}) AND status = 'pendente'
    `

    if (itens.length === 0) {
      return NextResponse.json({ error: "Nenhuma comissão pendente encontrada" }, { status: 400 })
    }

    const idsValidos = itens.map((i: any) => i.id)
    const totalPago = itens.reduce((acc: number, curr: any) => acc + (Number(curr.valor_comissao) || 0), 0)

    // Atualizar status para pago
    await sql`
      UPDATE comissoes_producao
      SET status = 'pago',
          pago_em = NOW(),
          pago_por = 'Gestor / Dono'
      WHERE id = ANY(${idsValidos})
    `

    // Opcionalmente lançar no módulo Financeiro da empresa como despesa de comissão
    let lancamentoId: string | null = null
    if (criar_lancamento_financeiro && totalPago > 0) {
      lancamentoId = `fin-com-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const hoje = new Date().toISOString().slice(0, 10)
      const desc = `Comissão Produção — ${colaborador_nome || "Colaborador"} (${itens.length} peças)`

      await sql`
        INSERT INTO lancamentos_financeiros (
          id,
          tipo,
          descricao,
          valor,
          categoria,
          vencimento,
          status,
          pago_em,
          forma_pagamento,
          observacoes,
          criado_em
        ) VALUES (
          ${lancamentoId},
          'despesa',
          ${desc},
          ${totalPago},
          'Comissão / RH',
          ${hoje},
          'pago',
          ${hoje},
          'Pix',
          ${observacao || `Pagamento semanal de bônus de produção para ${colaborador_nome}`},
          ${new Date().toISOString()}
        )
      `
    }

    return NextResponse.json({
      ok: true,
      totalPago,
      quantidadePaga: idsValidos.length,
      lancamentoId,
    })
  } catch (error) {
    console.error("Erro ao pagar comissões:", error)
    return NextResponse.json({ error: "Erro ao processar pagamento de comissões" }, { status: 500 })
  }
}
