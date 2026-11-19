import { NextResponse } from "next/server"
import { gerarCodigoPareamento, verificarStatusInstancia, reiniciarInstancia } from "@/lib/evolution-api"

export async function GET() {
  const status = await verificarStatusInstancia()
  return NextResponse.json(status)
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { numero?: string; acao?: string }

  if (body.acao === "reiniciar") {
    const res = await reiniciarInstancia()
    return NextResponse.json(res)
  }

  const { numero } = body
  if (!numero || numero.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ erro: "Número de telefone com DDD obrigatório" }, { status: 400 })
  }

  const res = await gerarCodigoPareamento(numero)
  if (!res.ok) {
    return NextResponse.json({ erro: res.erro }, { status: 500 })
  }

  return NextResponse.json({ code: res.code, qrBase64: res.qrBase64 })
}
