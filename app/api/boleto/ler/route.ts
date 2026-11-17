import { anthropic } from "@ai-sdk/anthropic"
import { google } from "@ai-sdk/google"
import { openai } from "@ai-sdk/openai"
import { generateText, Output } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"
import { apenasDigitos, formatarLinhaDigitavel, interpretarBoleto } from "@/lib/boleto"
import { reconciliarBoleto } from "@/lib/boleto-reconciliar"
import { extrairDadosBoletoPdf } from "@/lib/boleto-pdf"

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
const MAX_MB = 20

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
  if (!valor || typeof valor !== "string") return undefined
  const limpo = valor.trim()

  // 1. Formato ISO: 2026-11-28 ou 2026/11/28 ou 2026.11.28
  const mIso = /(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(limpo)
  if (mIso) {
    const ano = mIso[1]
    const mes = mIso[2].padStart(2, "0")
    const dia = mIso[3].padStart(2, "0")
    return `${ano}-${mes}-${dia}`
  }

  // 2. Formato brasileiro: 28/11/2026, 28-11-2026, 28.11.2026
  const mBr = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(limpo)
  if (mBr) {
    const dia = mBr[1].padStart(2, "0")
    const mes = mBr[2].padStart(2, "0")
    const ano = mBr[3]
    return `${ano}-${mes}-${dia}`
  }

  // 3. Formato com ano de 2 dígitos: 28/11/26
  const mBr2 = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})\b/.exec(limpo)
  if (mBr2) {
    const dia = mBr2[1].padStart(2, "0")
    const mes = mBr2[2].padStart(2, "0")
    const ano = Number(mBr2[3]) >= 70 ? `19${mBr2[3]}` : `20${mBr2[3]}`
    return `${ano}-${mes}-${dia}`
  }

  // 4. Formato por extenso: "28 de novembro de 2026", "13 de nov de 2026", "13 nov 2026"
  const mesesNome: Record<string, string> = {
    jan: "01", janeiro: "01",
    fev: "02", fevereiro: "02",
    mar: "03", marco: "03", março: "03",
    abr: "04", abril: "04",
    mai: "05", maio: "05",
    jun: "06", junho: "06",
    jul: "07", julho: "07",
    ago: "08", agosto: "08",
    set: "09", setembro: "09",
    out: "10", outubro: "10",
    nov: "11", novembro: "11",
    dez: "12", dezembro: "12",
  }
  const mExtenso = /(\d{1,2})\s*(?:de|\/|-)?\s*([a-zA-ZçÇáéíóúÁÉÍÓÚ]{3,9})\.?,?\s*(?:de|\/|-)?\s*(\d{4})/i.exec(limpo)
  if (mExtenso) {
    const dia = mExtenso[1].padStart(2, "0")
    const mesTexto = mExtenso[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 3)
    const mes = mesesNome[mesTexto]
    const ano = mExtenso[3]
    if (mes) {
      return `${ano}-${mes}-${dia}`
    }
  }

  return undefined
}

function obterModelos() {
  const modelos: any[] = []
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY) {
    modelos.push(google("gemini-2.0-flash"))
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

  // Se for PDF, tenta extrair o texto nativo digital (99% dos boletos de fornecedor têm texto digital)
  const ehPdf = arquivo.type === "application/pdf"
  const dadosPdf = ehPdf ? await extrairDadosBoletoPdf(bytes) : null
  const temTextoPdf = Boolean(dadosPdf?.textoCompleto && dadosPdf.textoCompleto.length >= 20)

  // Conteúdo para a IA:
  // Se PDF tem texto, envia o texto diretamente (compatível 100% com OpenAI gpt-4o e Gemini, super rápido e sem erro de media type)
  // Se for imagem, envia como imagem multimodal
  const conteudoMensagem: any[] = []

  if (ehPdf && temTextoPdf) {
    conteudoMensagem.push({
      type: "text",
      text:
        "Abaixo está o texto digital integral extraído deste boleto em PDF gerado pelo emissor/banco:\n\n" +
        "--- INÍCIO DO TEXTO DO BOLETO ---\n" +
        dadosPdf!.textoCompleto +
        "\n--- FIM DO TEXTO DO BOLETO ---\n\n" +
        "Extraia com exatidão máxima todos os campos (linha digitável com todos os dígitos, valor exato, data de vencimento, beneficiário e fatura).",
    })
  } else {
    conteudoMensagem.push({
      type: "text",
      text:
        modo === "codigo_barras"
          ? "Esta imagem é um enquadramento focado de perto NO CÓDIGO DE BARRAS E LINHA DIGITÁVEL do boleto (como leitor de banco). Extraia com 100% de precisão numérica a LINHA DIGITÁVEL e o VALOR."
          : "Extraia todos os dados deste boleto de cobrança com máxima precisão numérica.",
    })
    conteudoMensagem.push(
      ehPdf
        ? { type: "file" as const, data: bytes, mediaType: "application/pdf" }
        : { type: "image" as const, image: bytes, mediaType: arquivo.type }
    )
  }

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
          "REGRAS CRÍTICAS PARA VALOR E VENCIMENTO:\n" +
          "• VALOR DO DOCUMENTO: Localize com atenção o campo '(=) Valor do Documento', 'Valor Cobrado' ou 'Valor a Pagar' impresso no boleto. Retorne o número decimal com centavos (ex: se estiver R$ 1.598,18 retorne 1598.18; se estiver R$ 303,75 retorne 303.75; se estiver R$ 502,00 retorne 502.00). NUNCA confunda com descontos, juros ou número de parcelas.\n" +
          "• DATA DE VENCIMENTO: Localize com atenção o campo 'Vencimento' ou 'Data de Vencimento' no recibo do sacado ou topo do boleto. Retorne a data exata como impressa no documento no formato DD/MM/AAAA (ex: '13/11/2026', '28/11/2026'). NUNCA invente ou altere a data de vencimento impressa.\n\n" +
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
            content: conteudoMensagem,
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

  // Se a IA não respondeu mas o PDF tinha texto estruturado com linha digitável e valor:
  if (!lido && dadosPdf && (dadosPdf.linhaDigitavel || (dadosPdf.valor && dadosPdf.vencimento))) {
    lido = {
      linhaDigitavel: dadosPdf.linhaDigitavel ?? null,
      blocosLinhaDigitavel: null,
      beneficiario: dadosPdf.beneficiario ?? null,
      cnpjCpfBeneficiario: dadosPdf.cnpjCpfBeneficiario ?? null,
      valor: dadosPdf.valor ?? null,
      vencimento: dadosPdf.vencimento ?? null,
      mesReferencia: null,
      numeroDocumento: dadosPdf.numeroDocumento ?? null,
      pixCopiaECola: dadosPdf.pixCopiaECola ?? null,
      pagador: dadosPdf.pagador ?? null,
      instrucoes: dadosPdf.instrucoes ?? null,
    }
  } else if (lido && dadosPdf) {
    // Complementa dados faltantes da IA com os dados extraídos diretamente do PDF
    if (!lido.linhaDigitavel && dadosPdf.linhaDigitavel) {
      lido.linhaDigitavel = dadosPdf.linhaDigitavel
    }
    if ((!lido.valor || lido.valor <= 0) && dadosPdf.valor) {
      lido.valor = dadosPdf.valor
    }
    if (!lido.vencimento && dadosPdf.vencimento) {
      lido.vencimento = dadosPdf.vencimento
    }
    if (!lido.beneficiario && dadosPdf.beneficiario) {
      lido.beneficiario = dadosPdf.beneficiario
    }
    if (!lido.numeroDocumento && dadosPdf.numeroDocumento) {
      lido.numeroDocumento = dadosPdf.numeroDocumento
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

  const reconciliado = reconciliarBoleto([
    {
      linhaDigitavel: lido?.linhaDigitavel,
      blocosLinhaDigitavel: lido?.blocosLinhaDigitavel,
      valor: lido?.valor,
      vencimento: lido?.vencimento,
    },
  ])

  // Linha final formatada (reconciliada ou a decodificada ou a lida)
  const linhaParaFormatar =
    reconciliado.numeroBoleto ||
    (decodificado?.linhaDigitavel ? formatarLinhaDigitavel(decodificado.linhaDigitavel) : undefined) ||
    (digitosBrutos ? formatarLinhaDigitavel(digitosBrutos) : undefined)

  const avisosFinais = [...avisos, ...reconciliado.avisos].filter(
    (aviso, idx, arr) => arr.indexOf(aviso) === idx
  )

  return NextResponse.json({
    campos: {
      beneficiario: lido?.beneficiario ?? undefined,
      cnpjCpfBeneficiario: lido?.cnpjCpfBeneficiario ?? undefined,
      pagador: lido?.pagador ?? undefined,
      numeroDocumento: lido?.numeroDocumento ?? undefined,
      mesReferencia: lido?.mesReferencia ?? undefined,
      pixCopiaECola: lido?.pixCopiaECola ?? undefined,
      instrucoes: lido?.instrucoes ?? undefined,
      numeroBoleto: linhaParaFormatar || undefined,
      valor: reconciliado.valor,
      vencimento: reconciliado.vencimento,
    },
    linhaValida: reconciliado.confiavel,
    avisos: avisosFinais,
  })
}
