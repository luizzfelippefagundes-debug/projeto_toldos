// Leitura determinística de boleto: a linha digitável / código de barras
// já traz valor, vencimento e dígitos verificadores — isso não depende de
// IA, então serve de fonte de verdade pra conferir o que a IA extraiu.

export interface BoletoInterpretado {
  tipo: "bancario" | "concessionaria"
  // Dígitos verificadores conferem. Se false, a leitura provavelmente errou.
  valido: boolean
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
  let codigoBarras: string
  let camposValidos = true

  if (digitos.length === 47) {
    const c1 = digitos.slice(0, 10)
    const c2 = digitos.slice(10, 21)
    const c3 = digitos.slice(21, 32)
    for (const campo of [c1, c2, c3]) {
      if (modulo10(campo.slice(0, -1)) !== Number(campo.slice(-1))) {
        camposValidos = false
      }
    }
    codigoBarras =
      digitos.slice(0, 4) +
      digitos.slice(32, 33) +
      digitos.slice(33, 47) +
      c1.slice(4, 9) +
      c2.slice(0, 10) +
      c3.slice(0, 10)
  } else if (digitos.length === 44) {
    codigoBarras = digitos
  } else {
    return null
  }

  const semDv = codigoBarras.slice(0, 4) + codigoBarras.slice(5)
  const dvGeralOk = modulo11Bancario(semDv) === Number(codigoBarras[4])

  const fator = Number(codigoBarras.slice(5, 9))
  const centavos = Number(codigoBarras.slice(9, 19))

  return {
    tipo: "bancario",
    valido: camposValidos && dvGeralOk,
    codigoBarras,
    linhaDigitavel: digitos.length === 47 ? digitos : codigoBarrasParaLinhaBancaria(codigoBarras),
    valor: centavos > 0 ? centavos / 100 : undefined,
    vencimento: vencimentoPeloFator(fator, hoje),
    banco: codigoBarras.slice(0, 3),
  }
}

function interpretarConcessionaria(digitos: string): BoletoInterpretado | null {
  if (digitos.length !== 48 && digitos.length !== 44) return null

  let codigoBarras: string
  let blocosValidos = true
  const identificador = digitos[2]
  const usaMod10 = identificador === "6" || identificador === "7"
  const dv = usaMod10 ? modulo10 : modulo11Arrecadacao

  if (digitos.length === 48) {
    const blocos = [0, 12, 24, 36].map((i) => digitos.slice(i, i + 12))
    for (const bloco of blocos) {
      if (dv(bloco.slice(0, 11)) !== Number(bloco[11])) blocosValidos = false
    }
    codigoBarras = blocos.map((b) => b.slice(0, 11)).join("")
  } else {
    codigoBarras = digitos
  }

  const dvGeralOk = dv(codigoBarras.slice(0, 3) + codigoBarras.slice(4)) ===
    Number(codigoBarras[3])
  const valorEfetivo = identificador === "6" || identificador === "8"
  const centavos = Number(codigoBarras.slice(4, 15))

  return {
    tipo: "concessionaria",
    valido: blocosValidos && dvGeralOk,
    codigoBarras,
    linhaDigitavel: digitos.length === 48 ? digitos : codigoBarrasParaLinhaConcessionaria(codigoBarras),
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

// Só pra montar linhas válidas nos testes.
export const _internos = { modulo10, modulo11Bancario }
