import { NextRequest, NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { getSql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const clerk = await clerkClient()
    const user = await clerk.users.getUser(userId)
    const papelReal = (user.publicMetadata?.papel as string) || "dono"

    // Se for o dono simulando ou se passar query ?colaborador=...
    const url = new URL(request.url)
    const colaboradorParam = url.searchParams.get("colaborador")

    let targetNome = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || user.primaryEmailAddress?.emailAddress || "Colaborador"
    let targetPrimeiroNome = user.firstName || targetNome.split(" ")[0] || "Colaborador"
    let targetId = userId

    if (papelReal === "dono" && colaboradorParam && colaboradorParam !== "todos") {
      targetNome = colaboradorParam
      targetPrimeiroNome = colaboradorParam.split(" ")[0]
      targetId = colaboradorParam
    }

    const sql = getSql()

    // Buscar comissões do colaborador alvo (por ID ou correspondência de nome case-insensitive)
    const termoNome = `%${targetPrimeiroNome}%`
    const termoCompleto = `%${targetNome}%`

    const comissoes = await sql`
      SELECT id, numero, cliente_nome, produto_nome, valor_pedido, comissao_percent, valor_comissao, status, pago_em, recibo_id, criado_em
      FROM comissoes_producao
      WHERE colaborador_id = ${targetId}
         OR colaborador_nome ILIKE ${termoCompleto}
         OR colaborador_nome ILIKE ${termoNome}
      ORDER BY criado_em DESC
    `

    // Buscar recibos emitidos para este colaborador
    const recibos = await sql`
      SELECT id, numero_recibo, valor_total, forma_pagamento, tipo_assinatura, assinado_em, criado_em, pago_por
      FROM recibos_comissao
      WHERE colaborador_id = ${targetId}
         OR colaborador_nome ILIKE ${termoCompleto}
         OR colaborador_nome ILIKE ${termoNome}
      ORDER BY criado_em DESC
    `

    const itensPendentes = comissoes.filter((c: any) => c.status === "pendente")
    const itensPagos = comissoes.filter((c: any) => c.status === "pago")

    const totalPendente = itensPendentes.reduce((acc: number, c: any) => acc + (Number(c.valor_comissao) || 0), 0)
    const totalPago = itensPagos.reduce((acc: number, c: any) => acc + (Number(c.valor_comissao) || 0), 0)

    return NextResponse.json({
      colaborador: {
        id: targetId,
        nome: targetNome,
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
