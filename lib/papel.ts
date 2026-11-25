import type { Papel } from "@/lib/types"

const PAPEIS_VALIDOS: Papel[] = ["dono", "producao", "financeiro", "operador"]

export const ROTULO_PAPEL: Record<Papel, string> = {
  dono: "Dono",
  producao: "Produção",
  financeiro: "Financeiro",
  operador: "Colaborador",
}

// "operador" enxerga Produção, Painel TV e Equipe & RH (onde vê seu próprio Extrato)
export const PAGINAS_OPERADOR = ["/producao", "/tv", "/equipe", "/equipe/recibo", "/meu-extrato"]

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
