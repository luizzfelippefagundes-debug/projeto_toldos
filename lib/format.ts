export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR")
}
