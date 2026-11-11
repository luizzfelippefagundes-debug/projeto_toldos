import { NextResponse } from "next/server"
import { enviarMensagemWhatsapp } from "@/lib/evolution-api"

export async function POST(req: Request) {
  const { mensagem, telefones } = (await req.json()) as {
    mensagem: string
    telefones: string[]
  }

  if (!mensagem?.trim() || !Array.isArray(telefones) || telefones.length === 0) {
    return NextResponse.json({ erro: "mensagem e telefones obrigatórios" }, { status: 400 })
  }

  const resultados: { telefone: string; ok: boolean }[] = []

  for (const tel of telefones) {
    try {
      await enviarMensagemWhatsapp(tel, mensagem.trim())
      resultados.push({ telefone: tel, ok: true })
    } catch {
      resultados.push({ telefone: tel, ok: false })
    }
    // Pausa entre envios para não derrubar a instância
    await new Promise((r) => setTimeout(r, 300))
  }

  const enviados = resultados.filter((r) => r.ok).length
  const falhas = resultados.filter((r) => !r.ok).length

  return NextResponse.json({ enviados, falhas, resultados })
}
