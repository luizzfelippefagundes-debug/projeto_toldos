import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import { enviarImagemWhatsapp } from "@/lib/evolution-api"
import { registrarMensagemBot } from "@/lib/bot-registro"

export async function POST(req: Request) {
  const { telefone, clienteId, clienteNome } = await req.json()

  if (!telefone) {
    return NextResponse.json({ erro: "telefone obrigatório" }, { status: 400 })
  }

  const imagemPath = path.join(process.cwd(), "public", "portfolio.jpeg")
  const buffer = await readFile(imagemPath)
  const base64 = buffer.toString("base64")

  await enviarImagemWhatsapp(
    telefone,
    base64,
    "🖨️ Conheça tudo que a *TOLDOSPRINT* oferece! Toldos, comunicação visual, fachadas e muito mais. Solicite seu orçamento: (27) 99748-9714"
  )

  if (clienteId) {
    await registrarMensagemBot({
      clienteId,
      clienteNome: clienteNome ?? "Cliente",
      telefone,
      texto: "portfólio enviado via sistema",
      origem: "lembrete",
      autor: "bot",
    })
  }

  return NextResponse.json({ ok: true })
}
