import { extractText } from "unpdf"
import { apenasDigitos, interpretarBoleto, obterIdentificacaoBoleto } from "./boleto"

export interface BoletoPdfExtraido {
  textoCompleto: string
  linhaDigitavel?: string
  valor?: number
  vencimento?: string // YYYY-MM-DD
  beneficiario?: string
  cnpjCpfBeneficiario?: string
  numeroDocumento?: string
  pagador?: string
  instrucoes?: string
  pixCopiaECola?: string
  bancoNome?: string
}

function normalizarDataBrParaIso(dataStr: string): string | undefined {
  const m = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(dataStr)
  if (!m) return undefined
  const dia = m[1].padStart(2, "0")
  const mes = m[2].padStart(2, "0")
  const ano = m[3]
  return `${ano}-${mes}-${dia}`
}

function extrairValorPtBr(texto: string): number | undefined {
  // Procura padrões como "R$ 1.598,18" ou "1.598,18" ou "303,75"
  const m = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})\b/.exec(texto)
  if (m) {
    const limpo = m[1].replace(/\./g, "").replace(",", ".")
    const num = Number(numLimpado(limpo))
    if (Number.isFinite(num) && num > 0) return num
  }
  return undefined
}

function numLimpado(str: string): string {
  return str.replace(/[^\d.]/g, "")
}

/**
 * Tenta extrair dados estruturados de um PDF de boleto a partir do seu texto digital.
 * Retorna os campos encontrados e o texto completo para alimentar a IA como fallback/validação.
 */
export async function extrairDadosBoletoPdf(pdfBytes: Uint8Array): Promise<BoletoPdfExtraido> {
  let textoCompleto = ""
  try {
    const { text } = await extractText(pdfBytes)
    textoCompleto = Array.isArray(text) ? text.join("\n") : String(text || "")
  } catch (err) {
    console.warn("Falha ao extrair texto do PDF via unpdf:", err)
    return { textoCompleto: "" }
  }

  const res: BoletoPdfExtraido = {
    textoCompleto: textoCompleto.trim(),
  }

  if (textoCompleto.length < 20) {
    return res
  }

  // 1. Procurar Linha Digitável
  // Padrão 1: Se estiver rotulado explicitamente como "Linha Digitável" ou "Código de Barras"
  const matchRotuloLinha = /(?:Linha\s*Digit[áa]vel|C[óo]digo\s*de\s*Barras)[\s:.]*([\d.\s-]{44,65})/i.exec(textoCompleto)
  if (matchRotuloLinha) {
    const limpo = apenasDigitos(matchRotuloLinha[1])
    if (limpo.length === 47 || limpo.length === 48 || limpo.length === 44) {
      res.linhaDigitavel = matchRotuloLinha[1].trim()
    }
  }

  // Padrão 2: Boleto bancário com pontos e espaços (ex: 75691.30078 01337.356001 27200.838035 1 214420000007000)
  if (!res.linhaDigitavel) {
    const regexLinhaComPontos = /\b(\d{5}\.\d{5}\s+\d{5}\.\d{6}\s+\d{5}\.\d{6}\s+\d\s+\d{14})\b/
    const matchLinha = regexLinhaComPontos.exec(textoCompleto)
    if (matchLinha) {
      res.linhaDigitavel = matchLinha[1]
    }
  }

  // Padrão 3: Sequência contínua de 47 dígitos ou 48 dígitos
  if (!res.linhaDigitavel) {
    const regex47 = /\b(\d{47})\b/
    const m47 = regex47.exec(textoCompleto)
    if (m47) {
      res.linhaDigitavel = m47[1]
    } else {
      const regex48 = /\b(8\d{11}\s*\d{12}\s*\d{12}\s*\d{12})\b/
      const m48 = regex48.exec(textoCompleto)
      if (m48) {
        res.linhaDigitavel = m48[1]
      }
    }
  }

  // Se encontrou linha digitável, valida com interpretarBoleto
  if (res.linhaDigitavel) {
    const decod = interpretarBoleto(apenasDigitos(res.linhaDigitavel))
    if (decod && decod.valido) {
      res.bancoNome = obterIdentificacaoBoleto(decod)
      if (decod.valor != null && !res.valor) {
        res.valor = decod.valor
      }
      if (decod.vencimento && !res.vencimento) {
        res.vencimento = decod.vencimento
      }
    }
  }

  // 2. Extrair Vencimento do texto impresso (tem prioridade caso o código de barras seja não-padrão)
  const regexVencimentoRotulo = /(?:Vencimento|Data\s*de\s*Vencimento)[\s:.]*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i
  const matchVenc = regexVencimentoRotulo.exec(textoCompleto)
  if (matchVenc) {
    const iso = normalizarDataBrParaIso(matchVenc[1])
    if (iso) {
      res.vencimento = iso
    }
  }

  // 3. Extrair Valor do Documento impresso
  const regexValorRotulo = /(?:Valor\s*do\s*Documento|Valor\s*Cobrado|(=)\s*Valor|Total\s*a\s*Pagar)[\s:.]*(?:R\$\s*)?([\d.,]+)/i
  const matchVal = regexValorRotulo.exec(textoCompleto)
  if (matchVal) {
    const val = extrairValorPtBr(matchVal[0])
    if (val) {
      res.valor = val
    }
  }

  // 4. Extrair Beneficiário / Cedente
  const regexBeneficiario = /(?:Benefici[áa]rio|Cedente|Raz[ãa]o\s*Social)[\s:.]*([^\n\r]+)/i
  const matchBen = regexBeneficiario.exec(textoCompleto)
  if (matchBen) {
    let nome = matchBen[1].trim()
    // Limpar se tiver CNPJ colado
    const matchCnpj = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/.exec(nome)
    if (matchCnpj) {
      res.cnpjCpfBeneficiario = matchCnpj[1]
      nome = nome.replace(matchCnpj[0], "").replace(/CNPJ\/CPF[:\s]*/i, "").trim()
    }
    // Remove sufixos como "Agência", "Código" se capturados na mesma linha
    nome = nome.replace(/\s*(?:Ag[êe]ncia|C[óo]digo|Endere[çc]o).*$/i, "").trim()
    if (nome.length > 2) {
      res.beneficiario = nome
    }
  }

  // 5. Extrair Número do Documento / Fatura
  const regexNumDoc = /(?:N[º°.]?\s*do\s*Documento|N[º°.]?\s*Documento|Fatura|N[º°]\s*Fatura)[\s:.]*([A-Za-z0-9\-_./]+)/i
  const matchDoc = regexNumDoc.exec(textoCompleto)
  if (matchDoc) {
    const doc = matchDoc[1].trim()
    if (doc.length > 1 && !doc.toLowerCase().includes("vencimento")) {
      res.numeroDocumento = doc
    }
  }

  // 6. Extrair Pix Copia e Cola se houver
  const matchPix = /(000201[0-9A-Za-z$@%*+,\-./:;=?_]{50,})/.exec(textoCompleto)
  if (matchPix) {
    res.pixCopiaECola = matchPix[1].trim()
  }

  return res
}
