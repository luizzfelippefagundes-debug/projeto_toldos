import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { garantirColunasOrcamentos, garantirColunasLancamentos } from "@/lib/migracoes"
import { enviarMensagemWhatsapp } from "@/lib/evolution-api"
import { registrarMensagemBot } from "@/lib/bot-registro"
import { formatarMoeda } from "@/lib/format"

// Lembretes automáticos pro CLIENTE via WhatsApp (diferente de
// /api/cron/alertas, que avisa o dono por e-mail). Dispara uma vez por
// orçamento/conta — "faltam 2 dias" e "vence hoje" são janelas de um dia só,
// então não manda a mesma mensagem de novo no dia seguinte.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  await garantirColunasOrcamentos()
  await garantirColunasLancamentos()
  const sql = getSql()
  const hoje = new Date().toISOString().slice(0, 10)

  const orcamentosRows = await sql`
    SELECT o.numero, o.criado_em, o.validade_dias, c.id AS cliente_id, c.nome AS cliente_nome, c.telefone
    FROM orcamentos o JOIN clientes c ON c.id = o.cliente_id
    WHERE o.status = 'aberto' AND o.validade_dias IS NOT NULL
  `
  const vencendoEm2Dias = orcamentosRows.filter((o) => {
    const criado = new Date(o.criado_em as string)
    const validoAte = new Date(criado.getTime() + Number(o.validade_dias) * 24 * 60 * 60 * 1000)
    return validoAte.toISOString().slice(0, 10) === new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  })

  const contasRows = await sql`
    SELECT l.descricao, l.valor, l.cliente_id, c.nome AS cliente_nome, c.telefone
    FROM lancamentos_financeiros l JOIN clientes c ON c.id = l.cliente_id
    WHERE l.status = 'pendente' AND l.vencimento = ${hoje} AND l.origem = 'orcamento'
  `

  let enviados = 0

  for (const o of vencendoEm2Dias) {
    const telefone = o.telefone as string
    if (!telefone) continue
    const texto = `Oi, ${o.cliente_nome}! Passando pra lembrar que seu orçamento nº ${o.numero} da Toldos Print vence em 2 dias. Quer fechar ou precisa de mais um tempo?`
    await enviarMensagemWhatsapp(telefone, texto)
    await registrarMensagemBot({
      clienteId: o.cliente_id as string,
      clienteNome: o.cliente_nome as string,
      telefone,
      texto,
      origem: "lembrete",
      autor: "bot",
    })
    enviados++
  }

  for (const c of contasRows) {
    const telefone = c.telefone as string
    if (!telefone) continue
    const texto = `Oi, ${c.cliente_nome}! Lembrete: ${c.descricao}, no valor de ${formatarMoeda(Number(c.valor))}, vence hoje.`
    await enviarMensagemWhatsapp(telefone, texto)
    await registrarMensagemBot({
      clienteId: c.cliente_id as string,
      clienteNome: c.cliente_nome as string,
      telefone,
      texto,
      origem: "lembrete",
      autor: "bot",
    })
    enviados++
  }

  return NextResponse.json({ ok: true, enviados })
}
