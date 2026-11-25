import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { criarLinkPagamentoMercadoPago } from "@/lib/mercadopago"
import { formatarNumeroOrcamento } from "@/lib/orcamento-pdf"
import { garantirColunasOrcamentos } from "@/lib/migracoes"

export async function POST(request: Request) {
  try {
    await garantirColunasOrcamentos()
    const { orcamentoId, valor, descricao, parcelasMaximas } = await request.json()

    if (!orcamentoId && (!valor || valor <= 0)) {
      return NextResponse.json({ erro: "orcamentoId ou valor válido é obrigatório" }, { status: 400 })
    }

    const sql = getSql()
    let clienteNome = "Cliente"
    let clienteEmail = "financeiro@toldosprint.com.br"
    let clienteCpf = ""
    let clienteTelefone = ""
    let valorCobrar = valor ? Number(valor) : 0
    let desc = descricao || "Pagamento Toldos Print"
    let externalRef = `link-${Date.now()}`

    if (orcamentoId) {
      const orcamentos = await sql`
        SELECT o.id, o.numero, o.criado_em, o.total_fechado, o.link_pagamento, o.mp_preference_id,
               c.nome as cliente_nome, c.email as cliente_email, c.cpf as cliente_cpf, c.telefone as cliente_telefone
        FROM orcamentos o
        LEFT JOIN clientes c ON c.id = o.cliente_id
        WHERE o.id = ${orcamentoId}
        LIMIT 1
      `

      if (orcamentos.length === 0) {
        return NextResponse.json({ erro: "Orçamento não encontrado" }, { status: 404 })
      }

      const o = orcamentos[0]
      clienteNome = String(o.cliente_nome || "Cliente")
      clienteEmail = String(o.cliente_email || clienteEmail)
      clienteCpf = String(o.cliente_cpf || "")
      clienteTelefone = String(o.cliente_telefone || "")
      if (!valorCobrar) {
        valorCobrar = Number(o.total_fechado || 0)
      }
      desc = `Orçamento #${formatarNumeroOrcamento(o.numero as number, o.criado_em as string)} - Toldos Print`
      externalRef = `orc-${o.id}`

      // Se já tem link de pagamento salvo e não foi pedido valor customizado, retorna o existente
      if (o.link_pagamento && (!valor || Number(valor) === Number(o.total_fechado))) {
        return NextResponse.json({
          ok: true,
          linkPagamento: o.link_pagamento,
          preferenciaId: o.mp_preference_id,
          valor: valorCobrar,
          descricao: desc,
        })
      }
    }

    const resMp = await criarLinkPagamentoMercadoPago({
      valor: valorCobrar,
      descricao: desc,
      clienteNome,
      clienteEmail,
      clienteCpf,
      clienteTelefone,
      externalReference: externalRef,
      parcelasMaximas: parcelasMaximas || 12,
    })

    if (!resMp.sucesso || !resMp.linkPagamento) {
      return NextResponse.json({ erro: resMp.aviso || "Falha ao gerar link no Mercado Pago" }, { status: 500 })
    }

    // Salva no orçamento
    if (orcamentoId) {
      await sql`
        UPDATE orcamentos SET
          link_pagamento = ${resMp.linkPagamento},
          mp_preference_id = ${resMp.preferenciaId || null}
        WHERE id = ${orcamentoId}
      `
    }

    return NextResponse.json({
      ok: true,
      linkPagamento: resMp.linkPagamento,
      preferenciaId: resMp.preferenciaId,
      valor: valorCobrar,
      descricao: desc,
    })
  } catch (err: any) {
    console.error("[criar-link] Erro:", err)
    return NextResponse.json({ erro: err?.message || "Erro ao gerar link de pagamento" }, { status: 500 })
  }
}
