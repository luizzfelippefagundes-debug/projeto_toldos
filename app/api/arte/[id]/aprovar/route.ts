import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { garantirColunasOrcamentos, garantirColunasPedidosRapidos } from "@/lib/migracoes"
import { registrarMensagemBot } from "@/lib/bot-registro"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const semPrefixo = id.startsWith("orc-") ? id.slice(4) : id
  const comPrefixo = id.startsWith("orc-") ? id : `orc-${id}`
  await garantirColunasOrcamentos()
  await garantirColunasPedidosRapidos()

  const sql = getSql()
  const agora = new Date().toISOString()

  // 1. Tenta achar em orcamentos (aceita tanto com 'orc-' quanto sem)
  const orcRows = await sql`
    SELECT * FROM orcamentos 
    WHERE id = ${id} OR id = ${comPrefixo} OR id = ${semPrefixo} 
    LIMIT 1
  `
  if (orcRows.length > 0) {
    const r = orcRows[0]
    await sql`
      UPDATE orcamentos
      SET status_producao = 'impressao',
          arte_aprovada_em = ${agora}
      WHERE id = ${r.id}
    `

    const cliRows = await sql`SELECT nome, telefone FROM clientes WHERE id = ${r.cliente_id} LIMIT 1`
    const tel = (cliRows[0]?.telefone as string) ?? null
    const nome = (cliRows[0]?.nome as string) ?? "Cliente"

    if (tel) {
      await registrarMensagemBot({
        clienteNome: nome,
        telefone: tel,
        texto: `✅ Arte do Orçamento #${r.numero} foi APROVADA pelo cliente! O pedido avançou para Impressão.`,
        origem: "automatica",
        autor: "bot",
      })
    }

    return NextResponse.json({
      sucesso: true,
      tipo: "orcamento",
      id: r.id,
      status: "impressao",
      aprovadoEm: agora,
    })
  }

  // 2. Tenta achar em pedidos_rapidos
  const pedRows = await sql`
    SELECT * FROM pedidos_rapidos 
    WHERE id = ${id} OR id = ${semPrefixo} OR id = ${comPrefixo} 
    LIMIT 1
  `
  if (pedRows.length > 0) {
    const p = pedRows[0]
    await sql`
      UPDATE pedidos_rapidos
      SET status = 'impressao',
          arte_aprovada_em = ${agora}
      WHERE id = ${p.id}
    `

    if (p.cliente_telefone) {
      await registrarMensagemBot({
        clienteNome: (p.cliente_nome as string) || "Cliente",
        telefone: p.cliente_telefone as string,
        texto: `✅ Arte do Pedido #${p.numero} foi APROVADA pelo cliente! O pedido avançou para Impressão.`,
        origem: "automatica",
        autor: "bot",
      })
    }

    return NextResponse.json({
      sucesso: true,
      tipo: "pedido",
      id: p.id,
      status: "impressao",
      aprovadoEm: agora,
    })
  }

  return NextResponse.json({ erro: "Pedido ou arte não encontrado" }, { status: 404 })
}
