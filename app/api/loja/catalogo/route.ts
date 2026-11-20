import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"

// Preços que o site da loja (loja_toldosprint) mostra. Só leitura e sem
// custo, estoque ou dados de cliente: é o mesmo preço que o cliente recebe
// no orçamento.
export async function GET() {
  const sql = getSql()
  const [materiais, rapidos] = await Promise.all([
    sql`SELECT id, nome, tipo, unidade, preco_unitario FROM materiais ORDER BY nome`,
    sql`SELECT id, nome, categoria, prazo_dias, variantes FROM produtos_rapidos ORDER BY nome`,
  ])
  return NextResponse.json(
    {
      atualizadoEm: new Date().toISOString(),
      materiais: materiais.map((m) => ({
        id: m.id,
        nome: m.nome,
        tipo: m.tipo,
        unidade: m.unidade,
        precoUnitario: Number(m.preco_unitario),
      })),
      produtosRapidos: rapidos.map((p) => ({
        id: p.id,
        nome: p.nome,
        categoria: p.categoria,
        prazoDias: p.prazo_dias,
        variantes: p.variantes,
      })),
    },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  )
}
