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
