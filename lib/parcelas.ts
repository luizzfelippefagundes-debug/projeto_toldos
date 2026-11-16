import type { ParcelaLancamento } from "./types"

const arredondar = (n: number) => Math.round(n * 100) / 100

export interface ParcelaOrcamento {
  parcela: ParcelaLancamento | undefined
  valor: number
  descricao: string
  vencimento: string
}

// Percentual de entrada válido (0–100). Orçamentos antigos não têm esse campo
// e continuam sendo um pagamento único.
export function entradaEfetiva(entradaPercent: number | undefined): number | null {
  if (entradaPercent === undefined || !Number.isFinite(entradaPercent)) return null
  if (entradaPercent <= 0 || entradaPercent >= 100) return null
  return entradaPercent
}

export function textoCondicoesPagamento(entradaPercent: number | undefined): string {
  const entrada = entradaEfetiva(entradaPercent)
  if (entrada === null) return "À vista"
  return `${entrada}% de entrada + ${arredondar(100 - entrada)}% na entrega`
}

// Divide o total em entrada (vence hoje) e restante. Sem entrada, uma parcela só.
export function gerarParcelasOrcamento({
  total,
  entradaPercent,
  descricaoBase,
  vencimentoEntrada,
  vencimentoRestante,
}: {
  total: number
  entradaPercent: number | undefined
  descricaoBase: string
  vencimentoEntrada: string
  vencimentoRestante: string
}): ParcelaOrcamento[] {
  const entrada = entradaEfetiva(entradaPercent)
  if (entrada === null) {
    return [{ parcela: undefined, valor: arredondar(total), descricao: descricaoBase, vencimento: vencimentoRestante }]
  }
  const valorEntrada = arredondar((total * entrada) / 100)
  return [
    {
      parcela: "entrada",
      valor: valorEntrada,
      descricao: `${descricaoBase} · Entrada ${entrada}%`,
      vencimento: vencimentoEntrada,
    },
    {
      parcela: "restante",
      valor: arredondar(total - valorEntrada),
      descricao: `${descricaoBase} · Restante ${arredondar(100 - entrada)}%`,
      vencimento: vencimentoRestante,
    },
  ]
}

export function subtrairMeses(dataISO: string, qtdMeses: number): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number)
  if (!ano || !mes || !dia || !Number.isInteger(qtdMeses) || qtdMeses <= 0) return dataISO
  const total = mes - 1 - qtdMeses
  const a = ano + Math.floor(total / 12)
  const m = ((total % 12) + 12) % 12
  const ultimoDia = new Date(a, m + 1, 0).getDate()
  const d = Math.min(dia, ultimoDia)
  return `${a}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

// Datas (YYYY-MM-DD) de uma repetição mensal: mesmo dia todo mês, e no mês que
// não tem o dia (31 em fevereiro) cai no último dia, voltando ao dia original
// nos meses seguintes.
export function datasMensais(primeiraData: string, quantidade: number): string[] {
  const [ano, mes, dia] = primeiraData.split("-").map(Number)
  if (!ano || !mes || !dia || !Number.isInteger(quantidade) || quantidade < 1) return []
  return Array.from({ length: quantidade }, (_, i) => {
    const total = mes - 1 + i
    const a = ano + Math.floor(total / 12)
    const m = total % 12
    const ultimoDia = new Date(a, m + 1, 0).getDate()
    const d = Math.min(dia, ultimoDia)
    return `${a}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
  })
}

// Desloca uma data YYYY-MM-DD em N meses (N pode ser negativo), mantendo o dia
// original e caindo no último dia quando o mês não tem esse dia.
export function deslocarMeses(dataISO: string, deslocamento: number): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number)
  if (!ano || !mes || !dia || !Number.isInteger(deslocamento)) return dataISO
  const total = mes - 1 + deslocamento
  const a = ano + Math.floor(total / 12)
  const m = ((total % 12) + 12) % 12
  const ultimoDia = new Date(a, m + 1, 0).getDate()
  const d = Math.min(dia, ultimoDia)
  return `${a}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

// Datas de uma série mensal em que a data conhecida é a da parcela de índice
// `indiceReferencia` (0 = primeira). Ex.: 31 parcelas, 27 já pagas, próxima vence
// 28/11/2026 -> indiceReferencia = 27; a parcela 28 cai exatamente em 28/11/2026.
// Cada data é calculada a partir da referência (não em cadeia), então um dia 31
// não "encolhe" para 28 depois de fevereiro.
export function datasMensaisAncoradas(
  dataReferencia: string,
  quantidade: number,
  indiceReferencia: number
): string[] {
  if (!Number.isInteger(quantidade) || quantidade < 1) return []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataReferencia)) return []
  return Array.from({ length: quantidade }, (_, i) =>
    deslocarMeses(dataReferencia, i - indiceReferencia)
  )
}

// "STRADA" -> "STRADA (3/15)"; sem repetição, o nome fica como está.
export function nomeDaParcela(descricao: string, indice: number, total: number): string {
  return total > 1 ? `${descricao} (${indice + 1}/${total})` : descricao
}
