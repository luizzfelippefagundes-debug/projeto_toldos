import { anthropic } from "@ai-sdk/anthropic"
import { google } from "@ai-sdk/google"
import { openai } from "@ai-sdk/openai"
import { generateText, Output } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"
import { apenasDigitos, formatarLinhaDigitavel, interpretarBoleto } from "@/lib/boleto"

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
    .describe(
      "A linha digitável numérica exata (47 dígitos para boleto bancário ou 48 dígitos para concessionárias de luz/água/telefone), copiada dígito a dígito."
    ),
  beneficiario: z
    .string()
    .nullable()
    .describe("Nome de quem recebe o pagamento (beneficiário/cedente)"),
  cnpjCpfBeneficiario: z.string().nullable(),
  valor: z.number().nullable().describe("Valor exato do documento em reais (ex: 70.20)"),
  vencimento: z.string().nullable().describe("Data de vencimento exata no formato YYYY-MM-DD"),
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
    // Usar GPT-4o completo com visão de alta resolução para OCR exato de todos os 47 dígitos
    return {
      modelo: openai("gpt-4o"),
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
        "Você é um perito em leitura, conferência e extração exata de boletos bancários brasileiros e contas de cobrança (energia, água, internet, impostos, fornecedores).\n\n" +
        "SUA META PRINCIPAL: Extrair com 100% de precisão TODOS os números da LINHA DIGITÁVEL e o VALOR EXATO com centavos.\n\n" +
        "COMO EXTRAIR A LINHA DIGITÁVEL:\n" +
        "1. A Linha Digitável é a sequência de números impressa em destaque (geralmente no topo do boleto/recibo do sacado ou logo acima do código de barras). É O DADO MAIS IMPORTANTE DE TODOS.\n" +
        "2. BOLETOS BANCÁRIOS (47 dígitos): divididos em 5 campos:\n" +
        "   - Campo 1: 5 dígitos + ponto + 5 dígitos\n" +
        "   - Campo 2: 5 dígitos + ponto + 6 dígitos\n" +
        "   - Campo 3: 5 dígitos + ponto + 6 dígitos\n" +
        "   - Campo 4: 1 dígito verificador geral\n" +
        "   - Campo 5: 14 dígitos (os 4 primeiros são o fator de vencimento, e os 10 ÚLTIMOS DÍGITOS SÃO OBRIGATORIAMENTE O VALOR EM CENTAVOS). Por exemplo, para um boleto de R$ 70,20, o Campo 5 TERMINA OBRIGATORIAMENTE EM '0000007020'. Use essa regra matemática para conferir e garantir que todos os dígitos do valor estão 100% corretos!\n" +
        "3. CONTAS DE CONCESSIONÁRIA / TRIBUTOS (48 dígitos, começam com 8):\n" +
        "   - Divididas em 4 blocos de 12 dígitos cada.\n" +
        "4. NÃO confunda com o código de barras contínuo de 44 dígitos; leia a LINHA DIGITÁVEL numérica de 47 ou 48 dígitos.\n" +
        "5. Copie dígito por dígito exatamente como impresso.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia todos os dados deste boleto de cobrança com máxima precisão numérica." },
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
  const digitosBrutos = lido?.linhaDigitavel ? apenasDigitos(lido.linhaDigitavel) : ""
  const decodificado = digitosBrutos ? interpretarBoleto(digitosBrutos) : null

  let valor = lido?.valor ?? undefined
  let vencimento = lido?.vencimento ?? undefined

  if (!digitosBrutos) {
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

  // Linha final validada (se o decodificador tiver reconstruído perfeitamente ou a lida)
  const linhaParaFormatar = decodificado?.linhaDigitavel || digitosBrutos
  const numeroFormatado = formatarLinhaDigitavel(linhaParaFormatar)

  return NextResponse.json({
    campos: {
      beneficiario: lido?.beneficiario ?? undefined,
      cnpjCpfBeneficiario: lido?.cnpjCpfBeneficiario ?? undefined,
      pagador: lido?.pagador ?? undefined,
      numeroDocumento: lido?.numeroDocumento ?? undefined,
      numeroBoleto: numeroFormatado || undefined,
      valor,
      vencimento,
    },
    linhaValida: Boolean(decodificado?.valido),
    avisos,
  })
}
