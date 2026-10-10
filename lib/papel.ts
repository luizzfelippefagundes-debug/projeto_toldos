import type { Papel } from "@/lib/types"

const PAPEIS_VALIDOS: Papel[] = ["dono", "producao", "financeiro"]

export const ROTULO_PAPEL: Record<Papel, string> = {
  dono: "Dono",
  producao: "Produção",
  financeiro: "Financeiro",
}

function emailsDono(): string[] {
  return (process.env.DONO_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

// null = conta criada mas ainda não liberada pelo dono.
export function resolverPapel(
  papelMetadata: unknown,
  email: string | null | undefined
): Papel | null {
  if (PAPEIS_VALIDOS.includes(papelMetadata as Papel)) return papelMetadata as Papel
  if (email && emailsDono().includes(email.toLowerCase())) return "dono"
  return null
}
