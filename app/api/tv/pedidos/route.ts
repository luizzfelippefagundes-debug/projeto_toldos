import { NextResponse } from "next/server"
import { getSql } from "@/lib/db"

const STATUS_VISIVEIS = ["aguardando", "aprovado", "arte", "impressao", "acabamento", "pronto"]

export async function GET() {
  const rows = await getSql()`
    SELECT id, numero, cliente_nome, produto_nome, variante_nome,
           acabamento, observacao, status, criado_em, prazo_entrega_em, total
    FROM pedidos_rapidos
    WHERE status = ANY(${STATUS_VISIVEIS})
    ORDER BY
      CASE WHEN prazo_entrega_em IS NOT NULL AND prazo_entrega_em < ${new Date().toISOString().slice(0, 10)} THEN 0 ELSE 1 END,
      prazo_entrega_em ASC NULLS LAST,
      criado_em ASC
  `
  return NextResponse.json(rows, {
    headers: { "Cache-Control": "no-store" },
  })
}
