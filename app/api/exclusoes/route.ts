import { NextResponse } from "next/server"
import { listarExclusoes, restaurarExclusao } from "@/lib/historico-exclusoes"

// Só o dono acessa (ver `apiSoDono` em proxy.ts).
export async function GET() {
  return NextResponse.json(await listarExclusoes())
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const id = body?.id
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "ID da exclusão é obrigatório" }, { status: 400 })
    }
    const res = await restaurarExclusao(id)
    if (!res.sucesso) {
      return NextResponse.json({ error: res.erro }, { status: 404 })
    }
    return NextResponse.json(res)
  } catch (err: unknown) {
    const mensagem = err instanceof Error ? err.message : "Erro interno ao restaurar registro"
    return NextResponse.json({ error: mensagem }, { status: 500 })
  }
}
