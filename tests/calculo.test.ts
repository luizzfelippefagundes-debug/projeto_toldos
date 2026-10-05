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
