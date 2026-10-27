import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DataProvider, useData } from "@/context/data-context"
import { LancamentoFormDialog } from "@/components/financeiro/lancamento-form-dialog"
import { LancamentoDetalheDialog } from "@/components/financeiro/lancamento-detalhe-dialog"
import {
  clientesSeed,
  entradasEstoqueSeed,
  materiaisSeed,
  mensagensBotSeed,
  pedidosRapidosSeed,
  produtosRapidosSeed,
  servicosSeed,
} from "@/lib/seed-data"
import type { LancamentoFinanceiro } from "@/lib/types"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

import FinanceiroPage from "@/app/(app)/financeiro/page"

type Registro = { id: string } & Record<string, unknown>

function parcela(n: number, mes: number, pago: boolean): LancamentoFinanceiro {
  return {
    id: `lan-strada-${n}`,
    descricao: "STRADA",
    tipo: "despesa",
    categoria: "FINANCIAMENTO STRADA",
    valor: 1000,
    vencimento: new Date(2026, mes, 28, 12).toISOString(),
    status: pago ? "pago" : "pendente",
    pagoEm: pago ? new Date(2026, mes, 28, 12).toISOString() : undefined,
    origem: "manual",
    origemId: null,
    criadoEm: "2026-10-27T10:00:00.000Z",
  }
}

function bancoFalso(lancamentos: LancamentoFinanceiro[]) {
  const t = {
    materiais: structuredClone(materiaisSeed),
    servicos: structuredClone(servicosSeed),
    clientes: structuredClone(clientesSeed),
    orcamentos: [],
    "entradas-estoque": structuredClone(entradasEstoqueSeed),
    "produtos-rapidos": structuredClone(produtosRapidosSeed),
    "pedidos-rapidos": structuredClone(pedidosRapidosSeed),
    lancamentos: structuredClone(lancamentos) as unknown as Registro[],
    "mensagens-bot": structuredClone(mensagensBotSeed),
  } as unknown as Record<string, Registro[]>
  return async (url: string, init?: RequestInit) => {
    const tabela = url.split("/")[2]
    const metodo = init?.method ?? "GET"
    if (metodo === "GET") return Response.json(structuredClone(t[tabela]))
    if (metodo === "POST") t[tabela].push(JSON.parse(init!.body as string))
    return Response.json({ ok: true })
  }
}

let ctx: ReturnType<typeof useData> | null = null
function Sonda() {
  const dados = useData()
  // Guarda o contexto fora da árvore pra o teste poder ler; só em teste.
  // eslint-disable-next-line react-hooks/globals
  ctx = dados
  return null
}

// Strada: 5 parcelas, as 3 primeiras já pagas (set–nov/2026 → índices de mês 7,8,9).
const strada = [parcela(1, 7, true), parcela(2, 8, true), parcela(3, 9, true), parcela(4, 10, false), parcela(5, 11, false)]

describe("séries no Financeiro", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(bancoFalso(strada)))
    if (!("PointerEvent" in window)) vi.stubGlobal("PointerEvent", MouseEvent)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("recolhe as parcelas pagas numa linha e abre ao clicar", async () => {
    render(
      <DataProvider>
        <Sonda />
        <FinanceiroPage />
      </DataProvider>
    )
    await waitFor(() => expect(ctx!.lancamentos).toHaveLength(5))

    // vira 1 linha de pagas + 2 pendentes (desktop e mobile renderizam, então usa getAll)
    expect((await screen.findAllByText(/3 parcelas pagas/)).length).toBeGreaterThan(0)
    expect(screen.queryAllByText("Baixado em", { exact: false })).toHaveLength(0)

    fireEvent.click(screen.getAllByText(/3 parcelas pagas/)[0])
    await waitFor(() => expect(screen.queryAllByText(/3 parcelas pagas/)).toHaveLength(0))
    expect(screen.getAllByText("Recolher parcelas pagas").length).toBe(1)
    // abertas: as 3 pagas aparecem uma a uma
    expect(screen.getAllByText(/Baixado em/).length).toBe(3)

    fireEvent.click(screen.getByText("Recolher parcelas pagas"))
    await waitFor(() => expect(screen.getAllByText(/3 parcelas pagas/).length).toBeGreaterThan(0))
  })

  it("mostra o quadro da série com quanto já pagou e quanto falta", async () => {
    function Aberto() {
      const dados = useData()
      // eslint-disable-next-line react-hooks/globals
      ctx = dados
      return (
        <LancamentoDetalheDialog
          lancamento={dados.lancamentos.find((l) => l.id === "lan-strada-4") ?? null}
          onOpenChange={() => {}}
          hoje={new Date(2026, 9, 27)}
        />
      )
    }
    render(
      <DataProvider>
        <Aberto />
      </DataProvider>
    )
    expect(await screen.findByText(/STRADA: 3 de 5 pagas/)).toBeTruthy()
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByText(/R\$\s*3\.000,00/)).toBeTruthy() // já pagou
    expect(within(dialog).getByText(/R\$\s*2\.000,00/)).toBeTruthy() // falta
    expect(within(dialog).getByText(/Falta \(2 parcelas\)/)).toBeTruthy()
  })

  it("marca as primeiras parcelas pendentes como pagas, na data de cada vencimento", async () => {
    function Aberto() {
      const dados = useData()
      // eslint-disable-next-line react-hooks/globals
      ctx = dados
      return (
        <LancamentoDetalheDialog
          lancamento={dados.lancamentos.find((l) => l.id === "lan-strada-4") ?? null}
          onOpenChange={() => {}}
          hoje={new Date(2026, 9, 27)}
        />
      )
    }
    render(
      <DataProvider>
        <Aberto />
      </DataProvider>
    )
    await screen.findByText(/STRADA: 3 de 5 pagas/)
    fireEvent.change(screen.getByPlaceholderText("Quantas?"), { target: { value: "1" } })
    fireEvent.click(screen.getByRole("button", { name: "Marcar as primeiras como pagas" }))

    await waitFor(() => expect(ctx!.lancamentos.find((l) => l.id === "lan-strada-4")?.status).toBe("pago"))
    const quarta = ctx!.lancamentos.find((l) => l.id === "lan-strada-4")!
    expect(new Date(quarta.pagoEm!).getMonth()).toBe(10) // novembro, o mês do vencimento
    expect(ctx!.lancamentos.find((l) => l.id === "lan-strada-5")?.status).toBe("pendente")
  })

  it("cadastro de 15 parcelas com 3 já pagas cria as 3 primeiras baixadas", async () => {
    vi.stubGlobal("fetch", vi.fn(bancoFalso([])))
    render(
      <DataProvider>
        <Sonda />
        <LancamentoFormDialog open onOpenChange={() => {}} trigger={<span hidden />} />
      </DataProvider>
    )
    await waitFor(() => expect(ctx!.materiais.length).toBeGreaterThan(0))
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "STRADA" } })
    fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "FINANCIAMENTO STRADA" } })
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "1598.18" } })
    fireEvent.change(screen.getByLabelText("Vencimento"), { target: { value: "2026-08-28" } })
    fireEvent.change(screen.getByLabelText("Repetir por quantos meses?"), { target: { value: "15" } })
    fireEvent.change(screen.getByLabelText("Dessas, quantas já foram pagas?"), { target: { value: "3" } })
    expect(screen.getByText(/As 3 primeiras parcelas \(até 28\/10\/2026\)/)).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(ctx!.lancamentos).toHaveLength(15))
    const pagas = ctx!.lancamentos.filter((l) => l.status === "pago").map((l) => l.descricao).sort()
    expect(pagas).toEqual(["STRADA (1/15)", "STRADA (2/15)", "STRADA (3/15)"])
    expect(ctx!.lancamentos.every((l) => l.status === "pago" || l.status === "pendente")).toBe(true)
    expect(ctx!.lancamentos.filter((l) => l.status === "pago").every((l) => l.pagoEm)).toBe(true)
  })

  it("não aceita mais parcelas pagas do que o total", async () => {
    render(
      <DataProvider>
        <Sonda />
        <LancamentoFormDialog open onOpenChange={() => {}} trigger={<span hidden />} />
      </DataProvider>
    )
    await waitFor(() => expect(ctx!.materiais.length).toBeGreaterThan(0))
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "X" } })
    fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "Y" } })
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "10" } })
    fireEvent.change(screen.getByLabelText("Repetir por quantos meses?"), { target: { value: "3" } })
    fireEvent.change(screen.getByLabelText("Dessas, quantas já foram pagas?"), { target: { value: "4" } })
    expect(screen.getByRole("button", { name: "Salvar" }).hasAttribute("disabled")).toBe(true)
  })
})
