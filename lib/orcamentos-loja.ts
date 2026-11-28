import type { Orcamento, Papel } from "./types"

/** Quem vê a aba "Orçamentos da loja" além do dono (mesma regra do Histórico de Orçamentos). */
export const PAPEIS_ORCAMENTOS_LOJA: Papel[] = ["financeiro"]

/** Orçamentos vindos do site que ainda estão em aberto (contador do menu e da aba). */
export function contarOrcamentosLojaAbertos(orcamentos: Pick<Orcamento, "origem" | "status">[]): number {
  return orcamentos.filter((o) => o.origem === "loja" && o.status === "aberto").length
}
