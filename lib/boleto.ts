// Leitura determinística de boleto: a linha digitável / código de barras
// já traz valor, vencimento e dígitos verificadores — isso não depende de
// IA, então serve de fonte de verdade pra conferir o que a IA extraiu.

export interface BoletoInterpretado {
  tipo: "bancario" | "concessionaria"
  // Dígitos verificadores conferem (ou foram recompostos). Se false, a leitura provavelmente errou.
  valido: boolean
  // true só quando o dígito verificador GERAL bate com o que foi lido — é o único
  // DV que protege o valor e o fator de vencimento. Se false, valor/vencimento
  // tirados do código NÃO são confiáveis.
  confiavel: boolean
  codigoBarras: string
  linhaDigitavel: string
  valor?: number
  // YYYY-MM-DD
  vencimento?: string
  banco?: string
}

export function apenasDigitos(texto: string): string {
  return texto.replace(/\D/g, "")
}

function modulo10(digitos: string): number {
  let soma = 0
  let peso = 2
  for (let i = digitos.length - 1; i >= 0; i--) {
    const produto = Number(digitos[i]) * peso
    soma += produto > 9 ? produto - 9 : produto
    peso = peso === 2 ? 1 : 2
  }
  return (10 - (soma % 10)) % 10
}

// Módulo 11 do boleto bancário (pesos 2–9; 0, 10 e 11 viram 1).
function modulo11Bancario(digitos: string): number {
  let soma = 0
  let peso = 2
  for (let i = digitos.length - 1; i >= 0; i--) {
    soma += Number(digitos[i]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const dv = 11 - (soma % 11)
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv
}

// Módulo 11 de arrecadação/concessionárias (resto 0 ou 1 → 0; 10 → 1).
function modulo11Arrecadacao(digitos: string): number {
  let soma = 0
  let peso = 2
  for (let i = digitos.length - 1; i >= 0; i--) {
    soma += Number(digitos[i]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const resto = soma % 11
  if (resto === 0 || resto === 1) return 0
  if (resto === 10) return 1
  return 11 - resto
}

function formatarData(data: Date): string {
  const ano = data.getUTCFullYear()
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0")
  const dia = String(data.getUTCDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

// O fator de vencimento conta dias desde 07/10/1997 e voltou a 1000 em
// 22/02/2025. Os dois ciclos dão datas candidatas; vale a mais próxima de hoje.
export function vencimentoPeloFator(
  fator: number,
  hoje: Date = new Date()
): string | undefined {
  if (!Number.isInteger(fator) || fator <= 0) return undefined
  const DIA = 86_400_000
  const base1 = Date.UTC(1997, 9, 7)
  const base2 = Date.UTC(2025, 1, 22) - 1000 * DIA
  const candidatos = [base1 + fator * DIA, base2 + fator * DIA]
  const referencia = hoje.getTime()
  const melhor = candidatos.reduce((a, b) =>
    Math.abs(a - referencia) <= Math.abs(b - referencia) ? a : b
  )
  return formatarData(new Date(melhor))
}

// Inverso de vencimentoPeloFator: data YYYY-MM-DD -> fator de 4 dígitos.
// A partir de 22/02/2025 o fator recomeça em 1000.
export function fatorDoVencimento(dataISO: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataISO)
  if (!m) return undefined
  const DIA = 86_400_000
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const reinicio = Date.UTC(2025, 1, 22)
  const fator =
    t >= reinicio
      ? 1000 + Math.round((t - reinicio) / DIA)
      : Math.round((t - Date.UTC(1997, 9, 7)) / DIA)
  if (fator < 1000 || fator > 9999) return undefined
  return fator
}

// Confere o DV geral de um código de barras bancário (44 posições).
export function dvGeralBancarioConfere(cb: string): boolean {
  if (cb.length !== 44) return false
  return modulo11Bancario(cb.slice(0, 4) + cb.slice(5)) === Number(cb[4])
}

// Monta um código de barras bancário trocando fator/valor e mantendo o DV lido.
export function montarCodigoBancario(cbBase: string, fator: number, centavos: number): string {
  return (
    cbBase.slice(0, 5) +
    String(fator).padStart(4, "0") +
    String(Math.round(centavos)).padStart(10, "0") +
    cbBase.slice(19)
  )
}

export function codigoBarrasParaLinhaBancaria(cb: string): string {
  if (cb.length !== 44) return ""
  const c1SemDv = cb.slice(0, 4) + cb.slice(19, 24)
  const dv1 = modulo10(c1SemDv)
  const c1 = c1SemDv + dv1

  const c2SemDv = cb.slice(24, 34)
  const dv2 = modulo10(c2SemDv)
  const c2 = c2SemDv + dv2

  const c3SemDv = cb.slice(34, 44)
  const dv3 = modulo10(c3SemDv)
  const c3 = c3SemDv + dv3

  const dvGeral = cb[4]
  const fatorCentavos = cb.slice(5, 19)

  return c1 + c2 + c3 + dvGeral + fatorCentavos
}

export function codigoBarrasParaLinhaConcessionaria(cb: string): string {
  if (cb.length !== 44) return ""
  const identificador = cb[2]
  const usaMod10 = identificador === "6" || identificador === "7"
  const dv = usaMod10 ? modulo10 : modulo11Arrecadacao
  const b1 = cb.slice(0, 11)
  const b2 = cb.slice(11, 22)
  const b3 = cb.slice(22, 33)
  const b4 = cb.slice(33, 44)
  return b1 + dv(b1) + b2 + dv(b2) + b3 + dv(b3) + b4 + dv(b4)
}

export function formatarLinhaDigitavel(texto: string): string {
  const d = apenasDigitos(texto)
  if (d.length === 47) {
    return `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d.slice(32, 33)} ${d.slice(33, 47)}`
  }
  if (d.length === 48) {
    return `${d.slice(0, 12)} ${d.slice(12, 24)} ${d.slice(24, 36)} ${d.slice(36, 48)}`
  }
  return texto
}

function interpretarBancario(
  digitos: string,
  hoje: Date
): BoletoInterpretado | null {
  // Se digitos tem entre 43 e 52 dígitos (não sendo 44 que é código de barras),
  // frequentemente o OCR comeu ou duplicou zeros no Campo 5 (fator + 10 dígitos de valor).
  if (
    digitos.length !== 47 &&
    digitos.length !== 44 &&
    digitos.length >= 43 &&
    digitos.length <= 52
  ) {
    const c1 = digitos.slice(0, 10)
    const c2 = digitos.slice(10, 21)
    const c3 = digitos.slice(21, 32)
    const dvGeral = digitos.slice(32, 33)
    const tail = digitos.slice(33)
    if (tail.length >= 8) {
      const fator = tail.slice(0, 4)
      const centavosStr = tail.slice(4)
      const centavos = parseInt(centavosStr, 10)
      if (!isNaN(centavos)) {
        const tailNormalizado = fator + centavos.toString().padStart(10, "0")
        const reconstruido = c1 + c2 + c3 + dvGeral + tailNormalizado
        if (reconstruido.length === 47) {
          digitos = reconstruido
        }
      }
    }
  }

  let codigoBarras: string
  let camposValidos = true
  let confiavel = false
  let linhaDigitavelFinal = digitos

  if (digitos.length === 47) {
    const c1 = digitos.slice(0, 10)
    const c2 = digitos.slice(10, 21)
    const c3 = digitos.slice(21, 32)
    const dvGeral = digitos.slice(32, 33)
    const fatorCentavos = digitos.slice(33, 47)

    const c1Ok = modulo10(c1.slice(0, -1)) === Number(c1.slice(-1))
    const c2Ok = modulo10(c2.slice(0, -1)) === Number(c2.slice(-1))
    const c3Ok = modulo10(c3.slice(0, -1)) === Number(c3.slice(-1))
    const todosCamposOk = c1Ok && c2Ok && c3Ok

    codigoBarras =
      digitos.slice(0, 4) +
      digitos.slice(32, 33) +
      digitos.slice(33, 47) +
      c1.slice(4, 9) +
      c2.slice(0, 10) +
      c3.slice(0, 10)

    const semDv = codigoBarras.slice(0, 4) + codigoBarras.slice(5)
    const dvEsperado = modulo11Bancario(semDv)
    const dvGeralOriginalOk = dvEsperado === Number(codigoBarras[4])

    if (todosCamposOk && dvGeralOriginalOk) {
      camposValidos = true
      confiavel = true
      linhaDigitavelFinal = digitos
    } else if (todosCamposOk && !dvGeralOriginalOk) {
      // Campos 1-3 íntegros, mas o DV geral não bate. O campo 5 (fator + valor)
      // só é protegido pelo DV geral, então NÃO dá pra saber se o erro está no DV
      // ou no valor/vencimento. Marcamos como não confiável (antes o sistema
      // "consertava" o DV e aceitava valor/data possivelmente errados).
      camposValidos = false
      confiavel = false
      linhaDigitavelFinal = digitos
    } else if (!todosCamposOk && dvGeralOriginalOk) {
      // O código de barras de 44 posições confere 100% com o DV Geral; apenas o DV de algum campo da linha foi lido errado
      const c1Correto = c1.slice(0, -1) + String(modulo10(c1.slice(0, -1)))
      const c2Correto = c2.slice(0, -1) + String(modulo10(c2.slice(0, -1)))
      const c3Correto = c3.slice(0, -1) + String(modulo10(c3.slice(0, -1)))
      linhaDigitavelFinal = c1Correto + c2Correto + c3Correto + dvGeral + fatorCentavos
      camposValidos = true
      confiavel = true
    } else {
      camposValidos = false
      linhaDigitavelFinal = digitos
    }
  } else if (digitos.length === 44) {
    codigoBarras = digitos
    linhaDigitavelFinal = codigoBarrasParaLinhaBancaria(codigoBarras)
    const semDv = codigoBarras.slice(0, 4) + codigoBarras.slice(5)
    camposValidos = modulo11Bancario(semDv) === Number(codigoBarras[4])
    confiavel = camposValidos
  } else {
    return null
  }

  const fator = Number(codigoBarras.slice(5, 9))
  const centavos = Number(codigoBarras.slice(9, 19))

  return {
    tipo: "bancario",
    valido: camposValidos,
    confiavel,
    codigoBarras,
    linhaDigitavel: linhaDigitavelFinal,
    valor: centavos > 0 ? centavos / 100 : undefined,
    vencimento: vencimentoPeloFator(fator, hoje),
    banco: codigoBarras.slice(0, 3),
  }
}

function interpretarConcessionaria(digitos: string): BoletoInterpretado | null {
  if (digitos.length !== 48 && digitos.length !== 44) return null

  let codigoBarras: string
  const identificador = digitos[2]
  let usaMod10 = identificador === "6" || identificador === "7"
  let dv = usaMod10 ? modulo10 : modulo11Arrecadacao

  let blocosValidos = true
  let linhaDigitavelFinal = digitos

  if (digitos.length === 48) {
    const blocos = [0, 12, 24, 36].map((i) => digitos.slice(i, i + 12))
    let confere = blocos.every((b) => dv(b.slice(0, 11)) === Number(b[11]))
    if (!confere) {
      const outroDv = usaMod10 ? modulo11Arrecadacao : modulo10
      if (blocos.every((b) => outroDv(b.slice(0, 11)) === Number(b[11]))) {
        dv = outroDv
        usaMod10 = !usaMod10
        confere = true
      }
    }

    if (confere) {
      blocosValidos = true
      codigoBarras = blocos.map((b) => b.slice(0, 11)).join("")
      linhaDigitavelFinal = digitos
    } else {
      // Recalcula matematicamente os DVs a partir dos 11 dígitos de cada bloco
      const blocosCorrigidos = blocos.map((b) => b.slice(0, 11) + String(dv(b.slice(0, 11))))
      const blocosCorrigidosOk = blocosCorrigidos.every(
        (b) => dv(b.slice(0, 11)) === Number(b[11])
      )
      if (blocosCorrigidosOk) {
        blocosValidos = true
        linhaDigitavelFinal = blocosCorrigidos.join("")
        codigoBarras = blocos.map((b) => b.slice(0, 11)).join("")
      } else {
        blocosValidos = false
        codigoBarras = blocos.map((b) => b.slice(0, 11)).join("")
      }
    }
  } else {
    codigoBarras = digitos
    linhaDigitavelFinal = codigoBarrasParaLinhaConcessionaria(codigoBarras)
  }

  const valorEfetivo = identificador === "6" || identificador === "8"
  const centavos = Number(codigoBarras.slice(4, 15))
  // DV geral (posição 4 do código) protege todos os 43 dígitos, inclusive o valor.
  const dvGeralOk =
    codigoBarras.length === 44 &&
    dv(codigoBarras.slice(0, 3) + codigoBarras.slice(4)) === Number(codigoBarras[3])

  return {
    tipo: "concessionaria",
    valido: blocosValidos,
    confiavel: blocosValidos && dvGeralOk,
    codigoBarras,
    linhaDigitavel: linhaDigitavelFinal,
    valor: valorEfetivo && centavos > 0 ? centavos / 100 : undefined,
  }
}

export function interpretarBoleto(
  texto: string,
  hoje: Date = new Date()
): BoletoInterpretado | null {
  const digitos = apenasDigitos(texto)
  if (digitos.startsWith("8")) return interpretarConcessionaria(digitos)
  return interpretarBancario(digitos, hoje)
}

export function obterIdentificacaoBoleto(decod: BoletoInterpretado): string {
  if (decod.tipo === "concessionaria") {
    const segmento = decod.codigoBarras[1]
    const mapaSegmentos: Record<string, string> = {
      "1": "Prefeituras / IPTU / Tributos",
      "2": "Água e Esgoto / Saneamento",
      "3": "Energia Elétrica e Gás",
      "4": "Energia / Telecomunicações",
      "5": "Órgãos Governamentais",
      "6": "Carnês e Concessionárias",
      "7": "Multas de Trânsito",
    }
    return mapaSegmentos[segmento] || "Conta de Concessionária"
  }
  const banco = decod.banco || decod.codigoBarras.slice(0, 3)
  const mapaBancos: Record<string, string> = {
    "001": "Banco do Brasil",
    "033": "Santander",
    "041": "Banrisul",
    "077": "Banco Inter",
    "104": "Caixa Econômica",
    "212": "Banco Original",
    "237": "Bradesco",
    "260": "Nubank",
    "341": "Itaú",
    "422": "Safra",
    "748": "Sicredi",
    "756": "SICOOB",
  }
  return mapaBancos[banco] ? `${mapaBancos[banco]} (${banco})` : `Banco ${banco}`
}

// Só pra montar linhas válidas nos testes.
export const _internos = { modulo10, modulo11Bancario }
