const UNIDADES = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
]
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"]
const CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
  "seiscentos", "setecentos", "oitocentos", "novecentos",
]

// 0–999
function ate999(n: number): string {
  if (n === 0) return ""
  if (n === 100) return "cem"
  const partes: string[] = []
  const c = Math.floor(n / 100)
  const resto = n % 100
  if (c > 0) partes.push(CENTENAS[c])
  if (resto > 0) {
    if (resto < 20) partes.push(UNIDADES[resto])
    else {
      const d = Math.floor(resto / 10)
      const u = resto % 10
      partes.push(u > 0 ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d])
    }
  }
  return partes.join(" e ")
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero"
  const escalas: [number, string, string][] = [
    [1_000_000_000, "bilhão", "bilhões"],
    [1_000_000, "milhão", "milhões"],
    [1_000, "mil", "mil"],
  ]
  const partes: string[] = []
  let ultimoGrupo = 0
  let resto = n
  for (const [valor, singular, plural] of escalas) {
    const grupo = Math.floor(resto / valor)
    resto %= valor
    if (grupo === 0) continue
    ultimoGrupo = grupo
    if (valor === 1_000) partes.push(grupo === 1 ? "mil" : `${ate999(grupo)} mil`)
    else partes.push(`${ate999(grupo)} ${grupo === 1 ? singular : plural}`)
  }
  if (resto > 0) {
    ultimoGrupo = resto
    partes.push(ate999(resto))
  }

  // "e" antes do último grupo quando ele é menor que 100 ou centena exata
  // (mil e cem, dois milhões e quinhentos mil); senão só espaço.
  if (partes.length === 1) return partes[0]
  const ultimo = partes[partes.length - 1]
  const anteriores = partes.slice(0, -1).join(" ")
  const ligaComE = ultimoGrupo < 100 || ultimoGrupo % 100 === 0
  return `${anteriores}${ligaComE ? " e " : " "}${ultimo}`
}

// 1234.5 -> "mil duzentos e trinta e quatro reais e cinquenta centavos"
export function valorPorExtenso(valor: number): string {
  if (!Number.isFinite(valor) || valor < 0) return ""
  const centavosTotais = Math.round(valor * 100)
  const reais = Math.floor(centavosTotais / 100)
  const centavos = centavosTotais % 100

  const partes: string[] = []
  if (reais > 0) {
    const e = inteiroPorExtenso(reais)
    // "um milhão de reais", "dois milhões de reais"
    const deReais = reais % 1_000_000 === 0 && reais >= 1_000_000
    partes.push(`${e}${deReais ? " de" : ""} ${reais === 1 ? "real" : "reais"}`)
  }
  if (centavos > 0) {
    partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`)
  }
  return partes.length === 0 ? "zero reais" : partes.join(" e ")
}
