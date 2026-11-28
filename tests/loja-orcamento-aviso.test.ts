import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  linkOrcamentoLoja,
  mensagemNovoOrcamentoLoja,
  montarOrcamentoLoja,
  observacaoDoPedido,
  validarPedidoLoja,
  type PedidoLoja,
} from "@/lib/loja-orcamento"
import { contarOrcamentosLojaAbertos } from "@/lib/orcamentos-loja"
import * as evolutionApi from "@/lib/evolution-api"
import * as notificacoes from "@/lib/notificacoes-producao"
import { avisarKaioNovoOrcamentoLoja } from "@/lib/aviso-loja-kaio"

const semConta = {
  codigo: "TP-XYZ99",
  cliente: { nome: "João Lima", telefone: "27997501517", cidade: "  Colatina  " },
  observacao: "Preciso até sexta",
  itens: [
    { nome: "Toldo cortina", largura: 3, altura: 1.25, quantidade: 1, detalhes: ["Lona azul", "Com instalação"] },
    { nome: "Adesivo", quantidade: 10 },
  ],
}

describe("pedido da loja sem login", () => {
  it("aceita sem conta, com conta null e com conta vazia", () => {
    for (const conta of [undefined, null, ""]) {
      const v = validarPedidoLoja({ ...semConta, conta })
      expect(v.ok).toBe(true)
      if (v.ok) expect(v.pedido.conta).toBeUndefined()
    }
  })

  it("apara a cidade, limita a 80 caracteres e ignora valor não-texto", () => {
    const v = validarPedidoLoja(semConta)
    expect(v.ok && v.pedido.cliente.cidade).toBe("Colatina")
    const longa = validarPedidoLoja({ ...semConta, cliente: { ...semConta.cliente, cidade: "x".repeat(200) } })
    expect(longa.ok && longa.pedido.cliente.cidade?.length).toBe(80)
    const numero = validarPedidoLoja({ ...semConta, cliente: { ...semConta.cliente, cidade: 123 } })
    expect(numero.ok && numero.pedido.cliente.cidade).toBeUndefined()
  })

  it("mantém o prefixo do código (usado para não duplicar) e grava a cidade na observação", () => {
    const v = validarPedidoLoja(semConta)
    if (!v.ok) throw new Error(v.erro)
    const obs = observacaoDoPedido(v.pedido)
    expect(obs.startsWith("Pedido pelo site (TP-XYZ99)")).toBe(true)
    expect(obs).toContain("Cidade: Colatina")
    expect(obs).not.toContain("Conta:")
    const orc = montarOrcamentoLoja(v.pedido, { id: "orc-1", clienteId: "cli-1", agora: "2026-11-28T10:00:00Z" }, new Map())
    expect(orc.observacao).toBe(obs)
  })
})

describe("mensagemNovoOrcamentoLoja", () => {
  const pedido = (() => {
    const v = validarPedidoLoja(semConta)
    if (!v.ok) throw new Error(v.erro)
    return v.pedido
  })()

  it("monta o aviso com número, cliente, telefone, cidade, itens, observação e link", () => {
    const msg = mensagemNovoOrcamentoLoja(pedido, {
      numeroFormatado: "11-10234",
      link: "https://sys.exemplo.com/orcamentos-loja?abrir=orc-1",
    })
    expect(msg.split("\n")[0]).toBe("🛒 *Novo orçamento pelo site*")
    expect(msg).toContain("*Nº:* 11-10234")
    expect(msg).toContain("*Cliente:* João Lima")
    expect(msg).toContain("*WhatsApp:* (27) 99750-1517")
    expect(msg).toContain("*Cidade:* Colatina")
    expect(msg).toContain("• 1× Toldo cortina — 3 × 1,25 m")
    expect(msg).toContain("_Lona azul; Com instalação_")
    expect(msg).toContain("• 10× Adesivo")
    expect(msg).toContain("*Obs. do cliente:* Preciso até sexta")
    expect(msg).toContain("Abrir no sistema: https://sys.exemplo.com/orcamentos-loja?abrir=orc-1")
  })

  it("omite cidade, observação e link quando não há", () => {
    const p: PedidoLoja = { ...pedido, cliente: { nome: "Ana", telefone: "2733334444" }, observacao: undefined }
    const msg = mensagemNovoOrcamentoLoja(p, { numeroFormatado: "10001" })
    expect(msg).not.toContain("Cidade")
    expect(msg).not.toContain("Obs.")
    expect(msg).not.toContain("Abrir no sistema")
    expect(msg).toContain("*WhatsApp:* (27) 3333-4444")
  })

  it("corta detalhes muito longos", () => {
    const p: PedidoLoja = { ...pedido, itens: [{ nome: "Placa", quantidade: 1, detalhes: ["a".repeat(500)] }] }
    const msg = mensagemNovoOrcamentoLoja(p, { numeroFormatado: "1" })
    expect(msg).toContain("…_")
    expect(msg.length).toBeLessThan(400)
  })
})

describe("linkOrcamentoLoja", () => {
  it("monta o link só com URL http(s) válida", () => {
    expect(linkOrcamentoLoja("https://sys.exemplo.com/", "orc-1")).toBe("https://sys.exemplo.com/orcamentos-loja?abrir=orc-1")
    expect(linkOrcamentoLoja(undefined, "orc-1")).toBeNull()
    expect(linkOrcamentoLoja("sys.exemplo.com", "orc-1")).toBeNull()
  })
})

describe("contarOrcamentosLojaAbertos", () => {
  it("conta só os da loja em aberto", () => {
    expect(
      contarOrcamentosLojaAbertos([
        { origem: "loja", status: "aberto" },
        { origem: "loja", status: "fechado" },
        { origem: "whatsapp", status: "aberto" },
        { origem: "loja", status: "aberto" },
      ])
    ).toBe(2)
  })
})

describe("avisarKaioNovoOrcamentoLoja", () => {
  beforeEach(() => vi.restoreAllMocks())
  const pedido = validarPedidoLoja(semConta)
  if (!pedido.ok) throw new Error(pedido.erro)

  it("envia o texto para o telefone do Kaio", async () => {
    vi.spyOn(notificacoes, "obterTelefoneKaio").mockResolvedValue("5527999990000")
    const envio = vi.spyOn(evolutionApi, "enviarMensagemWhatsapp").mockResolvedValue({ ok: true })
    const ok = await avisarKaioNovoOrcamentoLoja(pedido.pedido, { id: "orc-1", numeroFormatado: "10234" })
    expect(ok).toBe(true)
    expect(envio).toHaveBeenCalledWith("5527999990000", expect.stringContaining("Novo orçamento pelo site"))
  })

  it("nunca lança erro quando o envio falha", async () => {
    vi.spyOn(notificacoes, "obterTelefoneKaio").mockResolvedValue("5527999990000")
    vi.spyOn(evolutionApi, "enviarMensagemWhatsapp").mockRejectedValue(new Error("fora do ar"))
    vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(avisarKaioNovoOrcamentoLoja(pedido.pedido, { id: "orc-1", numeroFormatado: "10234" })).resolves.toBe(false)
  })
})
