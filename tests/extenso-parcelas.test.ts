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

import { datasMensais, nomeDaParcela } from "@/lib/parcelas"

describe("datasMensais", () => {
  it("repete o mesmo dia todo mês, virando o ano", () => {
    const datas = datasMensais("2026-10-28", 4)
    expect(datas).toEqual(["2026-10-28", "2026-11-28", "2026-12-28", "2027-01-28"])
  })

  it("no mês sem o dia cai no último dia e volta ao dia original depois", () => {
    expect(datasMensais("2027-01-31", 3)).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"])
  })

  it("gera as 15 parcelas da Strada até 28/12/2027", () => {
    const datas = datasMensais("2026-10-28", 15)
    expect(datas).toHaveLength(15)
    expect(datas[14]).toBe("2027-12-28")
  })

  it("rejeita quantidade ou data inválida", () => {
    expect(datasMensais("2026-10-28", 0)).toEqual([])
    expect(datasMensais("abc", 3)).toEqual([])
  })
})

describe("nomeDaParcela", () => {
  it("numera só quando há mais de uma parcela", () => {
    expect(nomeDaParcela("STRADA", 2, 15)).toBe("STRADA (3/15)")
    expect(nomeDaParcela("STRADA", 0, 1)).toBe("STRADA")
  })
})
