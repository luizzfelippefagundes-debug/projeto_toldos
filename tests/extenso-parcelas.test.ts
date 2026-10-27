import { describe, expect, it } from "vitest"
import { valorPorExtenso } from "@/lib/extenso"
import { gerarParcelasOrcamento, textoCondicoesPagamento } from "@/lib/parcelas"

describe("valorPorExtenso", () => {
  it.each([
    [0, "zero reais"],
    [1, "um real"],
    [0.01, "um centavo"],
    [2.5, "dois reais e cinquenta centavos"],
    [21, "vinte e um reais"],
    [100, "cem reais"],
    [101, "cento e um reais"],
    [560, "quinhentos e sessenta reais"],
    [1000, "mil reais"],
    [1120, "mil cento e vinte reais"],
    [1100, "mil e cem reais"],
    [2050, "dois mil e cinquenta reais"],
    [1234.56, "mil duzentos e trinta e quatro reais e cinquenta e seis centavos"],
    [12000, "doze mil reais"],
    [101000, "cento e um mil reais"],
    [1_000_000, "um milhão de reais"],
    [2_500_000, "dois milhões e quinhentos mil reais"],
  ])("%s", (valor, esperado) => {
    expect(valorPorExtenso(valor)).toBe(esperado)
  })
})

describe("gerarParcelasOrcamento", () => {
  const base = { descricaoBase: "Orçamento #1", vencimentoEntrada: "2026-10-27", vencimentoRestante: "2026-11-03" }

  it("divide em entrada e restante somando o total", () => {
    const parcelas = gerarParcelasOrcamento({ ...base, total: 1000.01, entradaPercent: 50 })
    expect(parcelas.map((p) => p.parcela)).toEqual(["entrada", "restante"])
    expect(parcelas[0].valor + parcelas[1].valor).toBeCloseTo(1000.01, 2)
    expect(parcelas[0].vencimento).toBe("2026-10-27")
    expect(parcelas[1].descricao).toBe("Orçamento #1 · Restante 50%")
  })

  it("gera pagamento único sem entrada, com 0, com 100 ou em orçamento antigo", () => {
    for (const pct of [undefined, 0, 100]) {
      const parcelas = gerarParcelasOrcamento({ ...base, total: 500, entradaPercent: pct })
      expect(parcelas).toHaveLength(1)
      expect(parcelas[0]).toMatchObject({ parcela: undefined, valor: 500, descricao: "Orçamento #1" })
    }
  })
})

describe("textoCondicoesPagamento", () => {
  it("descreve a entrada ou à vista", () => {
    expect(textoCondicoesPagamento(50)).toBe("50% de entrada + 50% na entrega")
    expect(textoCondicoesPagamento(30)).toBe("30% de entrada + 70% na entrega")
    expect(textoCondicoesPagamento(undefined)).toBe("À vista")
    expect(textoCondicoesPagamento(100)).toBe("À vista")
  })
})
