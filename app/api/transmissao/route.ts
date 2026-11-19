import { NextResponse } from "next/server"
import { enviarMensagemWhatsapp, enviarImagemWhatsapp } from "@/lib/evolution-api"

export async function POST(req: Request) {
  const { mensagem, telefones, imagem } = (await req.json()) as {
    mensagem?: string
    telefones: string[]
    imagem?: string
  }

  const texto = mensagem?.trim() || ""
  const temImagem = Boolean(imagem?.trim())

  if ((!texto && !temImagem) || !Array.isArray(telefones) || telefones.length === 0) {
    return NextResponse.json({ erro: "mensagem ou imagem e telefones são obrigatórios" }, { status: 400 })
  }

  const resultados: { telefone: string; ok: boolean }[] = []

  for (const tel of telefones) {
    try {
      let resultado: { ok: boolean }
      if (temImagem && imagem) {
        resultado = await enviarImagemWhatsapp(tel, imagem, texto || undefined)
      } else {
        resultado = await enviarMensagemWhatsapp(tel, texto)
      }
      resultados.push({ telefone: tel, ok: resultado.ok })
    } catch {
      resultados.push({ telefone: tel, ok: false })
    }
    // Pausa entre envios para não sobrecarregar a instância
    await new Promise((r) => setTimeout(r, 350))
  }

  const enviados = resultados.filter((r) => r.ok).length
  const falhas = resultados.filter((r) => !r.ok).length

  return NextResponse.json({ enviados, falhas, resultados })
}
