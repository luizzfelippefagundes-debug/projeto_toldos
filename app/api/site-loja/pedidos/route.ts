import { NextResponse } from "next/server"
import { listarPedidosDoSite } from "@/lib/pedidos-site"

// Para o painel "Site da loja" do sistema. Exige login (não está na lista pública do proxy).
export async function GET() {
  return NextResponse.json({ atualizadoEm: new Date().toISOString(), pedidos: await listarPedidosDoSite() })
}
