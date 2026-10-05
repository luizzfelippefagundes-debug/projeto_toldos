import type { PropsWithChildren } from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { DataProvider, useData } from "@/context/data-context"
import { materiaisSeed } from "@/lib/seed-data"
import type { OrcamentoItem } from "@/lib/types"

function wrapper({ children }: PropsWithChildren) {
  return <DataProvider>{children}</DataProvider>
}

function criarDadosOrcamento(item?: Partial<OrcamentoItem>) {
  return {
    clienteId: "cli-1",
    item: {
      materialId: "mat-1",
      servicoId: "srv-1",
      largura: 3,
      altura: 2,
      quantidadeUnidades: 1,
      horasEstimadas: 0,
      ...item,
    },
    ajusteManual: 0,
    anexoNome: "fachada.jpg",
    validadeDias: 7,
  }
}

describe("fluxos de dados", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("atualiza o saldo e mantém o histórico ao registrar entrada de estoque", async () => {
    const { result } = renderHook(() => useData(), { wrapper })
    const estoqueInicial = materiaisSeed.find((m) => m.id === "mat-1")!

    act(() => {
      result.current.addEntradaEstoque({
        materialId: estoqueInicial.id,
        quantidade: 5,
        comNotaFiscal: false,
      })
    })

    await waitFor(() => {
      expect(
        result.current.materiais.find((m) => m.id === estoqueInicial.id)
          ?.quantidadeEstoque
      ).toBe(estoqueInicial.quantidadeEstoque + 5)
      expect(result.current.entradasEstoque[0].quantidade).toBe(5)
    })
  })

  it("cria e atualiza cadastros e persiste alterações no navegador", async () => {
    const { result, unmount } = renderHook(() => useData(), { wrapper })
    let materialId = ""
    let clienteId = ""

    act(() => {
      materialId = result.current.addMaterial({
        nome: "PVC de teste",
        tipo: "PVC",
        unidade: "m2",
        precoUnitario: 50,
        estoqueMinimo: 10,
        quantidadeEstoque: 20,
      }).id
      result.current.updateMaterial(materialId, {
        nome: "PVC de teste atualizado",
        tipo: "PVC",
        unidade: "m2",
        precoUnitario: 55,
        estoqueMinimo: 12,
        quantidadeEstoque: 0,
      })
      clienteId = result.current.addCliente({
        nome: "Cliente de teste",
        telefone: "(11) 90000-0000",
      }).id
      result.current.addServico({
        nome: "Instalação de teste",
        formaCobranca: "hora",
        valor: 75,
      })
      result.current.addProdutoRapido({
        nome: "Banner de teste",
        categoria: "Banner",
        prazoDias: 2,
        temAcabamento: false,
        variantes: [{ id: "banner-p", nome: "P", preco: 30 }],
      })
      const lancamento = result.current.addLancamento({
        descricao: "Despesa de teste",
        tipo: "despesa",
        categoria: "Teste",
        valor: 20,
        vencimento: "2026-10-05T00:00:00.000Z",
        status: "pendente",
        origem: "manual",
        origemId: null,
      })
      result.current.marcarLancamentoStatus(lancamento.id, "pago")
    })

    await waitFor(() => {
      expect(
        result.current.materiais.find((m) => m.id === materialId)
      ).toMatchObject({
        nome: "PVC de teste atualizado",
        precoUnitario: 55,
        quantidadeEstoque: 0,
      })
      expect(result.current.clientes.some((c) => c.id === clienteId)).toBe(true)
      expect(result.current.servicos.some((s) => s.nome === "Instalação de teste")).toBe(
        true
      )
      expect(result.current.produtosRapidos.some((p) => p.nome === "Banner de teste")).toBe(
        true
      )
      expect(
        result.current.lancamentos.find((l) => l.descricao === "Despesa de teste")
          ?.status
      ).toBe("pago")
      expect(
        result.current.lancamentos.find((l) => l.descricao === "Despesa de teste")
          ?.pagoEm
      ).toBeTruthy()
      expect(window.localStorage.getItem("toldosys.materiais")).not.toBeNull()
    })

    const lancamentoPago = result.current.lancamentos.find(
      (l) => l.descricao === "Despesa de teste"
    )!
    act(() => result.current.marcarLancamentoStatus(lancamentoPago.id, "pendente"))
    await waitFor(() => {
      expect(
        result.current.lancamentos.find((l) => l.id === lancamentoPago.id)
      ).toMatchObject({ status: "pendente", pagoEm: undefined })
    })

    unmount()
    const recarregado = renderHook(() => useData(), { wrapper })
    await waitFor(() => {
      expect(
        recarregado.result.current.materiais.find((m) => m.id === materialId)
          ?.nome
      ).toBe("PVC de teste atualizado")
    })
  })

  it("fecha orçamento uma vez e estorna estoque e receita ao reabrir", async () => {
    const { result } = renderHook(() => useData(), { wrapper })
    const estoqueInicial = materiaisSeed.find((m) => m.id === "mat-1")!
    let orcamentoId = ""

    act(() => {
      orcamentoId = result.current.fecharOrcamento(criarDadosOrcamento()).id
    })

    await waitFor(() => {
      expect(
        result.current.materiais.find((m) => m.id === estoqueInicial.id)
          ?.quantidadeEstoque
      ).toBe(estoqueInicial.quantidadeEstoque - 6)
      expect(
        result.current.lancamentos.filter((l) => l.origemId === orcamentoId)
      ).toHaveLength(1)
      expect(
        result.current.orcamentos.find((o) => o.id === orcamentoId)
      ).toMatchObject({
        quantidadeMaterialDebitada: 6,
        totalFechado: 418,
        materialFechado: {
          id: "mat-1",
          unidade: "m2",
          quantidade: 6,
        },
      })
      expect(
        result.current.orcamentos.find((o) => o.id === orcamentoId)
          ?.servicoFechado?.nome
      ).toBeTruthy()
    })

    act(() => {
      result.current.updateMaterial(estoqueInicial.id, {
        ...estoqueInicial,
        unidade: "unidade",
        precoUnitario: 100,
        quantidadeEstoque: estoqueInicial.quantidadeEstoque - 6,
      })
    })

    let reaberto = false
    act(() => {
      reaberto = result.current.reabrirOrcamento(orcamentoId)
    })

    await waitFor(() => {
      expect(reaberto).toBe(true)
      expect(
        result.current.orcamentos.find((o) => o.id === orcamentoId)?.status
      ).toBe("aberto")
      expect(
        result.current.materiais.find((m) => m.id === estoqueInicial.id)
          ?.quantidadeEstoque
      ).toBe(estoqueInicial.quantidadeEstoque)
      expect(
        result.current.lancamentos.some((l) => l.origemId === orcamentoId)
      ).toBe(false)
    })

    const materialAtualizado = result.current.materiais.find(
      (m) => m.id === estoqueInicial.id
    )!
    act(() => {
      result.current.updateMaterial(estoqueInicial.id, {
        ...materialAtualizado,
        unidade: "m2",
        quantidadeEstoque: materialAtualizado.quantidadeEstoque,
      })
    })

    let segundoOrcamentoId = ""
    act(() => {
      segundoOrcamentoId = result.current.fecharOrcamento(
        criarDadosOrcamento()
      ).id
    })

    await waitFor(() => {
      expect(
        result.current.materiais.find((m) => m.id === estoqueInicial.id)
          ?.quantidadeEstoque
      ).toBe(estoqueInicial.quantidadeEstoque - 6)
      expect(
        result.current.lancamentos.filter(
          (l) => l.origemId === segundoOrcamentoId
        )
      ).toHaveLength(1)
      expect(
        result.current.orcamentos.find((o) => o.id === segundoOrcamentoId)
          ?.totalFechado
      ).toBe(850)
    })
  })

  it("estorna só a quantidade realmente debitada quando o estoque era insuficiente", async () => {
    const { result } = renderHook(() => useData(), { wrapper })
    const material = materiaisSeed.find((m) => m.id === "mat-1")!
    let orcamentoId = ""

    act(() => {
      result.current.updateMaterial(material.id, {
        ...material,
        quantidadeEstoque: 2,
      })
    })

    await waitFor(() => {
      expect(
        result.current.materiais.find((m) => m.id === material.id)
          ?.quantidadeEstoque
      ).toBe(2)
    })

    act(() => {
      orcamentoId = result.current.fecharOrcamento(criarDadosOrcamento()).id
    })

    await waitFor(() => {
      expect(
        result.current.orcamentos.find((o) => o.id === orcamentoId)
          ?.quantidadeMaterialDebitada
      ).toBe(2)
      expect(
        result.current.materiais.find((m) => m.id === material.id)
          ?.quantidadeEstoque
      ).toBe(0)
    })

    act(() => result.current.reabrirOrcamento(orcamentoId))

    await waitFor(() => {
      expect(
        result.current.materiais.find((m) => m.id === material.id)
          ?.quantidadeEstoque
      ).toBe(2)
    })
  })

  it("impede reabrir orçamento com receita paga sem alterar seus registros", async () => {
    const { result } = renderHook(() => useData(), { wrapper })
    const estoqueInicial = materiaisSeed.find((m) => m.id === "mat-1")!
    let orcamentoId = ""

    act(() => {
      orcamentoId = result.current.fecharOrcamento(criarDadosOrcamento()).id
    })

    await waitFor(() => {
      expect(
        result.current.lancamentos.some((l) => l.origemId === orcamentoId)
      ).toBe(true)
    })

    const lancamento = result.current.lancamentos.find(
      (l) => l.origemId === orcamentoId
    )!
    act(() => result.current.marcarLancamentoStatus(lancamento.id, "pago"))

    let reaberto = true
    act(() => {
      reaberto = result.current.reabrirOrcamento(orcamentoId)
    })

    await waitFor(() => {
      expect(reaberto).toBe(false)
      expect(
        result.current.orcamentos.find((o) => o.id === orcamentoId)?.status
      ).toBe("fechado")
      expect(
        result.current.materiais.find((m) => m.id === estoqueInicial.id)
          ?.quantidadeEstoque
      ).toBe(estoqueInicial.quantidadeEstoque - 6)
      expect(
        result.current.lancamentos.find((l) => l.id === lancamento.id)?.status
      ).toBe("pago")
    })
  })

  it("gera só uma receita ao aprovar o pedido e avançar na produção", async () => {
    const { result } = renderHook(() => useData(), { wrapper })
    let pedidoId = ""

    act(() => {
      pedidoId = result.current.addPedidoRapido({
        produtoId: "prod-1",
        varianteId: "prod-1-a4",
        acabamento: null,
        clienteNome: "Cliente teste",
        clienteTelefone: "(11) 90000-0000",
        observacao: "",
        total: 18,
        status: "aguardando",
      }).id
    })

    act(() => result.current.moverPedidoRapido(pedidoId, "aprovado"))
    act(() => result.current.moverPedidoRapido(pedidoId, "arte"))

    await waitFor(() => {
      expect(
        result.current.lancamentos.filter(
          (l) => l.origem === "pedido-rapido" && l.origemId === pedidoId
        )
      ).toHaveLength(1)
      expect(result.current.pedidosRapidos[0].status).toBe("arte")
    })
  })

  it("mantém íntegros os dados opcionais ao duplicar um orçamento", async () => {
    const { result } = renderHook(() => useData(), { wrapper })
    const item: OrcamentoItem = {
      materialId: "mat-1",
      servicoId: "srv-1",
      largura: 2,
      altura: 3,
      quantidadeUnidades: 1,
      horasEstimadas: 2,
      acabamentos: [{ acabamentoId: "acb-1", quantidade: 12 }],
      instalacao: {
        incluida: true,
        horas: 3,
        custoHora: 45,
        numAjudantes: 1,
        diariaAjudante: 100,
        equipamentoId: "equ-2",
      },
      deslocamento: {
        incluido: true,
        distanciaKm: 20,
        custoPorKm: 2,
        pedagio: 10,
        alimentacao: 30,
      },
      margemPercent: 25,
      descontoPercent: 5,
      impostoPercent: 8,
    }
    let orcamentoId = ""

    act(() => {
      orcamentoId = result.current.fecharOrcamento(criarDadosOrcamento(item)).id
    })

    await waitFor(() => {
      expect(result.current.orcamentos.some((o) => o.id === orcamentoId)).toBe(
        true
      )
    })

    act(() => result.current.duplicarOrcamento(orcamentoId))

    await waitFor(() => {
      expect(result.current.rascunho?.item).toEqual(item)
      expect(result.current.rascunho?.clienteId).toBe("cli-1")
    })
  })
})
