import { NextResponse } from "next/server"

export async function GET() {
  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, "")
  const apiKey = process.env.EVOLUTION_API_KEY
  const instancia = process.env.EVOLUTION_INSTANCE

  if (!baseUrl || !apiKey || !instancia) {
    return NextResponse.json({ erro: "configuração incompleta", baseUrl: !!baseUrl, apiKey: !!apiKey, instancia: !!instancia })
  }

  const res = await fetch(`${baseUrl}/webhook/find/${instancia}`, {
    headers: { apikey: apiKey },
  })

  const data = await res.json().catch(() => null)
  return NextResponse.json({ status: res.status, data })
}
