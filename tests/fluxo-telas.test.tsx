import type { PropsWithChildren } from "react"
import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DataProvider, useData } from "@/context/data-context"
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

let idDaRota = "x"
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: idDaRota }),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ user: { firstName: "Kaio" } }) }))

import RetornosPage from "@/app/(app)/retornos/page"
import ReciboPage from "@/app/(app)/financeiro/[id]/recibo/page"

type Registro = { id: string } & Record<string, unknown>

function bancoFalso() {
  const t: Record<string, Registro[]> = {
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
    const linhas = t[tabela]
    const metodo = init?.method ?? "GET"
    const corpo = init?.body ? JSON.parse(init.body as string) : undefined
    if (metodo === "GET") return Response.json(structuredClone(linhas))
    if (metodo === "POST") linhas.push(corpo)
    if (metodo === "PUT") {
      const i = linhas.findIndex((l) => l.id === id)
      if (i >= 0) linhas[i] = { ...linhas[i], ...corpo, id }
    }
    if (metodo === "DELETE") t[tabela] = linhas.filter((l) => l.id !== id)
    return Response.json({ ok: true })
  }
}

function wrapper({ children }: PropsWithChildren) {
  return <DataProvider>{children}</DataProvider>
}

describe("telas novas com dados reais", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(bancoFalso()))
  })
  afterEach(() => vi.unstubAllGlobals())

  it("orçamento fechado com entrada aparece nos Retornos e gera recibo da entrada paga", async () => {
    // 1) fecha o orçamento com 50% de entrada, num provider compartilhado com as telas
    function Harness() {
      return (
        <DataProvider>
          <Fechar />
          <RetornosPage />
        </DataProvider>
      )
    }
    let ref: ReturnType<typeof useData> | null = null
    function Fechar() {
      ref = useData()
      return null
    }
    render(<Harness />)
    await waitFor(() => expect(ref!.materiais.length).toBeGreaterThan(0))

    let orcamento = { id: "", numero: 0 }
    act(() => {
      orcamento = ref!.fecharOrcamento({
        clienteId: "cli-1",
        item: {
          materialId: "mat-1", servicoId: "srv-1", largura: 3, altura: 2,
          quantidadeUnidades: 1, horasEstimadas: 0, entradaPercent: 50,
        },
        ajusteManual: 0, anexoNome: null, validadeDias: 7,
      })
    })

    // 2) quadro de Retornos: card na coluna "Aguardando retorno", com WhatsApp
    await waitFor(() => expect(screen.getAllByText(/Retornos/).length).toBeGreaterThan(0))
    const nomeCliente = clientesSeed.find((c) => c.id === "cli-1")!.nome
    await waitFor(() => expect(screen.getAllByText(nomeCliente).length).toBeGreaterThan(0))
    const links = screen.getAllByRole("link", { name: /whatsapp/i })
    expect(links[0].getAttribute("href")).toMatch(/^https:\/\/wa\.me\/55\d{10,11}\?text=/)
    expect(screen.getAllByText("Aguardando retorno").length).toBeGreaterThan(0)

    // 3) entrada vira "paga" -> recibo
    const entrada = ref!.lancamentos.find((l) => l.origemId === orcamento.id && l.parcela === "entrada")!
    expect(entrada).toBeTruthy()
    act(() => ref!.marcarLancamentoStatus(entrada.id, "pago"))
    await waitFor(() =>
      expect(ref!.lancamentos.find((l) => l.id === entrada.id)?.status).toBe("pago")
    )

    idDaRota = entrada.id
    const total = ref!.orcamentos.find((o) => o.id === orcamento.id)!.totalFechado!
    const recibo = render(
      <DataProvider>
        <ReciboPage />
      </DataProvider>
    )
    // o recibo do segundo provider recarrega do "banco": a entrada paga foi gravada via PUT
    await waitFor(() => expect(recibo.container.textContent).toMatch(/RECIBO Nº/), { timeout: 3000 })
    const texto = recibo.container.textContent ?? ""
    expect(texto).toContain(nomeCliente)
    expect(texto).toMatch(/entrada de 50% do orçamento nº \d{4}-\d{2}/)
    expect(texto).toMatch(/reais/) // valor por extenso
    expect(texto).toContain("Saldo restante")
    expect(texto).toMatch(new RegExp(`Valor do orçamento${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/[$]/g, "\\$").replace(/\s/g, "\\s")}`))
    expect(within(recibo.container).getByRole("button", { name: /whatsapp/i }).getAttribute("href")).toContain("wa.me/55")
  })

  it("recibo de lançamento ainda pendente não é gerado", async () => {
    const { result } = renderHook(() => useData(), { wrapper })
    await waitFor(() => expect(result.current.materiais.length).toBeGreaterThan(0))
    const pendente = lancamentosFinanceirosSeed.find((l) => l.tipo === "receita" && l.status === "pendente")!
    idDaRota = pendente.id
    const { container } = render(
      <DataProvider>
        <ReciboPage />
      </DataProvider>
    )
    await waitFor(() => expect(container.textContent).toMatch(/ainda não foi pago/))
  })
})
