import { describe, expect, it } from "vitest"
import { agruparPagasDaSerie, baseDaDescricao, chaveDaSerie, resumirSerie } from "@/lib/series"
import type { LancamentoFinanceiro } from "@/lib/types"

function l(
  id: string,
  descricao: string,
  mes: number,
  extra: Partial<LancamentoFinanceiro> = {}
): LancamentoFinanceiro {
  return {
    id,
    descricao,
    tipo: "despesa",
    categoria: "FINANCIAMENTO STRADA",
    valor: 100,
    vencimento: new Date(2026, mes, 28, 12).toISOString(),
    status: "pendente",
    origem: "manual",
    origemId: null,
    criadoEm: "2026-10-01T10:00:00.000Z",
    ...extra,
  }
}
const pago = { status: "pago" as const }

describe("séries de lançamentos", () => {
  it("ignora o número da parcela no nome", () => {
    expect(baseDaDescricao("STRADA")).toBe("strada")
    expect(baseDaDescricao("BELA CASA (3)")).toBe("bela casa")
    expect(baseDaDescricao("STRADA (3/15)")).toBe("strada")
  })

  it("não monta série de receita nem de orçamento", () => {
    expect(chaveDaSerie(l("a", "X", 1, { tipo: "receita" }))).toBeNull()
    expect(chaveDaSerie(l("a", "X", 1, { origem: "orcamento" }))).toBeNull()
  })

  it("resume pagas, restante e quitação", () => {
    const todos = [
      l("1", "STRADA", 9, { ...pago, valor: 100 }),
      l("2", "STRADA", 10, { ...pago, valor: 100 }),
      l("3", "STRADA", 11, { valor: 100 }),
      l("4", "STRADA", 12, { valor: 150.5 }),
      l("x", "ALUGUEL", 10, { categoria: "ALUGUEL" }),
    ]
    const r = resumirSerie(todos, todos[0])!
    expect(r.parcelas).toHaveLength(4)
    expect(r.pagas).toHaveLength(2)
    expect(r.valorPago).toBe(200)
    expect(r.valorRestante).toBe(250.5)
    expect(new Date(r.quitaEm).getMonth()).toBe(12 % 12)
    expect(r.nome).toBe("STRADA")
  })

  it("lançamento isolado não é série", () => {
    const todos = [l("1", "STRADA", 9)]
    expect(resumirSerie(todos, todos[0])).toBeNull()
  })

  it("recolhe as parcelas pagas da série numa linha só, e abre quando pedido", () => {
    const todos = [
      l("1", "STRADA", 9, pago),
      l("2", "STRADA", 10, pago),
      l("3", "STRADA", 11, pago),
      l("4", "STRADA", 12),
      l("5", "INTERNET", 10, { categoria: "INTERNET", ...pago }),
    ]
    const fechado = agruparPagasDaSerie(todos, todos, new Set())
    expect(fechado.map((i) => (i.tipo === "pagas" ? `grupo:${i.itens.length}:${i.total}` : i.lancamento.id))).toEqual([
      "grupo:3:300",
      "4",
      "5",
    ])
    const aberto = agruparPagasDaSerie(todos, todos, new Set([chaveDaSerie(todos[0])!]))
    expect(aberto.every((i) => i.tipo === "lancamento")).toBe(true)
    expect(aberto).toHaveLength(5)
  })

  it("uma parcela paga só continua aparecendo normalmente", () => {
    const todos = [l("1", "STRADA", 9, pago), l("2", "STRADA", 10)]
    const lista = agruparPagasDaSerie(todos, todos, new Set())
    expect(lista.every((i) => i.tipo === "lancamento")).toBe(true)
  })
})
