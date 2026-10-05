import type { PedidoRapido } from "./types"

export function obterPrazoEntregaPedido(
  pedido: PedidoRapido,
  prazoDias?: number
): Date | null {
  const salvo = pedido.prazoEntregaEm ? new Date(pedido.prazoEntregaEm) : null
  if (salvo && Number.isFinite(salvo.getTime())) return salvo
  if (prazoDias === undefined || !Number.isFinite(prazoDias) || prazoDias < 0) {
    return null
  }

  const prazo = new Date(pedido.criadoEm)
  if (!Number.isFinite(prazo.getTime())) return null
  prazo.setDate(prazo.getDate() + prazoDias)
  return prazo
}

export function pedidoRapidoEstaAtrasado(
  pedido: PedidoRapido,
  prazoDias: number | undefined,
  hoje: Date
): boolean {
  if (pedido.status === "entregue" || !Number.isFinite(hoje.getTime())) {
    return false
  }
  const prazo = obterPrazoEntregaPedido(pedido, prazoDias)
  if (!prazo) return false
  const inicioHoje = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate()
  )
  const inicioPrazo = new Date(
    prazo.getFullYear(),
    prazo.getMonth(),
    prazo.getDate()
  )
  return inicioPrazo < inicioHoje
}

export function criarPrazoEntregaPedido(
  criadoEm: string,
  prazoDias: number
): string | undefined {
  const prazo = new Date(criadoEm)
  if (
    !Number.isFinite(prazo.getTime()) ||
    !Number.isFinite(prazoDias) ||
    prazoDias < 0
  ) {
    return undefined
  }
  prazo.setDate(prazo.getDate() + prazoDias)
  return prazo.toISOString()
}
