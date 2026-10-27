import { NextResponse } from "next/server"
import { Resend } from "resend"
import { getSql } from "@/lib/db"
import { garantirColunasOrcamentos } from "@/lib/migracoes"
import { retornoDoOrcamento, situacaoContato } from "@/lib/retornos"
import type { Orcamento } from "@/lib/types"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(req: Request) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const destino = process.env.ALERT_EMAIL
  if (!destino) return NextResponse.json({ ok: true, skipped: "sem ALERT_EMAIL" })

  await garantirColunasOrcamentos()
  const sql = getSql()
  const agora = new Date()
  const em3Dias = new Date(agora.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const hoje = agora.toISOString().slice(0, 10)

  const [orcamentosRows, lancamentosRows, pedidosRows, emitidosRows] = await Promise.all([
    sql`
      SELECT o.numero, c.nome AS cliente_nome, o.validade_dias, o.criado_em
      FROM orcamentos o
      JOIN clientes c ON c.id = o.cliente_id
      WHERE o.status = 'aberto' AND o.validade_dias IS NOT NULL
    `,
    sql`
      SELECT descricao, tipo, valor, vencimento, forma_pagamento
      FROM lancamentos_financeiros
      WHERE status = 'pendente' AND vencimento <= ${em3Dias}
      ORDER BY vencimento ASC
    `,
    sql`
      SELECT numero, produto_nome, cliente_nome, prazo_entrega_em
      FROM pedidos_rapidos
      WHERE status != 'entregue' AND prazo_entrega_em IS NOT NULL AND prazo_entrega_em < ${hoje}
    `,
    sql`
      SELECT o.numero, o.status, o.criado_em, o.fechado_em, o.retorno,
             c.nome AS cliente_nome, c.telefone
      FROM orcamentos o
      JOIN clientes c ON c.id = o.cliente_id
      WHERE o.status = 'fechado'
    `,
  ])

  // Quadro Retornos: clientes pra contatar hoje ou com contato atrasado.
  const retornosPendentes = emitidosRows.filter((o) => {
    const retorno = retornoDoOrcamento({
      status: "fechado",
      criadoEm: o.criado_em as string,
      fechadoEm: (o.fechado_em as string) ?? null,
      retorno: (o.retorno as Orcamento["retorno"]) ?? undefined,
    } as Orcamento)
    const situacao = situacaoContato(retorno, agora)
    return situacao === "hoje" || situacao === "atrasado"
  })

  // Filtra orçamentos vencendo em 3 dias
  const orcamentosVencendo = orcamentosRows.filter((o) => {
    const criado = new Date(o.criado_em as string)
    const validoAte = new Date(criado.getTime() + Number(o.validade_dias) * 24 * 60 * 60 * 1000)
    const diffMs = validoAte.getTime() - agora.getTime()
    return diffMs >= 0 && diffMs <= 3 * 24 * 60 * 60 * 1000
  })

  const semAlertas =
    orcamentosVencendo.length === 0 &&
    lancamentosRows.length === 0 &&
    pedidosRows.length === 0 &&
    retornosPendentes.length === 0
  if (semAlertas) return NextResponse.json({ ok: true, skipped: "sem alertas" })

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  const fmtData = (d: string) => new Date(d).toLocaleDateString("pt-BR")

  const secRetornos = retornosPendentes.length > 0 ? `
    <h3 style="color:#2563eb;margin:16px 0 8px">📞 Clientes pra retornar sobre orçamento</h3>
    <ul>${retornosPendentes.map((o) => `<li>#${o.numero} — ${o.cliente_nome}${o.telefone ? ` — ${o.telefone}` : ""}</li>`).join("")}</ul>
  ` : ""

  const secOrcamentos = orcamentosVencendo.length > 0 ? `
    <h3 style="color:#b45309;margin:16px 0 8px">⚠️ Orçamentos vencendo em 3 dias</h3>
    <ul>${orcamentosVencendo.map((o) => `<li>#${o.numero} — ${o.cliente_nome}</li>`).join("")}</ul>
  ` : ""

  const secLancamentos = lancamentosRows.length > 0 ? `
    <h3 style="color:#dc2626;margin:16px 0 8px">💸 Contas vencendo / vencidas</h3>
    <ul>${lancamentosRows.map((l) => `<li>${l.descricao} — ${fmt(Number(l.valor))} — vence ${fmtData(l.vencimento as string)}${l.forma_pagamento === "boleto" ? " 🔴 BOLETO" : ""}</li>`).join("")}</ul>
  ` : ""

  const secPedidos = pedidosRows.length > 0 ? `
    <h3 style="color:#dc2626;margin:16px 0 8px">🏭 Pedidos atrasados</h3>
    <ul>${pedidosRows.map((p) => `<li>#${p.numero} ${p.produto_nome ?? ""} — ${p.cliente_nome} — prazo ${fmtData(p.prazo_entrega_em as string)}</li>`).join("")}</ul>
  ` : ""

  const html = `
    <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/></head>
    <body style="font-family:sans-serif;color:#111;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#2b7fff;border-radius:8px;padding:16px 24px;margin-bottom:24px">
        <h1 style="color:#fff;margin:0;font-size:18px">Toldos Print — Alertas do dia</h1>
        <p style="color:#c7dcff;margin:4px 0 0;font-size:13px">${agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>
      ${secRetornos}${secOrcamentos}${secLancamentos}${secPedidos}
    </body></html>
  `

  const { error } = await resend.emails.send({
    from: "Toldos Print <onboarding@resend.dev>",
    to: [destino],
    subject: `Alertas Toldos Print — ${agora.toLocaleDateString("pt-BR")}`,
    html,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
