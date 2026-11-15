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
      "A linha digitável numérica exata completa (47 dígitos para boleto bancário ou 48 dígitos para concessionárias de luz/água/telefone/tributos), ou o código de barras."
    ),
  blocosLinhaDigitavel: z
    .array(z.string())
    .nullable()
    .describe(
      "Os blocos ou campos numéricos separados exatamente como impressos com espaços ou pontos (para contas de água/luz/energia são 4 blocos de 12 dígitos; para boleto bancário são 5 blocos)."
    ),
  beneficiario: z
    .string()
    .nullable()
    .describe("Nome de quem recebe o pagamento (beneficiário/cedente/concessionária de água ou luz)"),
  cnpjCpfBeneficiario: z.string().nullable().describe("CNPJ ou CPF da empresa emissora"),
  valor: z.number().nullable().describe("Valor exato do documento em reais (ex: 70.20 ou 154.38)"),
  vencimento: z.string().nullable().describe("Data de vencimento exata impressa no documento (ex: 2026-11-25 ou 25/11/2026)"),
  mesReferencia: z.string().nullable().describe("Mês ou competência de referência (ex: '10/2026', 'Novembro/2026' ou '11/2026')"),
  numeroDocumento: z.string().nullable().describe("Número da fatura, conta, número do documento ou nota fiscal"),
  pixCopiaECola: z.string().nullable().describe("Código Pix Copia e Cola se houver QR Code Pix impresso"),
  pagador: z.string().nullable().describe("Nome de quem deve pagar"),
  instrucoes: z.string().nullable().describe("Instruções de multa, juros ou observações do documento"),
})

function normalizarDataISO(valor: string | null | undefined): string | undefined {
  if (!valor) return undefined
  const mIso = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor)
  if (mIso) return `${mIso[1]}-${mIso[2]}-${mIso[3]}`
  const mBr = /^(\d{2})[/-](\d{2})[/-](\d{4})/.exec(valor)
  if (mBr) return `${mBr[3]}-${mBr[2]}-${mBr[1]}`
  return undefined
}

function obterModelos() {
  const modelos: any[] = []
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY) {
    modelos.push(google("gemini-2.5-flash"))
    modelos.push(google("gemini-1.5-flash"))
  }
  if (process.env.OPENAI_API_KEY) {
    // GPT-4o tem visão de altíssima resolução para leitura precisa de números pequenos
    modelos.push(openai("gpt-4o"))
    modelos.push(openai("gpt-4o-mini"))
  }
  if (process.env.ANTHROPIC_API_KEY) {
    modelos.push(anthropic("claude-3-5-sonnet-latest"))
  }
  return modelos
}

export async function POST(req: Request) {
  const modelos = obterModelos()
  if (modelos.length === 0) {
    return NextResponse.json(
      {
        erro: "Serviço de leitura não configurado no servidor. Configure a chave de acesso no painel da Vercel ou no .env.local.",
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

  const modo = form?.get("modo") === "codigo_barras" ? "codigo_barras" : "completo"

  let lido: z.infer<typeof schema> | null = null
  let ultimoErro: any = null

  const conteudoArquivo =
    arquivo.type === "application/pdf"
      ? { type: "file" as const, data: bytes, mediaType: "application/pdf" }
      : { type: "image" as const, image: bytes, mediaType: arquivo.type }

  const textoInstrucaoUsuario =
    modo === "codigo_barras"
      ? "Esta imagem é um enquadramento focado de perto NO CÓDIGO DE BARRAS E LINHA DIGITÁVEL do boleto (como leitor de banco). Extraia com 100% de precisão numérica a LINHA DIGITÁVEL e o VALOR."
      : "Extraia todos os dados deste boleto de cobrança com máxima precisão numérica."

  for (const modelo of modelos) {
    try {
      const { output } = await generateText({
        model: modelo,
        temperature: 0,
        output: Output.object({ schema }),
        system:
          (modo === "codigo_barras"
            ? "ATENÇÃO: MODO LEITOR DE CÓDIGO DE BARRAS ATIVADO (ESTILO BANCO). A imagem enviada é um close-up focado no código de barras e nos números impressos da linha digitável. Concentre 100% da sua atenção na transcrição exata de TODOS os dígitos numéricos da linha digitável (47 dígitos para boleto bancário ou 48 dígitos para concessionária).\n\n"
            : "") +
          "Você é um perito em leitura, conferência e extração exata de boletos bancários brasileiros e contas de cobrança (energia, água, internet, impostos, fornecedores).\n\n" +
          "SUA META PRINCIPAL: Extrair com 100% de precisão TODOS os números da LINHA DIGITÁVEL, o VALOR EXATO com centavos, a DATA DE VENCIMENTO e os demais dados da fatura.\n\n" +
          "REGRAS DE EXTRAÇÃO DA LINHA DIGITÁVEL:\n" +
          "1. A Linha Digitável é a sequência de números impressa em destaque (geralmente no topo do boleto/recibo do sacado ou logo acima do código de barras). É O DADO MAIS IMPORTANTE DE TODOS.\n" +
          "2. BOLETOS BANCÁRIOS (47 DÍGITOS):\n" +
          "   - Muitos bancos (como SICOOB, cooperativas ou boletos compactos) imprimem os 47 dígitos CONTINUAMENTE SEM ESPAÇOS E SEM PONTOS (ex: 75691300780123727200838035480011214420000007000). Outros bancos (Bradesco, Itaú, Santander, Caixa, BB) imprimem com pontos e espaços (ex: 23793.38128 60083.013528 56006.333306 1 89760000015000). Em qualquer caso, capture TODOS os 47 dígitos sem faltar nenhum!\n" +
          "   - Estrutura matemática dos 5 campos (47 dígitos):\n" +
          "     * Campo 1: 10 dígitos (banco + moeda + 5 dígitos livres + DV)\n" +
          "     * Campo 2: 11 dígitos (10 dígitos livres + DV)\n" +
          "     * Campo 3: 11 dígitos (10 dígitos livres + DV)\n" +
          "     * Campo 4: 1 dígito (DV geral do código de barras)\n" +
          "     * Campo 5: 14 dígitos OBRIGATÓRIOS. Os 4 primeiros são o fator de vencimento, e os 10 ÚLTIMOS DÍGITOS SÃO O VALOR EM CENTAVOS com zeros à esquerda! (Ex: R$ 70,00 = '0000007000'; R$ 70,20 = '0000007020'; R$ 150,00 = '0000015000'). Preste extrema atenção na contagem exata de zeros no Campo 5.\n" +
          "3. CONTAS DE CONCESSIONÁRIA / TRIBUTOS (48 DÍGITOS, começam com 8):\n" +
          "   - Divididas em 4 blocos de 12 dígitos cada (ex: Água, Luz, Gás, Telefone, IPTU, DAS).\n\n" +
          "EXEMPLOS DE TREINAMENTO (FEW-SHOT):\n" +
          "• Exemplo SICOOB / Link Internet (dígitos contínuos sem espaços):\n" +
          "  Linha digitável: '75691300780123727200838035480011214420000007000'\n" +
          "  Beneficiário: 'LUIZ PAULO PANDOLFI CAPRINI - CNPJ: 20.740.818/0001-58'\n" +
          "  Pagador: 'MARINETH SILVA - CPF: 079.161.037-26'\n" +
          "  Vencimento: '10/05/2026'\n" +
          "  Valor: 70.00\n" +
          "  Mês de referência: '04/2026'\n" +
          "  Número do documento: '3627825'\n" +
          "  Instruções: 'Após vencimento cobrar 2% de multa por atraso. Após o vencimento cobrar juros de 0,33% ao dia.'\n\n" +
          "• Exemplo BRADESCO:\n" +
          "  Linha digitável: '23793.38128 60083.013528 56006.333308 8 89760000015000'\n" +
          "  Valor: 150.00\n" +
          "  Vencimento: '05/05/2022'\n\n" +
          "• Exemplo ITAÚ:\n" +
          "  Linha digitável: '34191.09008 00000.123456 78901.234567 8 98760000035025'\n" +
          "  Valor: 350.25\n\n" +
          "• Exemplo CONCESSIONÁRIA ENERGIA / LUZ (48 dígitos, começam com 8):\n" +
          "  Linha digitável: '846700000018 543801090113 004120150106 142010202604'\n" +
          "  Valor: 154.38\n\n" +
          "• Exemplo CONCESSIONÁRIA ÁGUA / SANEAMENTO (48 dígitos, começam com 8):\n" +
          "  Linha digitável: '826400000004 702000123456 789012345678 901234567890'\n" +
          "  Valor: 70.20\n\n" +
          "PIX COPIA E COLA:\n" +
          "Se houver QR Code Pix na fatura com código iniciado por '000201...', extraia a string completa no campo pixCopiaECola.",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: textoInstrucaoUsuario },
              conteudoArquivo,
            ],
          },
        ],
      })
      if (output) {
        lido = output
        break
      }
    } catch (err: any) {
      ultimoErro = err
      console.warn("Tentativa com modelo falhou, tentando próximo modelo...", err?.message)
    }
  }

  if (!lido) {
    console.error("Erro na leitura do boleto pela IA:", ultimoErro)
    return NextResponse.json(
      {
        erro:
          ultimoErro?.message?.includes("quota") || ultimoErro?.message?.includes("insufficient_quota")
            ? "Limite de cota da chave da OpenAI/Google atingido. Verifique os créditos."
            : ultimoErro?.message?.includes("unsupported") || ultimoErro?.message?.includes("PDF")
            ? "Para arquivos em PDF nativo, envie uma foto ou print nítido do documento."
            : "Não consegui ler o boleto agora. Verifique a iluminação e nitidez da imagem e tente novamente.",
      },
      { status: 502 }
    )
  }

  const avisos: string[] = []
  let digitosBrutos = lido?.linhaDigitavel ? apenasDigitos(lido.linhaDigitavel) : ""

  if (lido?.blocosLinhaDigitavel && lido.blocosLinhaDigitavel.length > 0) {
    const blocosLimpos = lido.blocosLinhaDigitavel.map(apenasDigitos)
    if (blocosLimpos.length === 5 && blocosLimpos[4] && blocosLimpos[4].length !== 14 && blocosLimpos[4].length >= 8) {
      const fator = blocosLimpos[4].slice(0, 4)
      const centavos = parseInt(blocosLimpos[4].slice(4), 10)
      if (!isNaN(centavos)) {
        blocosLimpos[4] = fator + centavos.toString().padStart(10, "0")
      }
    }
    const digitosBlocos = blocosLimpos.join("")
    if (
      (digitosBlocos.length === 47 || digitosBlocos.length === 48) &&
      digitosBrutos.length !== digitosBlocos.length
    ) {
      digitosBrutos = digitosBlocos
    }
  }

  let decodificado = digitosBrutos ? interpretarBoleto(digitosBrutos) : null

  // Se decodificado com linha contínua falhou, tenta os blocos normalizados
  if ((!decodificado || !decodificado.valido) && lido?.blocosLinhaDigitavel) {
    const blocosLimpos = lido.blocosLinhaDigitavel.map(apenasDigitos)
    if (blocosLimpos.length === 5 && blocosLimpos[4] && blocosLimpos[4].length >= 8) {
      const fator = blocosLimpos[4].slice(0, 4)
      const centavos = parseInt(blocosLimpos[4].slice(4), 10)
      if (!isNaN(centavos)) {
        blocosLimpos[4] = fator + centavos.toString().padStart(10, "0")
      }
    }
    const digitosBlocos = blocosLimpos.join("")
    const decodBlocos = interpretarBoleto(digitosBlocos)
    if (decodBlocos && decodBlocos.valido) {
      digitosBrutos = digitosBlocos
      decodificado = decodBlocos
    }
  }

  let valor = lido?.valor ?? undefined
  let vencimento = normalizarDataISO(lido?.vencimento)

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
    // Para concessionárias (água, luz, telefone), o código de barras NÃO codifica vencimento.
    // A data de vencimento impressa lida no documento é soberana.
    // Para boletos bancários com fator válido, valida com o do código de barras:
    if (decodificado.tipo === "bancario" && decodificado.vencimento) {
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
      mesReferencia: lido?.mesReferencia ?? undefined,
      pixCopiaECola: lido?.pixCopiaECola ?? undefined,
      instrucoes: lido?.instrucoes ?? undefined,
      numeroBoleto: numeroFormatado || undefined,
      valor,
      vencimento,
    },
    linhaValida: Boolean(decodificado?.valido),
    avisos,
  })
}
