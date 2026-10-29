import type { Armazenamento } from "./armazenamento"
import type { Cliente, OrcamentoItem } from "@/lib/types"

export interface ArquivoFila {
  nome: string
  tipo: string
  dados: Blob
}

// Orçamento fechado sem internet, esperando pra subir. `id` é o id que o
// orçamento terá no servidor (garante que enviar duas vezes não duplica).
export interface ItemFila {
  id: string
  clienteId: string
  // Preenchido quando o cliente foi cadastrado offline (clienteNovo.id === clienteId).
  clienteNovo?: Cliente
  // As fotos do `item.fotos` vêm com url provisória ("foto:0", "foto:1"...); os
  // arquivos correspondentes estão em `fotos`, na mesma ordem.
  item: OrcamentoItem
  ajusteManual: number
  validadeDias: number
  anexo?: ArquivoFila
  fotos: ArquivoFila[]
  totalProvisorio: number
  criadoEm: string
  tentativas: number
  ultimoErro?: string
}

export const MAX_TENTATIVAS = 5

export function precisaAtencao(item: ItemFila): boolean {
  return item.tentativas >= MAX_TENTATIVAS
}

export async function enfileirar(
  armazenamento: Armazenamento,
  item: Omit<ItemFila, "tentativas" | "ultimoErro">
): Promise<void> {
  await armazenamento.gravar<ItemFila>("fila", item.id, { ...item, tentativas: 0 })
}

export async function listarFila(armazenamento: Armazenamento): Promise<ItemFila[]> {
  const itens = await armazenamento.listar<ItemFila>("fila")
  return itens.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
}

export async function contarFila(armazenamento: Armazenamento): Promise<number> {
  return (await armazenamento.listar<ItemFila>("fila")).length
}

export async function removerDaFila(armazenamento: Armazenamento, id: string): Promise<void> {
  await armazenamento.apagar("fila", id)
}

export async function registrarFalha(
  armazenamento: Armazenamento,
  id: string,
  mensagem: string
): Promise<void> {
  const item = await armazenamento.ler<ItemFila>("fila", id)
  if (!item) return
  await armazenamento.gravar<ItemFila>("fila", id, {
    ...item,
    tentativas: item.tentativas + 1,
    ultimoErro: mensagem,
  })
}
