import type { Papel } from "@/lib/types"

const PAPEIS_VALIDOS: Papel[] = ["dono", "producao", "financeiro", "operador"]

export const ROTULO_PAPEL: Record<Papel, string> = {
  dono: "Dono",
  producao: "Produção",
  financeiro: "Financeiro",
  operador: "Produção e TV",
}

// "operador" só enxerga a Produção e o Painel TV — qualquer outra página
// redireciona pra Produção (ver proxy.ts).
export const PAGINAS_OPERADOR = ["/producao", "/tv"]

export function operadorPodeAcessar(pathname: string) {
  return PAGINAS_OPERADOR.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

// Conta nova entra como "dono" por padrão. Pra restringir alguém a um
// papel menor, o dono troca em Equipe — isso fica salvo em publicMetadata.papel
// e passa a valer a partir daqui.
export function resolverPapel(papelMetadata: unknown): Papel {
  if (PAPEIS_VALIDOS.includes(papelMetadata as Papel)) return papelMetadata as Papel
  return "dono"
}
