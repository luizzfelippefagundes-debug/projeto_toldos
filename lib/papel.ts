import type { Papel } from "@/lib/types"

const PAPEIS_VALIDOS: Papel[] = ["dono", "producao", "financeiro"]

export const ROTULO_PAPEL: Record<Papel, string> = {
  dono: "Dono",
  producao: "Produção",
  financeiro: "Financeiro",
}

// Conta nova entra como "dono" por padrão. Pra restringir alguém a um
// papel menor, o dono troca em Equipe — isso fica salvo em publicMetadata.papel
// e passa a valer a partir daqui.
export function resolverPapel(papelMetadata: unknown): Papel {
  if (PAPEIS_VALIDOS.includes(papelMetadata as Papel)) return papelMetadata as Papel
  return "dono"
}
