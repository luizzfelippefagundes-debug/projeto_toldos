import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"
import { garantirColunasOrcamentos } from "@/lib/migracoes"
import { formatarNumeroOrcamento } from "@/lib/orcamento-pdf"
import { resumirPedidoLoja } from "@/lib/loja-orcamento"

// Pedidos de orçamento que chegaram pelo site (origem "loja"), para o painel
// "Site da loja". Exige login (não está na lista pública do proxy).
export async function GET() {
  await garantirColunasOrcamentos()
  const linhas = await getSql()`
    SELECT o.id, o.numero, o.criado_em, o.status, o.retorno, o.total_fechado, o.observacao,
           c.id AS cliente_id, c.nome AS cliente_nome, c.telefone AS cliente_telefone
    FROM orcamentos o
    LEFT JOIN clientes c ON c.id = o.cliente_id
    WHERE o.origem = 'loja'
    ORDER BY o.numero DESC
    LIMIT 200
  `
  const pedidos = linhas.map((r) => {
    const resumo = resumirPedidoLoja(r.observacao as string | null)
    const numero = Number(r.numero)
    const status = String(r.status)
    // "Novo" = ninguém mexeu ainda: aberto e sem acompanhamento em Retornos.
    const novo = status === "aberto" && !r.retorno
    return {
      id: String(r.id),
      numero,
      numeroFormatado: formatarNumeroOrcamento(numero, String(r.criado_em)),
      criadoEm: String(r.criado_em),
      status,
      novo,
      totalFechado: r.total_fechado != null ? Number(r.total_fechado) : null,
      cliente: { id: r.cliente_id ? String(r.cliente_id) : null, nome: String(r.cliente_nome ?? "Cliente"), telefone: String(r.cliente_telefone ?? "") },
      resumo,
    }
  })
  return NextResponse.json({ atualizadoEm: new Date().toISOString(), pedidos })
}
