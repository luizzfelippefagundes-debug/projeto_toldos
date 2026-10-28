import { describe, expect, it } from "vitest"
import {
  formParaItem,
  formVazio,
  itemParaForm,
  pendenciasItem,
} from "@/lib/item-adicional-form"
import type { Material, Servico } from "@/lib/types"

const lona: Material = {
  id: "lona", nome: "Lona", tipo: "Lona", unidade: "m2",
  precoUnitario: 10, estoqueMinimo: 0, quantidadeEstoque: 10,
}
const parafuso: Material = { ...lona, id: "parafuso", nome: "Parafuso", unidade: "unidade" }
const porM2: Servico = { id: "s-m2", nome: "Instalação", formaCobranca: "m2", valor: 5 }
const porHora: Servico = { id: "s-h", nome: "Montagem", formaCobranca: "hora", valor: 30 }

describe("item adicional (formulário)", () => {
  it("começa vazio, com quantidade 1 e sem serviço", () => {
    const f = formVazio("ad-1")
    expect(f).toMatchObject({ id: "ad-1", materialId: "", servicoId: "nenhum", quantidadeUnidades: "1" })
  })

  it("converte formulário em item (textos viram números, só acabamentos marcados com quantidade)", () => {
    const f = {
      ...formVazio("ad-1"),
      materialId: "lona",
      largura: "2,5".replace(",", "."),
      altura: "1",
      quantidadeUnidades: "3",
      acabamentos: {
        "acb-1": { ativo: true, qtd: "4" },
        "acb-2": { ativo: true, qtd: "" },
        "acb-3": { ativo: false, qtd: "9" },
      },
    }
    expect(formParaItem(f)).toEqual({
      id: "ad-1",
      materialId: "lona",
      servicoId: "nenhum",
      largura: 2.5,
      altura: 1,
      quantidadeUnidades: 3,
      horasEstimadas: 0,
      acabamentos: [{ acabamentoId: "acb-1", quantidade: 4 }],
    })
  })

  it("converte item em formulário e volta sem perder dados", () => {
    const item = {
      id: "ad-2", materialId: "lona", servicoId: "s-m2", largura: 2, altura: 3,
      quantidadeUnidades: 2, horasEstimadas: 1.5,
      acabamentos: [{ acabamentoId: "acb-1", quantidade: 4 }],
    }
    expect(formParaItem(itemParaForm(item))).toEqual(item)
  })
})

describe("pendenciasItem", () => {
  const materiais = [lona, parafuso]
  const servicos = [porM2, porHora]

  it("pede o material primeiro", () => {
    expect(pendenciasItem(formVazio("a"), materiais, servicos, 2)).toEqual([
      "Item 2: selecione o material",
    ])
  })

  it("pede medidas quando o material é por m²", () => {
    const f = { ...formVazio("a"), materialId: "lona" }
    expect(pendenciasItem(f, materiais, servicos, 2)).toEqual([
      "Item 2: preencha as medidas corretamente",
    ])
    expect(pendenciasItem({ ...f, largura: "2", altura: "1" }, materiais, servicos, 2)).toEqual([])
  })

  it("material por unidade só precisa da quantidade", () => {
    const f = { ...formVazio("a"), materialId: "parafuso", quantidadeUnidades: "5" }
    expect(pendenciasItem(f, materiais, servicos, 3)).toEqual([])
  })

  it("quantidade precisa ser inteira e maior que zero", () => {
    const f = { ...formVazio("a"), materialId: "parafuso", quantidadeUnidades: "1.5" }
    expect(pendenciasItem(f, materiais, servicos, 3)).toEqual([
      "Item 3: preencha as medidas corretamente",
    ])
  })

  it("serviço por m² exige medidas mesmo com material por unidade", () => {
    const f = { ...formVazio("a"), materialId: "parafuso", servicoId: "s-m2" }
    expect(pendenciasItem(f, materiais, servicos, 2)).toEqual([
      "Item 2: preencha as medidas corretamente",
    ])
  })

  it("serviço por hora exige as horas", () => {
    const f = { ...formVazio("a"), materialId: "parafuso", servicoId: "s-h" }
    expect(pendenciasItem(f, materiais, servicos, 2)).toEqual([
      "Item 2: informe as horas estimadas do serviço",
    ])
  })

  it("acabamento marcado sem quantidade trava", () => {
    const f = {
      ...formVazio("a"),
      materialId: "parafuso",
      acabamentos: { "acb-1": { ativo: true, qtd: "" } },
    }
    expect(pendenciasItem(f, materiais, servicos, 2)).toEqual([
      "Item 2: informe a quantidade dos acabamentos marcados",
    ])
  })
})
