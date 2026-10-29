import type { Armazenamento } from "./armazenamento"
import type { Cliente, Material, Servico } from "@/lib/types"

// Cópia dos dados que o orçamento precisa pra funcionar sem internet.
export interface CatalogoLocal {
  clientes: Cliente[]
  materiais: Material[]
  servicos: Servico[]
  atualizadoEm: string
}

const CHAVE = "atual"

export async function salvarCatalogo(
  armazenamento: Armazenamento,
  dados: Omit<CatalogoLocal, "atualizadoEm">,
  agora: Date = new Date()
): Promise<void> {
  await armazenamento.gravar<CatalogoLocal>("catalogo", CHAVE, {
    ...dados,
    atualizadoEm: agora.toISOString(),
  })
}

export async function lerCatalogo(
  armazenamento: Armazenamento
): Promise<CatalogoLocal | null> {
  return (await armazenamento.ler<CatalogoLocal>("catalogo", CHAVE)) ?? null
}

export async function limparCatalogo(armazenamento: Armazenamento): Promise<void> {
  await armazenamento.apagar("catalogo", CHAVE)
}
