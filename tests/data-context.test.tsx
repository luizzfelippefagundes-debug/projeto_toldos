import type { PropsWithChildren } from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DataProvider, useData } from "@/context/data-context"
import {
  clientesSeed,
  entradasEstoqueSeed,
  lancamentosFinanceirosSeed,
  materiaisSeed,
  mensagensBotSeed,
  orcamentosSeed,
  pedidosRapidosSeed,
  produtosRapidosSeed,
  servicosSeed,
} from "@/lib/seed-data"
import type { OrcamentoItem } from "@/lib/types"

type Registro = { id: string } & Record<string, unknown>

// Banco em memória que imita as rotas /api/* usadas pelo DataProvider.
function criarBancoFalso() {
  const tabelas: Record<string, Registro[]> = {
    materiais: structuredClone(materiaisSeed),
    servicos: structuredClone(servicosSeed),
    clientes: structuredClone(clientesSeed),
    orcamentos: structuredClone(orcamentosSeed),
    "entradas-estoque": structuredClone(entradasEstoqueSeed),
    "produtos-rapidos": structuredClone(produtosRapidosSeed),
    "pedidos-rapidos": structuredClone(pedidosRapidosSeed),
    lancamentos: structuredClone(lancamentosFinanceirosSeed),
    "mensagens-bot": structuredClone(mensagensBotSeed),
  } as unknown as Record<string, Registro[]>

  return async (url: string, init?: RequestInit) => {
    const [, , tabela, id] = url.split("/")
    const linhas = tabelas[tabela]
    const metodo = init?.method ?? "GET"
    const corpo = init?.body ? JSON.parse(init.body as string) : undefined

    if (metodo === "GET") return Response.json(structuredClone(linhas))
    if (metodo === "POST") linhas.push(corpo)
    if (metodo === "PUT") {
      const i = linhas.findIndex((l) => l.id === id)
      if (i >= 0) linhas[i] = { ...linhas[i], ...corpo, id }
    }
    if (metodo === "DELETE") tabelas[tabela] = linhas.filter((l) => l.id !== id)
    return Response.json({ ok: true })
  }
}

function wrapper({ children }: PropsWithChildren) {
  return <DataProvider>{children}</DataProvider>
}

async function montar() {
  const hook = renderHook(() => useData(), { wrapper })
  await waitFor(() => expect(hook.result.current.materiais.length).toBeGreaterThan(0))
  return hook
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
    vi.stubGlobal("fetch", vi.fn(criarBancoFalso()))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("atualiza o saldo e mantém o histórico ao registrar entrada de estoque", async () => {
    const { result } = await montar()
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

  it("cria e atualiza cadastros e persiste alterações no banco", async () => {
    const { result, unmount } = await montar()
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
    const recarregado = await montar()
    await waitFor(() => {
      expect(
        recarregado.result.current.materiais.find((m) => m.id === materialId)
          ?.nome
      ).toBe("PVC de teste atualizado")
    })
  })

  it("fecha orçamento uma vez e estorna estoque e receita ao reabrir", async () => {
    const { result } = await montar()
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

  it("edita orçamento fechado refazendo estoque e receita sem mudar o número", async () => {
    const { result } = await montar()
    const estoqueInicial = materiaisSeed.find((m) => m.id === "mat-1")!
    let orcamento = { id: "", numero: 0 }

    act(() => {
      orcamento = result.current.fecharOrcamento(criarDadosOrcamento())
    })
    await waitFor(() =>
      expect(
        result.current.lancamentos.filter((l) => l.origemId === orcamento.id)
      ).toHaveLength(1)
    )
    const lancamentoId = result.current.lancamentos.find(
      (l) => l.origemId === orcamento.id
    )!.id

    let salvou = false
    act(() => {
      // 3 x 2 m -> 2 peças: consumo vai de 6 para 12 m²
      salvou = result.current.updateOrcamento(
        orcamento.id,
        criarDadosOrcamento({ quantidadeUnidades: 2 })
      )
    })

    await waitFor(() => {
      expect(salvou).toBe(true)
      expect(
        result.current.materiais.find((m) => m.id === estoqueInicial.id)
          ?.quantidadeEstoque
      ).toBe(estoqueInicial.quantidadeEstoque - 12)
      const editado = result.current.orcamentos.find((o) => o.id === orcamento.id)!
      expect(editado).toMatchObject({
        numero: orcamento.numero,
        status: "fechado",
        quantidadeMaterialDebitada: 12,
        materialFechado: { quantidade: 12 },
      })
      const receitas = result.current.lancamentos.filter(
        (l) => l.origemId === orcamento.id
      )
      expect(receitas).toHaveLength(1)
      expect(receitas[0].id).toBe(lancamentoId)
      expect(receitas[0].valor).toBe(editado.totalFechado)
    })
  })

  it("fecha de novo um orçamento reaberto mantendo o número", async () => {
    const { result } = await montar()
    const estoqueInicial = materiaisSeed.find((m) => m.id === "mat-1")!
    let orcamento = { id: "", numero: 0 }
    act(() => {
      orcamento = result.current.fecharOrcamento(criarDadosOrcamento())
    })
    await waitFor(() =>
      expect(result.current.lancamentos.some((l) => l.origemId === orcamento.id)).toBe(true)
    )
    act(() => {
      result.current.reabrirOrcamento(orcamento.id)
    })
    await waitFor(() =>
      expect(result.current.orcamentos.find((o) => o.id === orcamento.id)?.status).toBe("aberto")
    )

    act(() => {
      result.current.updateOrcamento(orcamento.id, criarDadosOrcamento(), { fechar: true })
    })

    await waitFor(() => {
      expect(result.current.orcamentos.find((o) => o.id === orcamento.id)).toMatchObject({
        status: "fechado",
        numero: orcamento.numero,
        quantidadeMaterialDebitada: 6,
      })
      expect(
        result.current.materiais.find((m) => m.id === estoqueInicial.id)?.quantidadeEstoque
      ).toBe(estoqueInicial.quantidadeEstoque - 6)
      expect(
        result.current.lancamentos.filter((l) => l.origemId === orcamento.id)
      ).toHaveLength(1)
    })
  })

  it("fecha com entrada de 50% criando entrada e restante, e refaz as parcelas ao editar", async () => {
    const { result } = await montar()
    let orcamento = { id: "", numero: 0 }
    act(() => {
      orcamento = result.current.fecharOrcamento(
        criarDadosOrcamento({ entradaPercent: 50 })
      )
    })

    await waitFor(() => {
      const parcelas = result.current.lancamentos.filter((l) => l.origemId === orcamento.id)
      expect(parcelas.map((l) => l.parcela).sort()).toEqual(["entrada", "restante"])
      const total = result.current.orcamentos.find((o) => o.id === orcamento.id)!.totalFechado!
      expect(parcelas.reduce((soma, l) => soma + l.valor, 0)).toBeCloseTo(total, 2)
      expect(parcelas.find((l) => l.parcela === "entrada")!.valor).toBeCloseTo(total / 2, 2)
    })
    const restanteAntes = result.current.lancamentos.find(
      (l) => l.origemId === orcamento.id && l.parcela === "restante"
    )!

    // Edita pra 2 peças e entrada de 30%: mesmas duas parcelas, valores novos.
    act(() => {
      result.current.updateOrcamento(
        orcamento.id,
        criarDadosOrcamento({ quantidadeUnidades: 2, entradaPercent: 30 })
      )
    })
    await waitFor(() => {
      const parcelas = result.current.lancamentos.filter((l) => l.origemId === orcamento.id)
      const total = result.current.orcamentos.find((o) => o.id === orcamento.id)!.totalFechado!
      expect(parcelas).toHaveLength(2)
      expect(parcelas.find((l) => l.parcela === "entrada")!.valor).toBeCloseTo(total * 0.3, 2)
      expect(parcelas.find((l) => l.parcela === "restante")!.id).toBe(restanteAntes.id)
    })

    // Volta pra pagamento único: sobra uma receita só, sem parcela.
    act(() => {
      result.current.updateOrcamento(orcamento.id, criarDadosOrcamento({ entradaPercent: 100 }))
    })
    await waitFor(() => {
      const parcelas = result.current.lancamentos.filter((l) => l.origemId === orcamento.id)
      expect(parcelas).toHaveLength(1)
      expect(parcelas[0].parcela).toBeUndefined()
    })
  })

  it("não edita orçamento depois que a entrada foi paga", async () => {
    const { result } = await montar()
    let orcamentoId = ""
    act(() => {
      orcamentoId = result.current.fecharOrcamento(criarDadosOrcamento({ entradaPercent: 50 })).id
    })
    await waitFor(() =>
      expect(result.current.lancamentos.filter((l) => l.origemId === orcamentoId)).toHaveLength(2)
    )
    const entrada = result.current.lancamentos.find(
      (l) => l.origemId === orcamentoId && l.parcela === "entrada"
    )!
    act(() => {
      result.current.marcarLancamentoStatus(entrada.id, "pago")
    })
    let salvou = true
    act(() => {
      salvou = result.current.updateOrcamento(orcamentoId, criarDadosOrcamento({ quantidadeUnidades: 2 }))
    })
    expect(salvou).toBe(false)
  })

  it("não edita orçamento fechado com receita paga", async () => {
    const { result } = await montar()
    let orcamentoId = ""
    act(() => {
      orcamentoId = result.current.fecharOrcamento(criarDadosOrcamento()).id
    })
    await waitFor(() =>
      expect(result.current.lancamentos.some((l) => l.origemId === orcamentoId)).toBe(true)
    )
    const receita = result.current.lancamentos.find((l) => l.origemId === orcamentoId)!
    act(() => {
      result.current.marcarLancamentoStatus(receita.id, "pago")
    })

    let salvou = true
    act(() => {
      salvou = result.current.updateOrcamento(
        orcamentoId,
        criarDadosOrcamento({ quantidadeUnidades: 2 })
      )
    })
    expect(salvou).toBe(false)
  })

  it("estorna só a quantidade realmente debitada quando o estoque era insuficiente", async () => {
    const { result } = await montar()
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

  const itemAcm = {
    id: "ad-1",
    materialId: "mat-2",
    servicoId: "nenhum",
    largura: 1,
    altura: 1,
    quantidadeUnidades: 2,
    horasEstimadas: 0,
  }

  it("baixa o estoque de todos os itens ao fechar e devolve ao reabrir", async () => {
    const { result } = await montar()
    const lona = materiaisSeed.find((m) => m.id === "mat-1")!
    const acm = materiaisSeed.find((m) => m.id === "mat-2")!
    let orcamentoId = ""

    act(() => {
      orcamentoId = result.current.fecharOrcamento(
        criarDadosOrcamento({ itensAdicionais: [itemAcm] })
      ).id
    })

    await waitFor(() => {
      const estoque = (id: string) =>
        result.current.materiais.find((m) => m.id === id)?.quantidadeEstoque
      expect(estoque("mat-1")).toBe(lona.quantidadeEstoque - 6)
      expect(estoque("mat-2")).toBe(acm.quantidadeEstoque - 2)
      expect(result.current.orcamentos.find((o) => o.id === orcamentoId)).toMatchObject({
        totalFechado: 608, // 418 do principal + 2 m² x 95 do adicional
        item: { itensAdicionais: [{ quantidadeMaterialDebitada: 2 }] },
      })
    })

    act(() => {
      result.current.reabrirOrcamento(orcamentoId)
    })

    await waitFor(() => {
      const estoque = (id: string) =>
        result.current.materiais.find((m) => m.id === id)?.quantidadeEstoque
      expect(estoque("mat-1")).toBe(lona.quantidadeEstoque)
      expect(estoque("mat-2")).toBe(acm.quantidadeEstoque)
    })
  })

  it("limita a baixa do adicional ao estoque e devolve só o que baixou", async () => {
    const { result } = await montar()
    const acm = materiaisSeed.find((m) => m.id === "mat-2")!
    let orcamentoId = ""

    act(() => {
      orcamentoId = result.current.fecharOrcamento(
        criarDadosOrcamento({
          itensAdicionais: [{ ...itemAcm, largura: 5, altura: 5 }], // pede 50 m², só há 12
        })
      ).id
    })

    await waitFor(() => {
      expect(
        result.current.materiais.find((m) => m.id === "mat-2")?.quantidadeEstoque
      ).toBe(0)
      expect(
        result.current.orcamentos.find((o) => o.id === orcamentoId)?.item.itensAdicionais?.[0]
          .quantidadeMaterialDebitada
      ).toBe(acm.quantidadeEstoque)
    })

    act(() => {
      result.current.reabrirOrcamento(orcamentoId)
    })

    await waitFor(() => {
      expect(
        result.current.materiais.find((m) => m.id === "mat-2")?.quantidadeEstoque
      ).toBe(acm.quantidadeEstoque)
    })
  })

  it("ao editar um orçamento fechado, remover o adicional devolve o material dele", async () => {
    const { result } = await montar()
    const lona = materiaisSeed.find((m) => m.id === "mat-1")!
    const acm = materiaisSeed.find((m) => m.id === "mat-2")!
    let orcamentoId = ""

    act(() => {
      orcamentoId = result.current.fecharOrcamento(
        criarDadosOrcamento({ itensAdicionais: [itemAcm] })
      ).id
    })
    await waitFor(() =>
      expect(result.current.materiais.find((m) => m.id === "mat-2")?.quantidadeEstoque).toBe(
        acm.quantidadeEstoque - 2
      )
    )

    act(() => {
      result.current.updateOrcamento(orcamentoId, criarDadosOrcamento())
    })

    await waitFor(() => {
      const estoque = (id: string) =>
        result.current.materiais.find((m) => m.id === id)?.quantidadeEstoque
      expect(estoque("mat-2")).toBe(acm.quantidadeEstoque)
      expect(estoque("mat-1")).toBe(lona.quantidadeEstoque - 6)
    })
  })

  it("soma a baixa quando o mesmo material está em dois itens e devolve tudo ao reabrir", async () => {
    const { result } = await montar()
    const lona = materiaisSeed.find((m) => m.id === "mat-1")!
    let orcamentoId = ""

    act(() => {
      orcamentoId = result.current.fecharOrcamento(
        criarDadosOrcamento({ itensAdicionais: [{ ...itemAcm, materialId: "mat-1" }] })
      ).id
    })
    await waitFor(() =>
      expect(result.current.materiais.find((m) => m.id === "mat-1")?.quantidadeEstoque).toBe(
        lona.quantidadeEstoque - 8 // 6 m² do principal + 2 m² do adicional
      )
    )

    act(() => {
      result.current.reabrirOrcamento(orcamentoId)
    })

    await waitFor(() =>
      expect(result.current.materiais.find((m) => m.id === "mat-1")?.quantidadeEstoque).toBe(
        lona.quantidadeEstoque
      )
    )
  })

  it("fechar pelo updateOrcamento um orçamento aberto com adicional baixa todos os itens", async () => {
    const { result } = await montar()
    const lona = materiaisSeed.find((m) => m.id === "mat-1")!
    const acm = materiaisSeed.find((m) => m.id === "mat-2")!
    let orcamentoId = ""

    act(() => {
      orcamentoId = result.current.fecharOrcamento(
        criarDadosOrcamento({ itensAdicionais: [itemAcm] })
      ).id
    })
    await waitFor(() =>
      expect(result.current.lancamentos.some((l) => l.origemId === orcamentoId)).toBe(true)
    )
    act(() => {
      result.current.reabrirOrcamento(orcamentoId)
    })
    await waitFor(() => {
      expect(result.current.orcamentos.find((o) => o.id === orcamentoId)?.status).toBe("aberto")
      expect(result.current.materiais.find((m) => m.id === "mat-2")?.quantidadeEstoque).toBe(
        acm.quantidadeEstoque
      )
    })

    act(() => {
      result.current.updateOrcamento(
        orcamentoId,
        criarDadosOrcamento({ itensAdicionais: [itemAcm] }),
        { fechar: true }
      )
    })

    await waitFor(() => {
      const estoque = (id: string) =>
        result.current.materiais.find((m) => m.id === id)?.quantidadeEstoque
      expect(estoque("mat-1")).toBe(lona.quantidadeEstoque - 6)
      expect(estoque("mat-2")).toBe(acm.quantidadeEstoque - 2)
      expect(result.current.orcamentos.find((o) => o.id === orcamentoId)).toMatchObject({
        status: "fechado",
        item: { itensAdicionais: [{ quantidadeMaterialDebitada: 2 }] },
      })
    })
  })

  it("ao editar um orçamento fechado, mudar a quantidade do adicional refaz a baixa dele", async () => {
    const { result } = await montar()
    const acm = materiaisSeed.find((m) => m.id === "mat-2")!
    let orcamentoId = ""

    act(() => {
      orcamentoId = result.current.fecharOrcamento(
        criarDadosOrcamento({ itensAdicionais: [itemAcm] })
      ).id
    })
    await waitFor(() =>
      expect(result.current.materiais.find((m) => m.id === "mat-2")?.quantidadeEstoque).toBe(
        acm.quantidadeEstoque - 2
      )
    )

    act(() => {
      result.current.updateOrcamento(
        orcamentoId,
        criarDadosOrcamento({ itensAdicionais: [{ ...itemAcm, quantidadeUnidades: 5 }] })
      )
    })

    await waitFor(() => {
      expect(result.current.materiais.find((m) => m.id === "mat-2")?.quantidadeEstoque).toBe(
        acm.quantidadeEstoque - 5
      )
      expect(
        result.current.orcamentos.find((o) => o.id === orcamentoId)?.item.itensAdicionais?.[0]
          .quantidadeMaterialDebitada
      ).toBe(5)
    })
  })

  it("excluir um orçamento fechado devolve o estoque de todos os itens", async () => {
    const { result } = await montar()
    const lona = materiaisSeed.find((m) => m.id === "mat-1")!
    const acm = materiaisSeed.find((m) => m.id === "mat-2")!
    let orcamentoId = ""

    act(() => {
      orcamentoId = result.current.fecharOrcamento(
        criarDadosOrcamento({ itensAdicionais: [itemAcm] })
      ).id
    })
    await waitFor(() =>
      expect(result.current.orcamentos.some((o) => o.id === orcamentoId)).toBe(true)
    )

    act(() => {
      result.current.removeOrcamento(orcamentoId)
    })

    await waitFor(() => {
      const estoque = (id: string) =>
        result.current.materiais.find((m) => m.id === id)?.quantidadeEstoque
      expect(estoque("mat-1")).toBe(lona.quantidadeEstoque)
      expect(estoque("mat-2")).toBe(acm.quantidadeEstoque)
    })
  })

  it("impede reabrir orçamento com receita paga sem alterar seus registros", async () => {
    const { result } = await montar()
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
    const { result } = await montar()
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
    const { result } = await montar()
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

  it("fecha o orçamento com o id recebido (idempotência do envio offline)", async () => {
    const { result } = await montar()
    let orcamento: { id: string } | undefined
    act(() => {
      orcamento = result.current.fecharOrcamento({ ...criarDadosOrcamento(), id: "orc-offline-1" })
    })
    expect(orcamento?.id).toBe("orc-offline-1")
    await waitFor(() =>
      expect(result.current.orcamentos.some((o) => o.id === "orc-offline-1")).toBe(true)
    )
  })

  it("sem id, o orçamento continua ganhando um id gerado", async () => {
    const { result } = await montar()
    let id = ""
    act(() => {
      id = result.current.fecharOrcamento(criarDadosOrcamento()).id
    })
    expect(id).toMatch(/^orc-/)
  })

  it("cadastra cliente com o id recebido", async () => {
    const { result } = await montar()
    let cliente: { id: string } | undefined
    act(() => {
      cliente = result.current.addCliente({ nome: "Seu José", telefone: "27988880000" }, "cli-offline-1")
    })
    expect(cliente?.id).toBe("cli-offline-1")
    await waitFor(() =>
      expect(result.current.clientes.some((c) => c.id === "cli-offline-1")).toBe(true)
    )
  })

  it("expõe `carregado` verdadeiro depois de carregar os dados do servidor", async () => {
    const { result } = await montar()
    await waitFor(() => expect(result.current.carregado).toBe(true))
  })
})
