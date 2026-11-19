import { NextResponse } from "next/server"
import { gerarCodigoPareamento } from "@/lib/evolution-api"

export async function POST(req: Request) {
  const { numero } = (await req.json().catch(() => ({}))) as { numero?: string }
  if (!numero || numero.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ erro: "Número de telefone com DDD obrigatório" }, { status: 400 })
  }

  const res = await gerarCodigoPareamento(numero)
  if (!res.ok) {
    return NextResponse.json({ erro: res.erro }, { status: 500 })
  }

  return NextResponse.json({ code: res.code })
}
