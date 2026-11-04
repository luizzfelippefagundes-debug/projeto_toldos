import { act, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DataProvider, useData } from "@/context/data-context"
import { PapelAtivoProvider } from "@/context/papel-ativo-context"
import ProducaoPage from "@/app/(app)/producao/page"
import {
  clientesSeed,
  entradasEstoqueSeed,
  lancamentosFinanceirosSeed,
  materiaisSeed,
  mensagensBotSeed,
  pedidosRapidosSeed,
  produtosRapidosSeed,
  servicosSeed,
} from "@/lib/seed-data"

type Registro = { id: string } & Record<string, unknown>

// Mesmo padrão de tests/fluxo-telas.test.tsx: banco em memória que imita as
// rotas /api/* usadas pelo DataProvider, sem orçamentos no começo.
function bancoFalso() {
  const tabelas: Record<string, Registro[]> = {
    materiais: structuredClone(materiaisSeed),
    servicos: structuredClone(servicosSeed),
    clientes: structuredClone(clientesSeed),
    orcamentos: [],
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

function criarDadosOrcamento() {
  return {
    clienteId: "cli-1",
    item: {
      materialId: "mat-1",
      servicoId: "srv-1",
      largura: 3,
      altura: 2,
      quantidadeUnidades: 1,
      horasEstimadas: 0,
    },
    ajusteManual: 0,
    anexoNome: null as string | null,
    validadeDias: 7,
  }
}

describe("Produção: orçamentos de toldo com OS emitida", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(bancoFalso()))
  })
  afterEach(() => vi.unstubAllGlobals())

  it("orçamento fechado sem OS emitida não aparece no quadro", async () => {
    let ref: ReturnType<typeof useData> | null = null
    function Ponte() {
      ref = useData()
      return null
    }
    function Harness() {
      return (
        <PapelAtivoProvider papelInicial="dono">
          <DataProvider>
            <Ponte />
            <ProducaoPage />
          </DataProvider>
        </PapelAtivoProvider>
      )
    }
    const tela = render(<Harness />)
    await waitFor(() => expect(ref!.materiais.length).toBeGreaterThan(0))

    let id = ""
    act(() => {
      id = ref!.fecharOrcamento(criarDadosOrcamento()).id
    })
    await waitFor(() => expect(ref!.orcamentos.some((o) => o.id === id)).toBe(true))

    expect(tela.container.textContent).not.toContain(`OS #${ref!.orcamentos[0].numero}`)
  })

  it("ao emitir a OS, o orçamento aparece no quadro na coluna Aprovado", async () => {
    let ref: ReturnType<typeof useData> | null = null
    function Ponte() {
      ref = useData()
      return null
    }
    function Harness() {
      return (
        <PapelAtivoProvider papelInicial="dono">
          <DataProvider>
            <Ponte />
            <ProducaoPage />
          </DataProvider>
        </PapelAtivoProvider>
      )
    }
    const tela = render(<Harness />)
    await waitFor(() => expect(ref!.materiais.length).toBeGreaterThan(0))

    let id = ""
    act(() => {
      id = ref!.fecharOrcamento(criarDadosOrcamento()).id
    })
    await waitFor(() => expect(ref!.orcamentos.some((o) => o.id === id)).toBe(true))
    const numero = ref!.orcamentos.find((o) => o.id === id)!.numero

    act(() => {
      ref!.emitirOsOrcamento(id)
    })

    await waitFor(() => {
      expect(tela.container.textContent).toContain(`OS #${numero}`)
      expect(tela.container.textContent).toContain("Padaria Pão Dourado")
    })
    // Card nasce em "Aprovado": procura o botão de status ativo dentro do card.
    const botaoAprovado = Array.from(tela.container.querySelectorAll("button")).find(
      (b) => b.textContent === "Aprovado" && b.className.includes("text-white")
    )
    expect(botaoAprovado).toBeTruthy()
  })

  it("mover o card do orçamento muda a etapa dele", async () => {
    let ref: ReturnType<typeof useData> | null = null
    function Ponte() {
      ref = useData()
      return null
    }
    function Harness() {
      return (
        <PapelAtivoProvider papelInicial="dono">
          <DataProvider>
            <Ponte />
            <ProducaoPage />
          </DataProvider>
        </PapelAtivoProvider>
      )
    }
    render(<Harness />)
    await waitFor(() => expect(ref!.materiais.length).toBeGreaterThan(0))

    let id = ""
    act(() => {
      id = ref!.fecharOrcamento(criarDadosOrcamento()).id
    })
    await waitFor(() => expect(ref!.orcamentos.some((o) => o.id === id)).toBe(true))
    act(() => {
      ref!.emitirOsOrcamento(id)
    })
    await waitFor(() =>
      expect(ref!.orcamentos.find((o) => o.id === id)?.statusProducao).toBe("aprovado")
    )

    act(() => {
      ref!.moverStatusProducaoOrcamento(id, "arte")
    })

    await waitFor(() =>
      expect(ref!.orcamentos.find((o) => o.id === id)?.statusProducao).toBe("arte")
    )
  })
})
