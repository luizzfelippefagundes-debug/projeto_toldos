import { describe, expect, it } from "vitest"
import {
  calcularOrcamentoSalvo,
  deltasDeEstoque,
  devolucoesDoOrcamento,
  itemComBaixas,
  itensDoOrcamento,
  planejarBaixas,
} from "@/lib/orcamento-itens"
import type { ItemAdicional, Material, Orcamento, OrcamentoItem, Servico } from "@/lib/types"

const lona: Material = {
  id: "lona", nome: "Lona", tipo: "Lona", unidade: "m2",
  precoUnitario: 10, estoqueMinimo: 0, quantidadeEstoque: 10,
}
const acm: Material = {
  id: "acm", nome: "ACM", tipo: "ACM", unidade: "m2",
  precoUnitario: 50, estoqueMinimo: 0, quantidadeEstoque: 100,
}
const fixo: Servico = { id: "srv", nome: "Mão de obra", formaCobranca: "fixo", valor: 100 }

const principal: OrcamentoItem = {
  materialId: "lona", servicoId: "srv", largura: 2, altura: 3,
  quantidadeUnidades: 1, horasEstimadas: 0,
}
function adicional(extra: Partial<ItemAdicional> = {}): ItemAdicional {
  return {
    id: "ad-1", materialId: "lona", servicoId: "nenhum", largura: 2, altura: 3,
    quantidadeUnidades: 1, horasEstimadas: 0, ...extra,
  }
}
function orcamento(item: OrcamentoItem, extra: Partial<Orcamento> = {}): Orcamento {
  return {
    id: "o1", numero: 1001, clienteId: "c", item, ajusteManual: 0,
    anexoNome: null, status: "fechado", criadoEm: "2026-10-28T10:00:00.000Z",
    fechadoEm: "2026-10-28T10:00:00.000Z", ...extra,
  }
}

describe("itensDoOrcamento", () => {
  it("devolve só o principal quando não há adicionais", () => {
    expect(itensDoOrcamento(principal)).toEqual([principal])
  })
  it("devolve o principal e depois os adicionais, na ordem", () => {
    const a = adicional({ id: "a" })
    const b = adicional({ id: "b" })
    const lista = itensDoOrcamento({ ...principal, itensAdicionais: [a, b] })
    expect(lista).toEqual([{ ...principal, itensAdicionais: [a, b] }, a, b])
  })
})

describe("planejarBaixas", () => {
  it("baixa cada item do seu material", () => {
    const baixas = planejarBaixas(
      itensDoOrcamento({ ...principal, itensAdicionais: [adicional({ materialId: "acm" })] }),
      [lona, acm]
    )
    expect(baixas).toEqual([
      { materialId: "lona", solicitada: 6, debitada: 6 },
      { materialId: "acm", solicitada: 6, debitada: 6 },
    ])
  })

  it("divide o estoque quando dois itens usam o mesmo material", () => {
    // lona tem 10 m²: o principal leva 6 e o adicional só consegue 4 dos 6 pedidos
    const baixas = planejarBaixas(
      itensDoOrcamento({ ...principal, itensAdicionais: [adicional()] }),
      [lona]
    )
    expect(baixas.map((b) => b.debitada)).toEqual([6, 4])
    expect(baixas.map((b) => b.solicitada)).toEqual([6, 6])
  })

  it("conta as devoluções como estoque disponível (edição)", () => {
    const baixas = planejarBaixas(
      itensDoOrcamento(principal),
      [{ ...lona, quantidadeEstoque: 2 }],
      new Map([["lona", 6]])
    )
    expect(baixas[0].debitada).toBe(6)
  })

  it("material que não existe mais não baixa nada", () => {
    const baixas = planejarBaixas(itensDoOrcamento(principal), [])
    expect(baixas).toEqual([{ materialId: "lona", solicitada: 0, debitada: 0 }])
  })
})

describe("devolucoesDoOrcamento", () => {
  it("usa o que foi realmente debitado em cada item", () => {
    const o = orcamento(
      { ...principal, itensAdicionais: [adicional({ materialId: "acm", quantidadeMaterialDebitada: 2 })] },
      { quantidadeMaterialDebitada: 5 }
    )
    expect([...devolucoesDoOrcamento(o, [lona, acm])]).toEqual([["lona", 5], ["acm", 2]])
  })

  it("soma quando o mesmo material aparece em dois itens", () => {
    const o = orcamento(
      { ...principal, itensAdicionais: [adicional({ quantidadeMaterialDebitada: 4 })] },
      { quantidadeMaterialDebitada: 6 }
    )
    expect(devolucoesDoOrcamento(o, [lona]).get("lona")).toBe(10)
  })

  it("sem registro de débito, calcula o consumo do item", () => {
    const o = orcamento({ ...principal, itensAdicionais: [adicional({ materialId: "acm" })] })
    expect(devolucoesDoOrcamento(o, [lona, acm]).get("lona")).toBe(6)
    expect(devolucoesDoOrcamento(o, [lona, acm]).get("acm")).toBe(6)
  })
})

describe("deltasDeEstoque", () => {
  it("devolve o que estava baixado e baixa o novo", () => {
    const deltas = deltasDeEstoque(
      [{ materialId: "lona", solicitada: 3, debitada: 3 }],
      new Map([["lona", 6], ["acm", 2]])
    )
    expect(deltas.get("lona")).toBe(3)
    expect(deltas.get("acm")).toBe(2)
  })
})

describe("itemComBaixas", () => {
  it("grava em cada adicional o que foi debitado e o material fechado", () => {
    const item: OrcamentoItem = { ...principal, itensAdicionais: [adicional({ materialId: "acm" })] }
    const baixas = planejarBaixas(itensDoOrcamento(item), [lona, acm])
    const fechado = itemComBaixas(item, baixas, [lona, acm])
    expect(fechado.itensAdicionais?.[0]).toMatchObject({
      quantidadeMaterialDebitada: 6,
      materialFechado: { id: "acm", nome: "ACM", unidade: "m2", quantidade: 6, custo: 300 },
    })
  })

  it("devolve o mesmo item quando não há adicionais", () => {
    expect(itemComBaixas(principal, [], [lona])).toBe(principal)
  })
})

describe("calcularOrcamentoSalvo", () => {
  it("soma os adicionais ao total", () => {
    const o = orcamento({ ...principal, itensAdicionais: [adicional({ materialId: "acm" })] })
    const r = calcularOrcamentoSalvo(o, [lona, acm], [fixo])
    // lona 6 m² x 10 = 60 + 100 de mão de obra; acm 6 m² x 50 = 300
    expect(r?.total).toBe(460)
  })

  it("devolve null quando o material do item principal não existe", () => {
    expect(calcularOrcamentoSalvo(orcamento(principal), [], [fixo])).toBeNull()
  })
})
