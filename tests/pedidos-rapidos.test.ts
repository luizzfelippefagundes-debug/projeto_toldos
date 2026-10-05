import { describe, expect, it } from "vitest"
import {
  criarPrazoEntregaPedido,
  obterPrazoEntregaPedido,
  pedidoRapidoEstaAtrasado,
} from "@/lib/pedidos-rapidos"
import type { PedidoRapido } from "@/lib/types"

const pedido: PedidoRapido = {
  id: "ped-1",
  numero: 1,
  produtoId: "prod-1",
  varianteId: "var-1",
  acabamento: null,
  clienteNome: "Cliente",
  clienteTelefone: "",
  observacao: "",
  total: 25,
  status: "arte",
  criadoEm: new Date(2026, 8, 25, 12).toISOString(),
}

describe("prazos de produção", () => {
  it("calcula o prazo a partir da data original do pedido", () => {
    const prazo = criarPrazoEntregaPedido(pedido.criadoEm, 3)
    expect(prazo).toBeDefined()
    expect(obterPrazoEntregaPedido(pedido, 3)?.getDate()).toBe(28)
  })

  it("considera atrasado só a partir do dia seguinte ao prazo e ignora entregues", () => {
    const hoje = new Date(2026, 8, 29, 12)
    expect(pedidoRapidoEstaAtrasado(pedido, 3, hoje)).toBe(true)
    expect(
      pedidoRapidoEstaAtrasado({ ...pedido, status: "entregue" }, 3, hoje)
    ).toBe(false)
  })

  it("não cria prazo para valores inválidos", () => {
    expect(criarPrazoEntregaPedido("data inválida", 3)).toBeUndefined()
    expect(criarPrazoEntregaPedido(pedido.criadoEm, -1)).toBeUndefined()
  })
})
