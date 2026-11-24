import { interpretarDataLocal } from "./date"

export function formatarMoeda(valor: number): string {
  if (valor == null || isNaN(valor)) return "R$ 0,00"
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function formatarData(iso: string): string {
  return interpretarDataLocal(iso).toLocaleDateString("pt-BR")
}

export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}
