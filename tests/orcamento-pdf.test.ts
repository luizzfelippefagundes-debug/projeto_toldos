import { describe, expect, it } from "vitest"
import { gerarLinhasOrcamento, formatarNumeroOrcamento } from "@/lib/orcamento-pdf"
import { calcularOrcamentoCompleto } from "@/lib/calculo"
import type { Acabamento, Material, OrcamentoItem } from "@/lib/types"

const material: Material = {
  id: "m",
  nome: "LONA",
  tipo: "Lona",
  unidade: "m2",
  precoUnitario: 50,
  estoqueMinimo: 0,
  quantidadeEstoque: 0,
}
const acabamentos: Acabamento[] = [
  { id: "a1", nome: "Ilhós", precoUnitario: 2, unidade: "un" },
]
const item: OrcamentoItem = {
  materialId: "m",
  servicoId: "nenhum",
  largura: 2,
  altura: 1,
  quantidadeUnidades: 3,
  horasEstimadas: 0,
  acabamentos: [{ acabamentoId: "a1", quantidade: 10 }],
  margemPercent: 30,
  impostoPercent: 6,
}

describe("gerarLinhasOrcamento", () => {
  const resultado = calcularOrcamentoCompleto(item, material, null, 0, acabamentos, [])

  it("a soma das linhas bate com o total", () => {
    const linhas = gerarLinhasOrcamento({
      item,
      nomeMaterial: "LONA",
      unidadeMaterial: "m2",
      acabamentosDisponiveis: acabamentos,
      resultado,
      total: resultado.total,
    })
    const soma = linhas.reduce((s, l) => s + l.valorTotal, 0)
    expect(Math.round(soma * 100)).toBe(Math.round(resultado.total * 100))
    expect(linhas[0].nome).toBe("LONA 2,00 x 1,00 m")
    expect(linhas[0].quantidade).toBe(3)
    expect(linhas[1].nome).toBe("Ilhós")
    expect(linhas[1].quantidade).toBe(10)
  })

  it("usa uma linha só quando não há custo calculado", () => {
    const vazio = { ...resultado, subtotalMaterial: 0, subtotalMaoDeObra: 0 }
    const linhas = gerarLinhasOrcamento({
      item: { ...item, acabamentos: [] },
      nomeMaterial: "LONA",
      unidadeMaterial: "m2",
      acabamentosDisponiveis: acabamentos,
      resultado: vazio,
      total: 100,
    })
    expect(linhas).toHaveLength(1)
    expect(linhas[0].valorTotal).toBe(100)
  })

  it("gera uma linha de produto por item adicional e a soma bate com o total", () => {
    const comExtra: OrcamentoItem = {
      ...item,
      itensAdicionais: [
        {
          id: "ad-1",
          materialId: "m",
          servicoId: "nenhum",
          largura: 1,
          altura: 1,
          quantidadeUnidades: 2,
          horasEstimadas: 0,
          acabamentos: [{ acabamentoId: "a1", quantidade: 4 }],
        },
      ],
    }
    const r = calcularOrcamentoCompleto(comExtra, material, null, 0, acabamentos, [], {
      materiais: [material],
      servicos: [],
    })
    const linhas = gerarLinhasOrcamento({
      item: comExtra,
      nomeMaterial: "LONA",
      unidadeMaterial: "m2",
      acabamentosDisponiveis: acabamentos,
      resultado: r,
      total: r.total,
      adicionais: [{ item: comExtra.itensAdicionais![0], nomeMaterial: "LONA", unidadeMaterial: "m2" }],
    })
    expect(linhas.map((l) => l.nome)).toEqual([
      "LONA 2,00 x 1,00 m", // principal
      "Ilhós", // acabamentos do principal
      "LONA 1,00 x 1,00 m", // adicional
      "Ilhós", // acabamentos do adicional
    ])
    expect(linhas[2].quantidade).toBe(2)
    expect(linhas[3].quantidade).toBe(4)
    const soma = linhas.reduce((s, l) => s + l.valorTotal, 0)
    expect(Math.round(soma * 100)).toBe(Math.round(r.total * 100))
  })
})

describe("formatarNumeroOrcamento", () => {
  it("usa 4 dígitos e o ano com 2", () => {
    expect(formatarNumeroOrcamento(129, "2025-09-19T12:00:00.000Z")).toBe("0129-25")
  })
})
