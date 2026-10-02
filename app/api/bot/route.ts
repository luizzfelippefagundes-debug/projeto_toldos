import { google } from "@ai-sdk/google"
import { generateText } from "ai"
import { NextResponse } from "next/server"

// Endpoint server-side do "Testar bot" (app/bot/page.tsx). A chave da API
// do Gemini fica só aqui, nunca no cliente — ver .env.example pra como
// configurar. Sem WhatsApp conectado ainda, isso só responde a pergunta
// digitada na própria tela; quando o canal entrar, é esse mesmo endpoint
// que processaria a mensagem recebida.
export async function POST(request: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json(
      {
        erro:
          "GOOGLE_GENERATIVE_AI_API_KEY não configurada. Veja .env.example.",
      },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => null)
  const pergunta = body?.pergunta
  if (typeof pergunta !== "string" || !pergunta.trim()) {
    return NextResponse.json({ erro: "Pergunta obrigatória" }, { status: 400 })
  }

  try {
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      system:
        "Você é o assistente de atendimento da Toldos Print, uma empresa de toldos e comunicação visual. " +
        "Responda em português, de forma curta e direta (no máximo 3 frases), como numa conversa de WhatsApp. " +
        "Use o contexto do pedido/orçamento fornecido, se houver, pra responder com precisão. " +
        "Se não souber algo com base no contexto, diga que vai verificar e responder em breve — não invente prazos ou valores.",
      prompt: body?.contexto
        ? `Contexto do pedido/orçamento: ${JSON.stringify(body.contexto)}\n\nPergunta do cliente: ${pergunta}`
        : `Pergunta do cliente: ${pergunta}`,
    })
    return NextResponse.json({ resposta: text })
  } catch {
    return NextResponse.json(
      { erro: "Não consegui falar com o Gemini agora. Tenta de novo." },
      { status: 502 }
    )
  }
}
