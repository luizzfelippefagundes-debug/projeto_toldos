import { NextResponse } from "next/server"
import { segredoDaLojaValido } from "@/lib/loja-segredo"
import { listarPedidosDoSite } from "@/lib/pedidos-site"

// Para o /admin do site da loja: lista os pedidos que vieram do site.
// Exige o segredo compartilhado (x-loja-secret); sem ele, 401.
export async function GET(req: Request) {
  if (!process.env.LOJA_API_SECRET) {
    return NextResponse.json({ erro: "Integração da loja não configurada" }, { status: 503 })
  }
  if (!segredoDaLojaValido(req)) return NextResponse.json({ erro: "Não autorizado" }, { status: 401 })
  return NextResponse.json({ atualizadoEm: new Date().toISOString(), pedidos: await listarPedidosDoSite() }, { headers: { "Cache-Control": "no-store" } })
}
