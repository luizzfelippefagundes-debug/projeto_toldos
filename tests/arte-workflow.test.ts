import { describe, expect, it, vi, beforeEach } from "vitest"

const sqlMock = vi.fn()

vi.mock("@/lib/db", () => ({
  getSql: () => sqlMock,
}))

vi.mock("@/lib/migracoes", () => ({
  garantirColunasOrcamentos: vi.fn().mockResolvedValue(undefined),
  garantirColunasPedidosRapidos: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/bot-registro", () => ({
  registrarMensagemBot: vi.fn().mockResolvedValue(undefined),
}))

import { GET } from "@/app/api/arte/[id]/route"
import { POST } from "@/app/api/arte/[id]/aprovar/route"
import { registrarMensagemBot } from "@/lib/bot-registro"

describe("fluxo de aprovação de arte (/api/arte/[id])", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna 404 se o pedido ou orçamento não existir", async () => {
    sqlMock.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    const res = await GET(new Request("http://localhost/api/arte/xyz"), {
      params: Promise.resolve({ id: "xyz" }),
    })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.erro).toBe("Pedido ou arte não encontrado")
  })

  it("retorna os dados da arte de um orçamento existente", async () => {
    sqlMock
      // Busca orcamento
      .mockResolvedValueOnce([
        {
          id: "orc-123",
          numero: 42,
          cliente_id: "cli-1",
          item: JSON.stringify({ servicoId: "srv-1" }),
          total_fechado: "350.00",
          arte_url: "https://blob.vercel.com/arte-123.jpg",
          arte_aprovada_em: null,
          status_producao: "ag_confirmacao",
          criado_em: "2026-11-10T10:00:00.000Z",
        },
      ])
      // Busca cliente
      .mockResolvedValueOnce([
        { nome: "Luiz Gráfica", telefone: "(11) 98888-7777" },
      ])

    const res = await GET(new Request("http://localhost/api/arte/orc-123"), {
      params: Promise.resolve({ id: "orc-123" }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({
      tipo: "orcamento",
      id: "orc-123",
      numero: 42,
      clienteNome: "Luiz Gráfica",
      clienteTelefone: "(11) 98888-7777",
      arteUrl: "https://blob.vercel.com/arte-123.jpg",
      arteAprovadaEm: null,
      status: "ag_confirmacao",
      total: 350,
    })
  })

  it("aprova arte de orçamento e avança para impressão com notificação", async () => {
    sqlMock
      // Busca orcamento
      .mockResolvedValueOnce([
        { id: "orc-123", numero: 42, cliente_id: "cli-1" },
      ])
      // UPDATE orcamento
      .mockResolvedValueOnce([])
      // Busca cliente
      .mockResolvedValueOnce([
        { nome: "Luiz Gráfica", telefone: "(11) 98888-7777" },
      ])

    const res = await POST(new Request("http://localhost/api/arte/orc-123/aprovar"), {
      params: Promise.resolve({ id: "orc-123" }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.sucesso).toBe(true)
    expect(json.status).toBe("impressao")
    expect(json.aprovadoEm).toBeDefined()

    expect(registrarMensagemBot).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteNome: "Luiz Gráfica",
        telefone: "(11) 98888-7777",
        texto: expect.stringContaining("✅ Arte do Orçamento #42 foi APROVADA"),
      })
    )
  })

  it("retorna e aprova arte de pedido rápido", async () => {
    // 1. GET pedido rápido
    sqlMock
      .mockResolvedValueOnce([]) // orcamento não achou
      .mockResolvedValueOnce([
        {
          id: "ped-999",
          numero: 105,
          produto_nome: "Banner Lona 440g",
          variante_nome: "1x1m",
          cliente_nome: "Maria Silva",
          cliente_telefone: "11977776666",
          arte_url: "https://blob.vercel.com/banner.jpg",
          arte_aprovada_em: null,
          status: "ag_confirmacao",
          total: "80.00",
          criado_em: "2026-11-10T12:00:00.000Z",
        },
      ])

    const resGet = await GET(new Request("http://localhost/api/arte/ped-999"), {
      params: Promise.resolve({ id: "ped-999" }),
    })
    expect(resGet.status).toBe(200)
    const jsonGet = await resGet.json()
    expect(jsonGet.tipo).toBe("pedido")
    expect(jsonGet.descricao).toBe("Banner Lona 440g")

    // 2. POST aprovar pedido rápido
    sqlMock
      .mockResolvedValueOnce([]) // orcamento não achou
      .mockResolvedValueOnce([
        {
          id: "ped-999",
          numero: 105,
          cliente_nome: "Maria Silva",
          cliente_telefone: "11977776666",
        },
      ]) // pedido achou
      .mockResolvedValueOnce([]) // UPDATE pedido

    const resPost = await POST(new Request("http://localhost/api/arte/ped-999/aprovar"), {
      params: Promise.resolve({ id: "ped-999" }),
    })
    expect(resPost.status).toBe(200)
    const jsonPost = await resPost.json()
    expect(jsonPost.sucesso).toBe(true)
    expect(jsonPost.status).toBe("impressao")

    expect(registrarMensagemBot).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteNome: "Maria Silva",
        telefone: "11977776666",
        texto: expect.stringContaining("✅ Arte do Pedido #105 foi APROVADA"),
      })
    )
  })
})
