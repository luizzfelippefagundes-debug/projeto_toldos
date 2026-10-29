import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DataProvider } from "@/context/data-context"
import { SincronizadorOffline } from "@/components/offline/sincronizador-offline"
import { enfileirar, listarFila } from "@/lib/offline/fila"
import type { Armazenamento } from "@/lib/offline/armazenamento"
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

// O componente usa armazenamentoLocal() (IndexedDB); aqui ele devolve um
// armazenamento em memória, trocado a cada teste.
const local = vi.hoisted(() => ({ atual: null as Armazenamento | null }))
vi.mock("@/lib/offline/armazenamento", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/offline/armazenamento")>()
  return { ...original, armazenamentoLocal: () => local.atual! }
})

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

  const fetchFalso = async (url: string, init?: RequestInit) => {
    const [, , tabela, id] = url.split("/")
    const linhas = tabelas[tabela] ?? (tabelas[tabela] = [])
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
  return { tabelas, fetchFalso }
}

describe("SincronizadorOffline", () => {
  let banco: ReturnType<typeof criarBancoFalso>

  beforeEach(async () => {
    const { criarArmazenamentoMemoria } = await vi.importActual<
      typeof import("@/lib/offline/armazenamento")
    >("@/lib/offline/armazenamento")
    local.atual = criarArmazenamentoMemoria()
    banco = criarBancoFalso()
    vi.stubGlobal("fetch", vi.fn(banco.fetchFalso))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("não renderiza nada quando a fila está vazia", async () => {
    const { container } = render(
      <DataProvider>
        <SincronizadorOffline />
      </DataProvider>
    )
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/orcamentos"))
    await new Promise((r) => setTimeout(r, 50))
    expect(container.innerHTML).toBe("")
  })

  it("fecha o orçamento da fila com o id da fila e a faixa some", async () => {
    await enfileirar(local.atual!, {
      id: "orc-offline-1",
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
      validadeDias: 7,
      fotos: [],
      totalProvisorio: 0,
      criadoEm: "2026-10-28T10:00:00.000Z",
    })

    render(
      <DataProvider>
        <SincronizadorOffline />
      </DataProvider>
    )

    expect(await screen.findByText("1 orçamento aguardando envio")).toBeTruthy()

    await waitFor(
      () => {
        expect(banco.tabelas.orcamentos.some((o) => o.id === "orc-offline-1")).toBe(true)
        expect(screen.queryByText("1 orçamento aguardando envio")).toBeNull()
      },
      { timeout: 12000 }
    )
    expect(await listarFila(local.atual!)).toEqual([])
  }, 15000)
})
