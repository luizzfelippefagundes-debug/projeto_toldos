import { NextResponse } from "next/server"
import { restaurarExclusao } from "@/lib/historico-exclusoes"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }
    const res = await restaurarExclusao(id)
    if (!res.sucesso) {
      return NextResponse.json({ error: res.erro }, { status: 404 })
    }
    return NextResponse.json(res)
  } catch (err: unknown) {
    const mensagem = err instanceof Error ? err.message : "Erro interno ao restaurar"
    return NextResponse.json({ error: mensagem }, { status: 500 })
  }
}
