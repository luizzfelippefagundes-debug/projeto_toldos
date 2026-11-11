import { anthropic } from "@ai-sdk/anthropic"
import { generateText, Output } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"
import { apenasDigitos, interpretarBoleto } from "@/lib/boleto"

// Lê um boleto (PDF ou foto). O Claude extrai os campos do documento e a
// linha digitável é decodificada em código (lib/boleto.ts): valor e
// vencimento vindos dela valem mais que os lidos pela IA, que só avisa
// quando as duas leituras divergem. A chave fica só aqui no servidor.

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
    .describe("Linha digitável ou código de barras numérico, só os dígitos"),
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

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { erro: "ANTHROPIC_API_KEY não configurada. Veja .env.example." },
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
    const { output } = await generateText({
      model: anthropic("claude-sonnet-5-5"),
      output: Output.object({ schema }),
      system:
        "Você extrai dados de boletos de cobrança brasileiros. " +
        "Copie os dados exatamente como estão impressos no documento; " +
        "se um campo não aparecer ou estiver ilegível, devolva null — nunca invente. " +
        "A linha digitável tem 47 dígitos (boleto bancário) ou 48 (concessionária); " +
        "confira dígito a dígito.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia os dados deste boleto." },
            arquivo.type === "application/pdf"
              ? { type: "file", data: bytes, mediaType: "application/pdf" }
              : { type: "image", image: bytes, mediaType: arquivo.type },
          ],
        },
      ],
    })
    lido = output
  } catch {
    return NextResponse.json(
      { erro: "Não consegui ler o boleto agora. Tente de novo ou preencha à mão." },
      { status: 502 }
    )
  }

  const avisos: string[] = []
  const decodificado = lido.linhaDigitavel
    ? interpretarBoleto(lido.linhaDigitavel)
    : null

  let valor = lido.valor ?? undefined
  let vencimento = lido.vencimento ?? undefined

  if (!lido.linhaDigitavel) {
    avisos.push("Não encontrei a linha digitável — confira valor e vencimento.")
  } else if (!decodificado || !decodificado.valido) {
    avisos.push(
      "A linha digitável lida não passou na verificação dos dígitos. Confira o número, o valor e o vencimento com o boleto."
    )
  } else {
    if (decodificado.valor !== undefined) {
      if (valor !== undefined && Math.abs(valor - decodificado.valor) > 0.005) {
        avisos.push(
          `O valor impresso (R$ ${valor.toFixed(2)}) difere do valor do código de barras (R$ ${decodificado.valor.toFixed(2)}). Usei o do código de barras.`
        )
      }
      valor = decodificado.valor
    }
    if (decodificado.vencimento) {
      if (vencimento && vencimento !== decodificado.vencimento) {
        avisos.push(
          "O vencimento impresso difere do vencimento do código de barras. Usei o do código de barras."
        )
      }
      vencimento = decodificado.vencimento
    }
  }

  return NextResponse.json({
    campos: {
      beneficiario: lido.beneficiario ?? undefined,
      cnpjCpfBeneficiario: lido.cnpjCpfBeneficiario ?? undefined,
      pagador: lido.pagador ?? undefined,
      numeroDocumento: lido.numeroDocumento ?? undefined,
      numeroBoleto: lido.linhaDigitavel
        ? apenasDigitos(lido.linhaDigitavel)
        : undefined,
      valor,
      vencimento,
    },
    linhaValida: Boolean(decodificado?.valido),
    avisos,
  })
}
