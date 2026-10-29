// Armazenamento local do modo offline. A interface existe pra os testes usarem
// uma versão em memória; no aparelho usa-se o IndexedDB (aceita Blob de fotos).
export type LojaOffline = "catalogo" | "fila"

export interface Armazenamento {
  ler<T>(loja: LojaOffline, chave: string): Promise<T | undefined>
  gravar<T>(loja: LojaOffline, chave: string, valor: T): Promise<void>
  apagar(loja: LojaOffline, chave: string): Promise<void>
  listar<T>(loja: LojaOffline): Promise<T[]>
  limpar(loja: LojaOffline): Promise<void>
}

const LOJAS: LojaOffline[] = ["catalogo", "fila"]

export function criarArmazenamentoMemoria(): Armazenamento {
  const lojas: Record<LojaOffline, Map<string, unknown>> = {
    catalogo: new Map(),
    fila: new Map(),
  }
  return {
    async ler<T>(loja: LojaOffline, chave: string) {
      return lojas[loja].get(chave) as T | undefined
    },
    async gravar<T>(loja: LojaOffline, chave: string, valor: T) {
      lojas[loja].set(chave, valor)
    },
    async apagar(loja, chave) {
      lojas[loja].delete(chave)
    },
    async listar<T>(loja: LojaOffline) {
      return [...lojas[loja].values()] as T[]
    },
    async limpar(loja) {
      lojas[loja].clear()
    },
  }
}

const NOME_BANCO = "toldosprint-offline"
const VERSAO_BANCO = 1

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(NOME_BANCO, VERSAO_BANCO)
    pedido.onupgradeneeded = () => {
      const banco = pedido.result
      for (const loja of LOJAS) {
        if (!banco.objectStoreNames.contains(loja)) banco.createObjectStore(loja)
      }
    }
    pedido.onsuccess = () => resolve(pedido.result)
    pedido.onerror = () => reject(pedido.error)
  })
}

function pedidoParaPromessa<T>(pedido: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    pedido.onsuccess = () => resolve(pedido.result)
    pedido.onerror = () => reject(pedido.error)
  })
}

export function criarArmazenamentoIndexedDB(): Armazenamento {
  let banco: Promise<IDBDatabase> | null = null
  const obter = () => (banco ??= abrirBanco())

  async function executar<T>(
    loja: LojaOffline,
    modo: IDBTransactionMode,
    operacao: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const db = await obter()
    const transacao = db.transaction(loja, modo)
    const concluida = new Promise<void>((resolve, reject) => {
      transacao.oncomplete = () => resolve()
      transacao.onerror = () => reject(transacao.error)
      transacao.onabort = () => reject(transacao.error)
    })
    const resultado = await pedidoParaPromessa(operacao(transacao.objectStore(loja)))
    await concluida
    return resultado
  }

  return {
    ler: <T,>(loja: LojaOffline, chave: string) =>
      executar<T | undefined>(loja, "readonly", (s) => s.get(chave)),
    gravar: async (loja, chave, valor) => {
      await executar(loja, "readwrite", (s) => s.put(valor, chave))
    },
    apagar: async (loja, chave) => {
      await executar(loja, "readwrite", (s) => s.delete(chave))
    },
    listar: <T,>(loja: LojaOffline) =>
      executar<T[]>(loja, "readonly", (s) => s.getAll() as IDBRequest<T[]>),
    limpar: async (loja) => {
      await executar(loja, "readwrite", (s) => s.clear())
    },
  }
}

let padrao: Armazenamento | null = null

// Armazenamento do aparelho (só no navegador). Fora dele (servidor/testes sem
// IndexedDB) lança erro, então quem chama deve estar em um efeito do cliente.
export function armazenamentoLocal(): Armazenamento {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB indisponível neste ambiente")
  }
  return (padrao ??= criarArmazenamentoIndexedDB())
}
