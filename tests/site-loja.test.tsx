import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import SiteLojaPage from "@/app/(app)/site-loja/page"

const pedido = (id: string, numero: number, extra: Record<string, unknown> = {}) => ({
  id,
  numero,
  numeroFormatado: `${numero}-26`,
  criadoEm: "2026-11-20T15:00:00.000Z",
  status: "aberto",
  novo: true,
  totalFechado: null,
  cliente: { id: "cli-1", nome: "Maria Souza", telefone: "(27) 99750-1517" },
  resumo: {
    codigo: "TP-ABC12",
    cidade: "Águia Branca",
    recebimento: "Precisa de instalação",
    observacaoCliente: "medir de manhã",
    itens: ["1× Toldos (fixo e cortina) — Toldo cortina (Medidas: 3,00 × 1,20 m)"],
  },
  ...extra,
})

describe("painel Site da loja", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          pedidos: [
            pedido("a", 10038),
            pedido("b", 10037, { novo: false, status: "aberto", resumo: { codigo: "TP-OLD", itens: ["2× Banner"] } }),
            pedido("c", 10036, { novo: false, status: "fechado" }),
          ],
        }),
      }))
    )
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("lista os pedidos com status, cliente e itens", async () => {
    render(<SiteLojaPage />)
    await waitFor(() => expect(screen.getByText("Orçamento 10038-26")).toBeTruthy())
    expect(screen.getByText("Orçamento 10037-26")).toBeTruthy()
    expect(screen.getAllByText("Novo").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Em andamento").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Maria Souza").length).toBe(3)
    expect(screen.getAllByText(/Obs\.: medir de manhã/).length).toBe(2)
    // link do orçamento e do WhatsApp
    expect(screen.getAllByRole("button", { name: /Abrir orçamento/ })[0].getAttribute("href")).toBe("/orcamentos/a")
    expect(screen.getAllByRole("button", { name: /WhatsApp/ })[0].getAttribute("href")).toContain("wa.me/5527997501517")
  })

  it("filtra por Novos e por Fechados", async () => {
    render(<SiteLojaPage />)
    await waitFor(() => expect(screen.getByText("Orçamento 10038-26")).toBeTruthy())
    fireEvent.click(screen.getByRole("tab", { name: /Novos \(1\)/ }))
    expect(screen.queryByText("Orçamento 10037-26")).toBeNull()
    expect(screen.getByText("Orçamento 10038-26")).toBeTruthy()
    fireEvent.click(screen.getByRole("tab", { name: /Fechados \(1\)/ }))
    expect(screen.getByText("Orçamento 10036-26")).toBeTruthy()
    expect(screen.queryByText("Orçamento 10038-26")).toBeNull()
  })

  it("mostra a mensagem de vazio quando não há pedidos", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ pedidos: [] }) })))
    render(<SiteLojaPage />)
    await waitFor(() => expect(screen.getByText(/Nenhum pedido chegou pelo site ainda/)).toBeTruthy())
  })
})
