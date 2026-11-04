import { NextResponse } from "next/server"
import { enviarMensagemWhatsapp } from "@/lib/evolution-api"
import { registrarMensagemBot } from "@/lib/bot-registro"

export async function POST(request: Request) {
  const { telefone, mensagem, clienteId, clienteNome } = await request.json()

  if (!telefone || !mensagem) {
    return NextResponse.json({ erro: "telefone e mensagem são obrigatórios" }, { status: 400 })
  }

  await enviarMensagemWhatsapp(String(telefone), String(mensagem))

  await registrarMensagemBot({
    clienteId: clienteId ?? null,
    clienteNome: clienteNome ?? telefone,
    telefone: String(telefone),
    texto: String(mensagem),
    origem: "lembrete",
    autor: "bot",
  })

  return NextResponse.json({ ok: true })
}
