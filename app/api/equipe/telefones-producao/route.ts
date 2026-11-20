import { NextResponse } from "next/server"
import { obterTelefonesProducao, salvarTelefonesProducao } from "@/lib/notificacoes-producao"

export async function GET() {
  try {
    const telefones = await obterTelefonesProducao()
    return NextResponse.json({ telefones })
  } catch (err: any) {
    return NextResponse.json({ erro: err?.message || "Erro ao obter telefones" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { telefones } = body
    if (!Array.isArray(telefones)) {
      return NextResponse.json({ erro: "Lista de telefones inválida" }, { status: 400 })
    }
    await salvarTelefonesProducao(telefones)
    return NextResponse.json({ ok: true, telefones })
  } catch (err: any) {
    return NextResponse.json({ erro: err?.message || "Erro ao salvar telefones" }, { status: 500 })
  }
}
