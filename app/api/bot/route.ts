import { google } from "@ai-sdk/google"
import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"
import { NextResponse } from "next/server"
import { SERVICOS_TEXTO } from "@/lib/bot-whatsapp"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const pergunta = body?.pergunta
  if (typeof pergunta !== "string" || !pergunta.trim()) {
    return NextResponse.json({ erro: "Pergunta obrigatória" }, { status: 400 })
  }

  const modelo = process.env.OPENAI_API_KEY
    ? openai("gpt-4o-mini")
    : (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY)
    ? google("gemini-2.0-flash")
    : null

  if (!modelo) {
    return NextResponse.json(
      {
        erro: "Chave de inteligência artificial não configurada no servidor (OPENAI_API_KEY ou GEMINI_API_KEY).",
      },
      { status: 503 }
    )
  }

  try {
    const { text } = await generateText({
      model: modelo,
      system:
        "Você é o atendente virtual da TOLDOSPRINT (Toldos e Comunicação Visual), respondendo pelo WhatsApp de forma profissional, ágil e acolhedora.\n\n" +
        "FLUXO DO ATENDIMENTO:\n" +
        "1. Se o cliente enviar saudação inicial, responda:\n" +
        "'Seja bem-vindo a TOLDOSPRINT (Toldos e Comunicação Visual)! 🤝✨\n\nQual seu nome e de qual cidade, bairro está falando?'\n\n" +
        "2. Se ele informar nome e cidade/bairro, agradeça e apresente os SERVIÇOS mais utilizados:\n" +
        `${SERVICOS_TEXTO}\n\nComo posso te ajudar?\n\n` +
        "3. Se ele solicitar orçamento ou disser o que precisa:\n" +
        "'Perfeito! Para facilitar e agilizar o seu orçamento:\n📸 Tire uma foto do que se trata ou deseja;\n📏 Tenha em mãos medidas ou projetos (se tiver).\n\nJá estou transferindo o seu atendimento para nossa equipe. Em breve vamos entrar em contato com você por aqui! ⏳🧑‍💼'",
      prompt: body?.contexto
        ? `Contexto: ${JSON.stringify(body.contexto)}\n\nMensagem do cliente: ${pergunta}`
        : `Mensagem do cliente: ${pergunta}`,
    })
    return NextResponse.json({ resposta: text })
  } catch (err: any) {
    console.error("[api/bot] erro gerando resposta:", err)
    return NextResponse.json(
      { erro: "Não consegui processar a resposta agora. Tente novamente." },
      { status: 502 }
    )
  }
}
