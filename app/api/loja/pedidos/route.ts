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
  // ?conta=user_xxx devolve só os pedidos daquele login (usado em "Meus pedidos").
  const conta = new URL(req.url).searchParams.get("conta") ?? undefined
  if (conta !== undefined && !/^user_[A-Za-z0-9]+$/.test(conta)) {
    return NextResponse.json({ erro: "Conta inválida" }, { status: 400 })
  }
  return NextResponse.json(
    { atualizadoEm: new Date().toISOString(), pedidos: await listarPedidosDoSite({ conta }) },
    { headers: { "Cache-Control": "no-store" } }
  )
}
