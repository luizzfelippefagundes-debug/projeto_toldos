import { describe, expect, it } from "vitest"
import {
  calcularOrcamento,
  calcularOrcamentoCompleto,
  quantidadeMaterialConsumida,
} from "@/lib/calculo"
import type {
  Acabamento,
  EquipamentoAcesso,
  Material,
  OrcamentoItem,
  Servico,
} from "@/lib/types"

const materialM2: Material = {
  id: "material-m2",
  nome: "Lona",
  tipo: "Lona",
  unidade: "m2",
  precoUnitario: 28,
  estoqueMinimo: 0,
  quantidadeEstoque: 100,
}

const servicoFixo: Servico = {
  id: "servico-fixo",
  nome: "Instalação",
  formaCobranca: "fixo",
  valor: 250,
}

const itemBasico: OrcamentoItem = {
  materialId: materialM2.id,
  servicoId: servicoFixo.id,
  largura: 3,
  altura: 2,
  quantidadeUnidades: 1,
  horasEstimadas: 4,
}

describe("cálculo de orçamento", () => {
  it("calcula área, material por m², serviço fixo e ajuste manual", () => {
    expect(
      calcularOrcamento(itemBasico, materialM2, servicoFixo, -10)
    ).toEqual({
      areaM2: 6,
      subtotalMaterial: 168,
      subtotalMaoDeObra: 250,
      total: 408,
    })
  })

  it("calcula consumo por unidade e mão de obra por hora", () => {
    const materialPorUnidade: Material = {
      ...materialM2,
      unidade: "unidade",
      precoUnitario: 48,
    }
    const servicoPorHora: Servico = {
      ...servicoFixo,
      formaCobranca: "hora",
      valor: 60,
    }
    const item = { ...itemBasico, quantidadeUnidades: 5 }

    expect(quantidadeMaterialConsumida(item, materialPorUnidade)).toBe(5)
    expect(calcularOrcamento(item, materialPorUnidade, servicoPorHora, 0)).toEqual({
      areaM2: 6,
      subtotalMaterial: 240,
      subtotalMaoDeObra: 240,
      total: 480,
    })
  })

  it("calcula mão de obra por m² e percentual sobre material", () => {
    const porMetroQuadrado = calcularOrcamento(
      itemBasico,
      materialM2,
      { ...servicoFixo, formaCobranca: "m2", valor: 35 },
      0
    )
    const percentual = calcularOrcamento(
      itemBasico,
      materialM2,
      { ...servicoFixo, formaCobranca: "percentual", valor: 15 },
      0
    )

    expect(porMetroQuadrado.subtotalMaoDeObra).toBe(210)
    expect(percentual.subtotalMaoDeObra).toBeCloseTo(25.2)
  })

  it("combina acabamentos, instalação, deslocamento, margem, desconto, imposto e ajuste", () => {
    const item: OrcamentoItem = {
      ...itemBasico,
      largura: 2,
      altura: 3,
      acabamentos: [{ acabamentoId: "acb-1", quantidade: 4 }],
      instalacao: {
        incluida: true,
        horas: 2,
        custoHora: 30,
        numAjudantes: 2,
        diariaAjudante: 40,
        equipamentoId: "equ-1",
      },
      deslocamento: {
        incluido: true,
        distanciaKm: 12,
        custoPorKm: 2,
        pedagio: 8,
        alimentacao: 10,
      },
      margemPercent: 10,
      descontoPercent: 10,
      impostoPercent: 6,
    }
    const acabamentos: Acabamento[] = [
      { id: "acb-1", nome: "Ilhós", precoUnitario: 2, unidade: "un" },
    ]
    const equipamentos: EquipamentoAcesso[] = [
      { id: "equ-1", nome: "Andaime", precoDiaria: 50 },
    ]
    const resultado = calcularOrcamentoCompleto(
      item,
      { ...materialM2, precoUnitario: 10 },
      { ...servicoFixo, formaCobranca: "m2", valor: 5 },
      -5,
      acabamentos,
      equipamentos
    )

    expect(resultado.areaM2).toBe(6)
    expect(resultado.subtotalMaterial).toBe(60)
    expect(resultado.subtotalMaoDeObra).toBe(30)
    expect(resultado.subtotalAcabamentos).toBe(8)
    expect(resultado.subtotalInstalacao).toBe(190)
    expect(resultado.subtotalDeslocamento).toBe(42)
    expect(resultado.custoBase).toBe(330)
    expect(resultado.comMargem).toBeCloseTo(363)
    expect(resultado.comDesconto).toBeCloseTo(326.7)
    expect(resultado.valorImposto).toBeCloseTo(19.602)
    expect(resultado.total).toBeCloseTo(341.302)
  })

  it("preserva o total dos orçamentos antigos sem os campos opcionais", () => {
    const resultado = calcularOrcamentoCompleto(
      itemBasico,
      materialM2,
      servicoFixo,
      0,
      [],
      []
    )

    expect(resultado.total).toBe(418)
    expect(resultado.subtotalAcabamentos).toBe(0)
    expect(resultado.subtotalInstalacao).toBe(0)
    expect(resultado.subtotalDeslocamento).toBe(0)
  })
})

describe("quantidade em material por m²", () => {
  it("multiplica a área pela quantidade de peças", () => {
    const item = { ...itemBasico, quantidadeUnidades: 3 }
    const r = calcularOrcamento(item, materialM2, null, 0)
    expect(r.areaM2).toBe(6 * 3)
    expect(quantidadeMaterialConsumida(item, materialM2)).toBe(18)
    expect(r.subtotalMaterial).toBe(18 * materialM2.precoUnitario)
  })

  it("trata quantidade zerada (orçamento antigo) como 1 peça", () => {
    const item = { ...itemBasico, quantidadeUnidades: 0 }
    expect(quantidadeMaterialConsumida(item, materialM2)).toBe(6)
  })
})

describe("orçamento com itens adicionais", () => {
  const catalogo = { materiais: [materialM2], servicos: [servicoFixo] }

  it("sem adicionais o resultado é o mesmo de antes e tem um item", () => {
    const r = calcularOrcamentoCompleto(itemBasico, materialM2, servicoFixo, 0, [], [], catalogo)
    expect(r.subtotalMaterial).toBe(168)
    expect(r.subtotalMaoDeObra).toBe(250)
    expect(r.total).toBe(418)
    expect(r.itens).toHaveLength(1)
    expect(r.itens[0]).toMatchObject({ subtotalMaterial: 168, subtotalMaoDeObra: 250 })
  })

  it("soma material, mão de obra e área dos adicionais ao total", () => {
    const item: OrcamentoItem = {
      ...itemBasico,
      itensAdicionais: [
        {
          id: "ad-1",
          materialId: materialM2.id,
          servicoId: "nenhum",
          largura: 1,
          altura: 1,
          quantidadeUnidades: 2,
          horasEstimadas: 0,
        },
      ],
    }
    const r = calcularOrcamentoCompleto(item, materialM2, servicoFixo, 0, [], [], catalogo)
    // principal: 3x2 = 6 m² x 28 = 168 + 250; adicional: 1x1x2 = 2 m² x 28 = 56
    expect(r.areaM2).toBe(8)
    expect(r.subtotalMaterial).toBe(224)
    expect(r.subtotalMaoDeObra).toBe(250)
    expect(r.total).toBe(474)
    expect(r.itens).toHaveLength(2)
    expect(r.itens[1]).toMatchObject({ materialId: materialM2.id, subtotalMaterial: 56, subtotalMaoDeObra: 0 })
  })

  it("aplica margem, desconto e imposto uma vez sobre o custo de todos os itens", () => {
    const item: OrcamentoItem = {
      ...itemBasico,
      margemPercent: 10,
      descontoPercent: 10,
      impostoPercent: 6,
      itensAdicionais: [
        {
          id: "ad-1",
          materialId: materialM2.id,
          servicoId: "nenhum",
          largura: 1,
          altura: 1,
          quantidadeUnidades: 2,
          horasEstimadas: 0,
        },
      ],
    }
    const r = calcularOrcamentoCompleto(item, materialM2, servicoFixo, 0, [], [], catalogo)
    // custo 474 -> com margem 521,4 -> com desconto 469,26 -> imposto 28,1556
    expect(r.custoBase).toBeCloseTo(474)
    expect(r.comDesconto).toBeCloseTo(469.26)
    expect(r.total).toBeCloseTo(497.4156)
  })

  it("soma os acabamentos dos adicionais", () => {
    const item: OrcamentoItem = {
      ...itemBasico,
      itensAdicionais: [
        {
          id: "ad-1",
          materialId: materialM2.id,
          servicoId: "nenhum",
          largura: 1,
          altura: 1,
          quantidadeUnidades: 1,
          horasEstimadas: 0,
          acabamentos: [{ acabamentoId: "acb-1", quantidade: 4 }],
        },
      ],
    }
    const acabamentos = [{ id: "acb-1", nome: "Ilhós", precoUnitario: 2, unidade: "un" }]
    const r = calcularOrcamentoCompleto(item, materialM2, servicoFixo, 0, acabamentos, [], catalogo)
    expect(r.subtotalAcabamentos).toBe(8)
    expect(r.itens[1].subtotalAcabamentos).toBe(8)
  })

  it("adicional com material removido conta zero e mantém o alinhamento da lista", () => {
    const item: OrcamentoItem = {
      ...itemBasico,
      itensAdicionais: [
        { id: "ad-1", materialId: "sumiu", servicoId: "nenhum", largura: 1, altura: 1, quantidadeUnidades: 1, horasEstimadas: 0 },
        { id: "ad-2", materialId: materialM2.id, servicoId: "nenhum", largura: 1, altura: 1, quantidadeUnidades: 1, horasEstimadas: 0 },
      ],
    }
    const r = calcularOrcamentoCompleto(item, materialM2, servicoFixo, 0, [], [], catalogo)
    expect(r.itens).toHaveLength(3)
    expect(r.itens[1].subtotalMaterial).toBe(0)
    expect(r.itens[2].subtotalMaterial).toBe(28)
  })
})
