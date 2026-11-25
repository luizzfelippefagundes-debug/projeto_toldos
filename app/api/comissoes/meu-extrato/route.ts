import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { getSql } from "@/lib/db"

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const clerk = await clerkClient()
    const user = await clerk.users.getUser(userId)
    const nomeCompleto = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || user.primaryEmailAddress?.emailAddress || "Colaborador"
    const primeiroNome = user.firstName || nomeCompleto.split(" ")[0] || "Colaborador"

    const sql = getSql()

    // Buscar comissões do colaborador atual (por ID ou correspondência de nome)
    const comissoes = await sql`
      SELECT id, numero, cliente_nome, produto_nome, valor_pedido, comissao_percent, valor_comissao, status, pago_em, recibo_id, criado_em
      FROM comissoes_producao
      WHERE colaborador_id = ${userId}
         OR colaborador_nome ILIKE ${nomeCompleto}
         OR colaborador_nome ILIKE ${primeiroNome}
      ORDER BY criado_em DESC
    `

    // Buscar recibos emitidos para este colaborador
    const recibos = await sql`
      SELECT id, numero_recibo, valor_total, forma_pagamento, tipo_assinatura, assinado_em, criado_em, pago_por
      FROM recibos_comissao
      WHERE colaborador_id = ${userId}
         OR colaborador_nome ILIKE ${nomeCompleto}
         OR colaborador_nome ILIKE ${primeiroNome}
      ORDER BY criado_em DESC
    `

    const itensPendentes = comissoes.filter((c: any) => c.status === "pendente")
    const itensPagos = comissoes.filter((c: any) => c.status === "pago")

    const totalPendente = itensPendentes.reduce((acc: number, c: any) => acc + (Number(c.valor_comissao) || 0), 0)
    const totalPago = itensPagos.reduce((acc: number, c: any) => acc + (Number(c.valor_comissao) || 0), 0)

    return NextResponse.json({
      colaborador: {
        id: userId,
        nome: nomeCompleto,
        email: user.primaryEmailAddress?.emailAddress ?? null,
      },
      resumo: {
        totalPendente,
        totalPago,
        totalGeral: totalPendente + totalPago,
        pecasPendentes: itensPendentes.length,
        pecasPagas: itensPagos.length,
        totalPecas: comissoes.length,
      },
      itensPendentes,
      recibos,
      historicoRecente: comissoes.slice(0, 30),
    })
  } catch (error) {
    console.error("Erro ao carregar extrato do colaborador:", error)
    return NextResponse.json({ error: "Erro ao carregar extrato pessoal" }, { status: 500 })
  }
}
