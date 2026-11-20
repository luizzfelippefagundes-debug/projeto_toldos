import { describe, expect, it } from "vitest"
import {
  formatarTelefoneLoja,
  mesmoTelefone,
  montarOrcamentoLoja,
  observacaoDoPedido,
  resumirPedidoLoja,
  estimarTotalMaterial,
  validarPedidoLoja,
  type MaterialResumo,
} from "@/lib/loja-orcamento"

const materiais = new Map<string, MaterialResumo>([
  ["mat-m2", { id: "mat-m2", unidade: "m2" }],
  ["mat-un", { id: "mat-un", unidade: "unidade" }],
])

const base = {
  codigo: "TP-ABC12",
  cliente: { nome: "Maria Souza", telefone: "(27) 99750-1517", cidade: "Águia Branca" },
  recebimento: "Precisa de instalação",
  itens: [{ materialId: "mat-m2", nome: "Toldo cortina", largura: 3, altura: 1.2, quantidade: 1 }],
}

describe("validarPedidoLoja", () => {
  it("aceita um pedido completo", () => {
    const r = validarPedidoLoja(base)
    expect(r.ok).toBe(true)
  })
  it("recusa sem nome, sem WhatsApp ou sem itens", () => {
    expect(validarPedidoLoja({ ...base, cliente: { ...base.cliente, nome: "" } }).ok).toBe(false)
    expect(validarPedidoLoja({ ...base, cliente: { ...base.cliente, telefone: "123" } }).ok).toBe(false)
    expect(validarPedidoLoja({ ...base, itens: [] }).ok).toBe(false)
  })
  it("recusa quantidade inválida e medida absurda (descarta a medida)", () => {
    expect(validarPedidoLoja({ ...base, itens: [{ nome: "x", quantidade: 0 }] }).ok).toBe(false)
    expect(validarPedidoLoja({ ...base, itens: [{ nome: "x", quantidade: 1.5 }] }).ok).toBe(false)
    const r = validarPedidoLoja({ ...base, itens: [{ nome: "x", quantidade: 1, largura: 9999 }] })
    expect(r.ok && r.pedido.itens[0].largura).toBeUndefined()
  })
  it("limita o tamanho dos textos", () => {
    const r = validarPedidoLoja({ ...base, observacao: "a".repeat(5000) })
    expect(r.ok && r.pedido.observacao?.length).toBe(1000)
  })
})

describe("telefone", () => {
  it("formata com ou sem 55", () => {
    expect(formatarTelefoneLoja("5527997501517")).toBe("(27) 99750-1517")
    expect(formatarTelefoneLoja("27997501517")).toBe("(27) 99750-1517")
    expect(formatarTelefoneLoja("2733334444")).toBe("(27) 3333-4444")
  })
  it("reconhece o mesmo cliente pelos 8 últimos dígitos", () => {
    expect(mesmoTelefone("(27) 99750-1517", "5527997501517")).toBe(true)
    expect(mesmoTelefone("(27) 99750-1517", "(27) 99750-1518")).toBe(false)
    expect(mesmoTelefone("123", "123")).toBe(false)
  })
})

describe("montarOrcamentoLoja", () => {
  const validado = validarPedidoLoja(base)
  if (!validado.ok) throw new Error("base inválida")
  const ids = { id: "orc-1", clienteId: "cli-1", agora: "2026-11-20T12:00:00.000Z" }

  it("cria orçamento aberto, origem loja, com as medidas do site", () => {
    const o = montarOrcamentoLoja(validado.pedido, ids, materiais)
    expect(o.status).toBe("aberto")
    expect(o.origem).toBe("loja")
    expect(o.item.materialId).toBe("mat-m2")
    expect(o.item.largura).toBe(3)
    expect(o.item.altura).toBe(1.2)
    expect(o.validadeDias).toBe(7)
    expect(o.observacao).toContain("TP-ABC12")
  })
  it("item sem material cadastrado entra sem material e com o texto na observação", () => {
    const v = validarPedidoLoja({ ...base, itens: [{ materialId: "mat-inexistente", nome: "Tinta spray", quantidade: 2 }] })
    if (!v.ok) throw new Error("inválido")
    const o = montarOrcamentoLoja(v.pedido, ids, materiais)
    expect(o.item.materialId).toBe("")
    expect(o.item.observacao).toBe("Tinta spray")
    expect(o.item.quantidadeUnidades).toBe(2)
  })
  it("material por unidade ignora medidas; itens extras viram adicionais", () => {
    const v = validarPedidoLoja({
      ...base,
      itens: [
        { materialId: "mat-un", nome: "Outdoor", quantidade: 1, largura: 4, altura: 2 },
        { materialId: "mat-m2", nome: "Banner", quantidade: 2, largura: 1, altura: 2 },
      ],
    })
    if (!v.ok) throw new Error("inválido")
    const o = montarOrcamentoLoja(v.pedido, ids, materiais)
    expect(o.item.largura).toBe(1)
    expect(o.item.altura).toBe(1)
    expect(o.item.itensAdicionais).toHaveLength(1)
    expect(o.item.itensAdicionais?.[0].quantidadeUnidades).toBe(2)
  })
  it("a observação lista todos os itens", () => {
    expect(observacaoDoPedido(validado.pedido)).toContain("1× Toldo cortina")
  })
})

describe("resumirPedidoLoja", () => {
  it("lê de volta o que observacaoDoPedido gravou", () => {
    const v = validarPedidoLoja({ ...base, observacao: "medir de manhã" })
    if (!v.ok) throw new Error("inválido")
    const r = resumirPedidoLoja(observacaoDoPedido(v.pedido))
    expect(r.codigo).toBe("TP-ABC12")
    expect(r.cidade).toBe("Águia Branca")
    expect(r.recebimento).toBe("Precisa de instalação")
    expect(r.observacaoCliente).toBe("medir de manhã")
    expect(r.itens).toEqual(["1× Toldo cortina"])
  })
  it("aguenta observação vazia", () => {
    expect(resumirPedidoLoja(null)).toEqual({ codigo: "", cidade: undefined, recebimento: undefined, observacaoCliente: undefined, itens: [] })
  })
})

describe("conta do cliente no site", () => {
  it("guarda a conta no pedido e lê de volta", () => {
    const v = validarPedidoLoja({ ...base, conta: "user_2abcXYZ123" })
    if (!v.ok) throw new Error("inválido")
    expect(v.pedido.conta).toBe("user_2abcXYZ123")
    const r = resumirPedidoLoja(observacaoDoPedido(v.pedido))
    expect(r.conta).toBe("user_2abcXYZ123")
    expect(observacaoDoPedido(v.pedido)).toContain("\nConta: user_2abcXYZ123\n")
  })
  it("recusa conta com formato estranho", () => {
    expect(validarPedidoLoja({ ...base, conta: "x; DROP TABLE" }).ok).toBe(false)
    expect(validarPedidoLoja({ ...base, conta: "outro_123" }).ok).toBe(false)
  })
  it("pedido sem conta continua valendo", () => {
    expect(validarPedidoLoja(base).ok).toBe(true)
  })
})

describe("estimarTotalMaterial", () => {
  const precos = new Map([
    ["m2", { unidade: "m2", preco: 250 }],
    ["un", { unidade: "unidade", preco: 900 }],
  ])
  const base = { servicoId: "", horasEstimadas: 0 }
  it("soma área x preço por m2, com quantidade", () => {
    const t = estimarTotalMaterial({ ...base, materialId: "m2", largura: 2, altura: 1, quantidadeUnidades: 3 }, precos)
    expect(t).toBe(1500)
  })
  it("usa quantidade x preço para material por unidade e soma os adicionais", () => {
    const t = estimarTotalMaterial(
      {
        ...base, materialId: "un", largura: 1, altura: 1, quantidadeUnidades: 2,
        itensAdicionais: [{ id: "a", ...base, materialId: "m2", largura: 1, altura: 2, quantidadeUnidades: 1 }],
      },
      precos
    )
    expect(t).toBe(2 * 900 + 2 * 250)
  })
  it("ignora item sem material e devolve null se nenhum tiver", () => {
    expect(estimarTotalMaterial({ ...base, materialId: "", largura: 1, altura: 1, quantidadeUnidades: 1 }, precos)).toBeNull()
    expect(estimarTotalMaterial({ ...base, materialId: "x", largura: 1, altura: 1, quantidadeUnidades: 1 }, precos)).toBeNull()
  })
})
