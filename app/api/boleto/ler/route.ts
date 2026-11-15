import { anthropic } from "@ai-sdk/anthropic"
import { google } from "@ai-sdk/google"
import { openai } from "@ai-sdk/openai"
import { generateText, Output } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"
import { apenasDigitos, interpretarBoleto } from "@/lib/boleto"

// Lê um boleto (PDF ou foto). A IA multimodal (Google Gemini, OpenAI GPT-4o ou Claude)
// extrai os campos do documento e a linha digitável é decodificada e validada
// matematicamente em código (lib/boleto.ts): valor e vencimento do código de barras
// têm prioridade máxima de validação.

const TIPOS_ACEITOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]
const MAX_MB = 10

const schema = z.object({
  linhaDigitavel: z
    .string()
    .nullable()
    .describe("Linha digitável ou código de barras numérico, só os dígitos (47 ou 48 dígitos)"),
  beneficiario: z
    .string()
    .nullable()
    .describe("Nome de quem recebe o pagamento (beneficiário/cedente)"),
  cnpjCpfBeneficiario: z.string().nullable(),
  valor: z.number().nullable().describe("Valor do documento em reais"),
  vencimento: z.string().nullable().describe("Data de vencimento, YYYY-MM-DD"),
  numeroDocumento: z.string().nullable(),
  pagador: z.string().nullable().describe("Nome de quem deve pagar"),
})

function obterModelo() {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY) {
    return {
      modelo: google("gemini-2.5-flash"),
      provedor: "google" as const,
    }
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      modelo: openai("gpt-4o-mini"),
      provedor: "openai" as const,
    }
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      modelo: anthropic("claude-3-5-sonnet-latest"),
      provedor: "anthropic" as const,
    }
  }
  return null
}

export async function POST(req: Request) {
  const ia = obterModelo()
  if (!ia) {
    return NextResponse.json(
      {
        erro: "Nenhuma chave de IA configurada no servidor (GOOGLE_GENERATIVE_AI_API_KEY ou OPENAI_API_KEY). Adicione sua chave no painel da Vercel ou no .env.local.",
      },
      { status: 503 }
    )
  }

  const form = await req.formData().catch(() => null)
  const arquivo = form?.get("file")
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ erro: "Arquivo não enviado" }, { status: 400 })
  }
  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    return NextResponse.json(
      { erro: "Envie um PDF ou uma foto (JPG, PNG ou WebP)." },
      { status: 415 }
    )
  }
  if (arquivo.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json(
      { erro: `Arquivo maior que ${MAX_MB} MB` },
      { status: 413 }
    )
  }

  const bytes = new Uint8Array(await arquivo.arrayBuffer())

  let lido
  try {
    const conteudoArquivo =
      arquivo.type === "application/pdf"
        ? { type: "file" as const, data: bytes, mediaType: "application/pdf" }
        : { type: "image" as const, image: bytes, mediaType: arquivo.type }

    const { output } = await generateText({
      model: ia.modelo,
      output: Output.object({ schema }),
      system:
        "Você é um assistente especialista em extração precisa de dados de boletos bancários e contas brasileiras (energia, água, internet, impostos, fornecedores). " +
        "Copie os dados com exatidão cirúrgica exatamente como impressos no documento. " +
        "Se um campo não aparecer ou estiver ilegível, devolva null — nunca invente nada. " +
        "A linha digitável tem 47 dígitos (boleto bancário) ou 48 (concessionárias de água/luz/tributos); confira dígito por dígito.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia os dados deste boleto ou fatura de cobrança brasileira." },
            conteudoArquivo,
          ],
        },
      ],
    })
    lido = output
  } catch (err: any) {
    console.error("Erro na leitura do boleto pela IA:", err)
    return NextResponse.json(
      {
        erro:
          err?.message?.includes("unsupported") || err?.message?.includes("PDF")
            ? "Para arquivos em PDF nativo, configure a chave GOOGLE_GENERATIVE_AI_API_KEY ou envie uma foto/print do boleto."
            : "Não consegui ler o boleto agora. Verifique a imagem ou tente novamente.",
      },
      { status: 502 }
    )
  }

  const avisos: string[] = []
  const decodificado = lido?.linhaDigitavel
    ? interpretarBoleto(lido.linhaDigitavel)
    : null

  let valor = lido?.valor ?? undefined
  let vencimento = lido?.vencimento ?? undefined

  if (!lido?.linhaDigitavel) {
    avisos.push("Não encontrei a linha digitável com clareza — confira o valor e vencimento.")
  } else if (!decodificado || !decodificado.valido) {
    avisos.push(
      "A linha digitável lida não passou na verificação automática dos dígitos. Confira o número, o valor e o vencimento."
    )
  } else {
    if (decodificado.valor !== undefined) {
      if (valor !== undefined && Math.abs(valor - decodificado.valor) > 0.005) {
        avisos.push(
          `O valor impresso (R$ ${valor.toFixed(2)}) difere do código de barras (R$ ${decodificado.valor.toFixed(2)}). Foi utilizado o valor do código de barras.`
        )
      }
      valor = decodificado.valor
    }
    if (decodificado.vencimento) {
      if (vencimento && vencimento !== decodificado.vencimento) {
        avisos.push(
          "O vencimento impresso difere do código de barras. Foi utilizado o do código de barras."
        )
      }
      vencimento = decodificado.vencimento
    }
  }

  return NextResponse.json({
    campos: {
      beneficiario: lido?.beneficiario ?? undefined,
      cnpjCpfBeneficiario: lido?.cnpjCpfBeneficiario ?? undefined,
      pagador: lido?.pagador ?? undefined,
      numeroDocumento: lido?.numeroDocumento ?? undefined,
      numeroBoleto: lido?.linhaDigitavel
        ? apenasDigitos(lido.linhaDigitavel)
        : undefined,
      valor,
      vencimento,
    },
    linhaValida: Boolean(decodificado?.valido),
    avisos,
  })
}
