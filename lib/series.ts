import type { LancamentoFinanceiro } from "./types"

// Série = despesas lançadas à mão com a mesma categoria e o mesmo nome, só
// mudando o número da parcela ("STRADA", "BELA CASA (3)", "STRADA (3/15)").
// Não depende de coluna nova, então já vale pros lançamentos que existem.
const arredondar = (n: number) => Math.round(n * 100) / 100

export function baseDaDescricao(descricao: string): string {
  return descricao.replace(/\s*\(\d+(?:\/\d+)?\)\s*$/, "").trim().toLowerCase()
}

export function chaveDaSerie(l: LancamentoFinanceiro): string | null {
  if (l.tipo !== "despesa" || l.origem !== "manual") return null
  return `${l.categoria.trim().toLowerCase()}|${baseDaDescricao(l.descricao)}`
}

export interface ResumoSerie {
  chave: string
  nome: string
  categoria: string
  // por vencimento
  parcelas: LancamentoFinanceiro[]
  pagas: LancamentoFinanceiro[]
  pendentes: LancamentoFinanceiro[]
  valorPago: number
  valorRestante: number
  quitaEm: string
}

export function resumirSerie(
  todos: LancamentoFinanceiro[],
  lancamento: LancamentoFinanceiro
): ResumoSerie | null {
  const chave = chaveDaSerie(lancamento)
  if (!chave) return null
  const parcelas = todos
    .filter((l) => chaveDaSerie(l) === chave)
    .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())
  if (parcelas.length < 2) return null
  const pagas = parcelas.filter((l) => l.status === "pago")
  const pendentes = parcelas.filter((l) => l.status !== "pago")
  return {
    chave,
    nome: lancamento.descricao.replace(/\s*\(\d+(?:\/\d+)?\)\s*$/, "").trim(),
    categoria: lancamento.categoria,
    parcelas,
    pagas,
    pendentes,
    valorPago: arredondar(pagas.reduce((s, l) => s + l.valor, 0)),
    valorRestante: arredondar(pendentes.reduce((s, l) => s + l.valor, 0)),
    quitaEm: parcelas[parcelas.length - 1].vencimento,
  }
}

// Lista do Financeiro: as parcelas já pagas de uma mesma série (2 ou mais)
// viram uma linha só, que pode ser aberta. O histórico continua guardado.
export type ItemLista =
  | { tipo: "lancamento"; lancamento: LancamentoFinanceiro }
  | { tipo: "pagas"; chave: string; nome: string; itens: LancamentoFinanceiro[]; total: number }

export function agruparPagasDaSerie(
  visiveis: LancamentoFinanceiro[],
  todos: LancamentoFinanceiro[],
  expandidas: ReadonlySet<string>
): ItemLista[] {
  const pagasPorSerie = new Map<string, LancamentoFinanceiro[]>()
  for (const l of visiveis) {
    const chave = chaveDaSerie(l)
    if (!chave || l.status !== "pago") continue
    const grupo = pagasPorSerie.get(chave) ?? []
    grupo.push(l)
    pagasPorSerie.set(chave, grupo)
  }

  const lista: ItemLista[] = []
  const jaMostradas = new Set<string>()
  for (const l of visiveis) {
    const chave = chaveDaSerie(l)
    const grupo = chave ? pagasPorSerie.get(chave) : undefined
    const recolhe =
      chave &&
      grupo &&
      grupo.length >= 2 &&
      l.status === "pago" &&
      !expandidas.has(chave) &&
      // só recolhe em séries de verdade (2+ parcelas no total)
      todos.filter((t) => chaveDaSerie(t) === chave).length >= 2
    if (!recolhe) {
      lista.push({ tipo: "lancamento", lancamento: l })
      continue
    }
    if (jaMostradas.has(chave)) continue
    jaMostradas.add(chave)
    lista.push({
      tipo: "pagas",
      chave,
      nome: l.descricao.replace(/\s*\(\d+(?:\/\d+)?\)\s*$/, "").trim(),
      itens: grupo,
      total: arredondar(grupo.reduce((s, x) => s + x.valor, 0)),
    })
  }
  return lista
}
