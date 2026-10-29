# Orçamento offline — Fase 1: orçamento completo sem internet

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O vendedor, sem sinal, abre o app, faz um orçamento de toldo completo (cliente existente ou novo, vários itens, instalação, deslocamento, preço, fotos), gera o PDF provisório, e o orçamento sobe sozinho quando a internet voltar.

**Architecture:** A tela pública `/offline` (já guardada no aparelho pelo service worker, Fase 0) passa a renderizar **a mesma tela de Novo Orçamento** do sistema, alimentada por um provedor de dados offline que lê uma cópia local (IndexedDB) de clientes, materiais e serviços. Ao fechar offline, o orçamento vai para uma **fila** local (com fotos como Blob). Quando há internet, um sincronizador dentro da área logada fecha cada item da fila usando o `fecharOrcamento` que já existe (número oficial, parcelas, estoque), com idempotência por `id`.

**Tech Stack:** Next.js 16 (App Router), React, TypeScript, Vitest, IndexedDB (API nativa, sem biblioteca nova), service worker.

**Specs:** `docs/superpowers/specs/2026-10-28-orcamento-offline-pwa-design.md` (+ Fase 0 já em produção).

**Regras de ouro:** nenhum teste existente muda de resultado (`npx vitest run` ao fim de cada tarefa); online o sistema se comporta exatamente como hoje; **não dar push** em tarefa nenhuma (o dono sobe depois de testar).

**Limitação conhecida (documentada, não resolver aqui):** o `fecharOrcamento` grava no servidor em segundo plano e não devolve erro. O sincronizador confirma consultando o servidor, mas se a gravação falhar depois do `fecharOrcamento` já ter rodado, a nova tentativa pode repetir parcelas financeiras. É raro; a correção definitiva (rota única no servidor) fica para uma fase de endurecimento.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `lib/offline/armazenamento.ts` | criar | interface de armazenamento + versão IndexedDB + versão em memória (testes) |
| `lib/offline/catalogo.ts` | criar | cópia local de clientes/materiais/serviços |
| `lib/offline/fila.ts` | criar | fila de orçamentos pendentes |
| `lib/offline/sincronizar.ts` | criar | motor de envio da fila (dependências injetadas) |
| `context/data-context.tsx` | modificar | exportar `DataContext`; `id` opcional em `fecharOrcamento` e `addCliente`; `carregado`; grava cópia local |
| `context/modo-offline-context.tsx` | criar | flag "estamos na tela offline" |
| `components/orcamento/novo-orcamento-form.tsx` | criar (mover) | a tela de Novo Orçamento, movida de `page.tsx` |
| `app/(app)/orcamentos/novo/page.tsx` | modificar | passa a só renderizar o componente |
| `components/orcamentos/orcamento-oficial.tsx` | modificar | modo "provisório" |
| `components/offline/offline-data-provider.tsx` | criar | provedor de dados lendo a cópia local e a fila |
| `components/offline/offline-app.tsx` | criar | casca da tela offline (faixa, carregamento, tela de orçamento) |
| `app/offline/page.tsx` | modificar | renderiza `OfflineApp` |
| `public/sw.js` | modificar | guarda também fontes/CSS da tela offline; versão v3 |
| `components/offline/sincronizador-offline.tsx` | criar | envia a fila quando há internet + faixa "N aguardando envio" |
| `app/(app)/layout.tsx` | modificar | monta o sincronizador |
| `app/(auth)/sign-in/[[...sign-in]]/page.tsx` | modificar | apaga a cópia local ao chegar na tela de login |
| `tests/offline-*.test.ts(x)` | criar | testes |

---

### Task 1: Armazenamento, cópia local e fila (lib pura)

**Files:**
- Create: `lib/offline/armazenamento.ts`, `lib/offline/catalogo.ts`, `lib/offline/fila.ts`
- Test: `tests/offline-armazenamento.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Crie `tests/offline-armazenamento.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { criarArmazenamentoMemoria } from "@/lib/offline/armazenamento"
import { lerCatalogo, limparCatalogo, salvarCatalogo } from "@/lib/offline/catalogo"
import {
  contarFila,
  enfileirar,
  listarFila,
  MAX_TENTATIVAS,
  precisaAtencao,
  registrarFalha,
  removerDaFila,
  type ItemFila,
} from "@/lib/offline/fila"
import type { Cliente, Material, Servico } from "@/lib/types"

const cliente: Cliente = { id: "cli-1", nome: "Maria", telefone: "27999990000" }
const material: Material = {
  id: "m1", nome: "Lona", tipo: "Lona", unidade: "m2",
  precoUnitario: 10, estoqueMinimo: 0, quantidadeEstoque: 5,
}
const servico: Servico = { id: "s1", nome: "Montagem", formaCobranca: "fixo", valor: 100 }

function itemDaFila(id: string, criadoEm: string): Omit<ItemFila, "tentativas" | "ultimoErro"> {
  return {
    id,
    clienteId: cliente.id,
    item: {
      materialId: "m1", servicoId: "nenhum", largura: 1, altura: 1,
      quantidadeUnidades: 1, horasEstimadas: 0,
    },
    ajusteManual: 0,
    validadeDias: 7,
    fotos: [],
    totalProvisorio: 10,
    criadoEm,
  }
}

describe("armazenamento em memória", () => {
  it("grava, lê, lista, apaga e limpa por loja, sem misturar lojas", async () => {
    const arm = criarArmazenamentoMemoria()
    await arm.gravar("catalogo", "a", { n: 1 })
    await arm.gravar("fila", "a", { n: 2 })
    await arm.gravar("fila", "b", { n: 3 })
    expect(await arm.ler("catalogo", "a")).toEqual({ n: 1 })
    expect(await arm.ler("fila", "a")).toEqual({ n: 2 })
    expect((await arm.listar<{ n: number }>("fila")).map((x) => x.n).sort()).toEqual([2, 3])
    await arm.apagar("fila", "a")
    expect(await arm.ler("fila", "a")).toBeUndefined()
    await arm.limpar("fila")
    expect(await arm.listar("fila")).toEqual([])
    expect(await arm.ler("catalogo", "a")).toEqual({ n: 1 })
  })
})

describe("cópia local do catálogo", () => {
  it("devolve null sem cópia e a cópia com data depois de salvar", async () => {
    const arm = criarArmazenamentoMemoria()
    expect(await lerCatalogo(arm)).toBeNull()
    await salvarCatalogo(
      arm,
      { clientes: [cliente], materiais: [material], servicos: [servico] },
      new Date("2026-10-28T12:00:00.000Z")
    )
    const copia = await lerCatalogo(arm)
    expect(copia?.clientes).toEqual([cliente])
    expect(copia?.materiais).toEqual([material])
    expect(copia?.servicos).toEqual([servico])
    expect(copia?.atualizadoEm).toBe("2026-10-28T12:00:00.000Z")
  })

  it("a cópia nova substitui a antiga e limpar apaga", async () => {
    const arm = criarArmazenamentoMemoria()
    await salvarCatalogo(arm, { clientes: [cliente], materiais: [], servicos: [] })
    await salvarCatalogo(arm, { clientes: [], materiais: [material], servicos: [] })
    expect((await lerCatalogo(arm))?.clientes).toEqual([])
    await limparCatalogo(arm)
    expect(await lerCatalogo(arm)).toBeNull()
  })
})

describe("fila de orçamentos", () => {
  it("lista em ordem de criação, com tentativas zeradas", async () => {
    const arm = criarArmazenamentoMemoria()
    await enfileirar(arm, itemDaFila("orc-b", "2026-10-28T10:05:00.000Z"))
    await enfileirar(arm, itemDaFila("orc-a", "2026-10-28T10:00:00.000Z"))
    const fila = await listarFila(arm)
    expect(fila.map((i) => i.id)).toEqual(["orc-a", "orc-b"])
    expect(fila.every((i) => i.tentativas === 0)).toBe(true)
    expect(await contarFila(arm)).toBe(2)
  })

  it("registrar falha soma a tentativa e guarda o erro, sem tirar da fila", async () => {
    const arm = criarArmazenamentoMemoria()
    await enfileirar(arm, itemDaFila("orc-a", "2026-10-28T10:00:00.000Z"))
    await registrarFalha(arm, "orc-a", "sem rede")
    await registrarFalha(arm, "orc-a", "timeout")
    const [item] = await listarFila(arm)
    expect(item.tentativas).toBe(2)
    expect(item.ultimoErro).toBe("timeout")
    expect(precisaAtencao(item)).toBe(false)
  })

  it("com tentativas demais o item precisa de atenção", async () => {
    const arm = criarArmazenamentoMemoria()
    await enfileirar(arm, itemDaFila("orc-a", "2026-10-28T10:00:00.000Z"))
    for (let i = 0; i < MAX_TENTATIVAS; i++) await registrarFalha(arm, "orc-a", "erro")
    expect(precisaAtencao((await listarFila(arm))[0])).toBe(true)
  })

  it("remover tira só o item pedido; falha de item inexistente é ignorada", async () => {
    const arm = criarArmazenamentoMemoria()
    await enfileirar(arm, itemDaFila("orc-a", "2026-10-28T10:00:00.000Z"))
    await enfileirar(arm, itemDaFila("orc-b", "2026-10-28T10:01:00.000Z"))
    await registrarFalha(arm, "nao-existe", "x")
    await removerDaFila(arm, "orc-a")
    expect((await listarFila(arm)).map((i) => i.id)).toEqual(["orc-b"])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/offline-armazenamento.test.ts`
Expected: FAIL (módulos `@/lib/offline/*` não existem).

- [ ] **Step 3: Implementar o armazenamento**

Crie `lib/offline/armazenamento.ts`:

```ts
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
```

- [ ] **Step 4: Implementar o catálogo local**

Crie `lib/offline/catalogo.ts`:

```ts
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
```

- [ ] **Step 5: Implementar a fila**

Crie `lib/offline/fila.ts`:

```ts
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
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run tests/offline-armazenamento.test.ts && npx tsc --noEmit && npx vitest run`
Expected: testes novos PASS, `tsc` limpo, suíte inteira PASS.

- [ ] **Step 7: Commit**

Antes: `git checkout -b feat/offline-fase1` (a partir da `main`).

```bash
git add lib/offline tests/offline-armazenamento.test.ts
git commit -m "Offline fase 1: armazenamento local, cópia do catálogo e fila de orçamentos"
```

---

### Task 2: Motor de sincronização

**Files:**
- Create: `lib/offline/sincronizar.ts`
- Test: `tests/offline-sincronizar.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Crie `tests/offline-sincronizar.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"
import { sincronizarFila, type DependenciasSincronizacao } from "@/lib/offline/sincronizar"
import type { ArquivoFila, ItemFila } from "@/lib/offline/fila"
import type { Cliente, Orcamento } from "@/lib/types"

const arquivo = (nome: string): ArquivoFila => ({ nome, tipo: "image/jpeg", dados: new Blob(["x"]) })

function item(id: string, extra: Partial<ItemFila> = {}): ItemFila {
  return {
    id,
    clienteId: "cli-1",
    item: {
      materialId: "m1", servicoId: "nenhum", largura: 1, altura: 1,
      quantidadeUnidades: 1, horasEstimadas: 0,
    },
    ajusteManual: 0,
    validadeDias: 7,
    fotos: [],
    totalProvisorio: 100,
    criadoEm: "2026-10-28T10:00:00.000Z",
    tentativas: 0,
    ...extra,
  }
}

function criarDeps(fila: ItemFila[], sobrescrever: Partial<DependenciasSincronizacao> = {}) {
  const estado = { fila: [...fila], noServidor: new Set<string>(), clientes: new Set<string>(["cli-1"]) }
  const deps: DependenciasSincronizacao = {
    listar: async () => [...estado.fila],
    remover: async (id) => { estado.fila = estado.fila.filter((i) => i.id !== id) },
    registrarFalha: async (id, mensagem) => {
      estado.fila = estado.fila.map((i) =>
        i.id === id ? { ...i, tentativas: i.tentativas + 1, ultimoErro: mensagem } : i)
    },
    existeNoServidor: async (id) => estado.noServidor.has(id),
    clienteExiste: (id) => estado.clientes.has(id),
    criarCliente: vi.fn((c: Cliente) => { estado.clientes.add(c.id) }),
    enviarArquivo: vi.fn(async (a: ArquivoFila) => `https://blob/${a.nome}`),
    fecharOrcamento: vi.fn((dados) => {
      estado.noServidor.add(dados.id)
      return { id: dados.id, numero: 1003, totalFechado: 100 } as Orcamento
    }),
    ...sobrescrever,
  }
  return { deps, estado }
}

describe("sincronizarFila", () => {
  it("fecha o orçamento com o id da fila e só então tira da fila", async () => {
    const { deps, estado } = criarDeps([item("orc-a")])
    const r = await sincronizarFila(deps)
    expect(r.enviados).toEqual(["orc-a"])
    expect(r.falhas).toEqual([])
    expect(deps.fecharOrcamento).toHaveBeenCalledWith(expect.objectContaining({ id: "orc-a", clienteId: "cli-1" }))
    expect(estado.fila).toEqual([])
  })

  it("orçamento que já está no servidor sai da fila sem fechar de novo", async () => {
    const { deps, estado } = criarDeps([item("orc-a")])
    estado.noServidor.add("orc-a")
    const r = await sincronizarFila(deps)
    expect(r.enviados).toEqual(["orc-a"])
    expect(deps.fecharOrcamento).not.toHaveBeenCalled()
    expect(estado.fila).toEqual([])
  })

  it("rodar duas vezes seguidas não duplica", async () => {
    const { deps } = criarDeps([item("orc-a")])
    await sincronizarFila(deps)
    await sincronizarFila(deps)
    expect(deps.fecharOrcamento).toHaveBeenCalledTimes(1)
  })

  it("cria o cliente novo antes de fechar, uma vez só mesmo em dois orçamentos", async () => {
    const novo: Cliente = { id: "cli-novo", nome: "Seu José", telefone: "27988880000" }
    const { deps } = criarDeps([
      item("orc-a", { clienteId: novo.id, clienteNovo: novo }),
      item("orc-b", { clienteId: novo.id, clienteNovo: novo, criadoEm: "2026-10-28T10:05:00.000Z" }),
    ])
    await sincronizarFila(deps)
    expect(deps.criarCliente).toHaveBeenCalledTimes(1)
    expect(deps.criarCliente).toHaveBeenCalledWith(novo)
  })

  it("envia as fotos e o anexo e troca as urls provisórias pelas reais", async () => {
    const { deps } = criarDeps([
      item("orc-a", {
        item: {
          materialId: "m1", servicoId: "nenhum", largura: 1, altura: 1,
          quantidadeUnidades: 1, horasEstimadas: 0,
          fotos: [
            { url: "foto:0", legenda: "frente" },
            { url: "foto:1", legenda: "lateral" },
          ],
        },
        fotos: [arquivo("f0.jpg"), arquivo("f1.jpg")],
        anexo: arquivo("local.jpg"),
      }),
    ])
    await sincronizarFila(deps)
    expect(deps.fecharOrcamento).toHaveBeenCalledWith(
      expect.objectContaining({
        anexoNome: "local.jpg",
        anexoUrl: "https://blob/local.jpg",
        item: expect.objectContaining({
          fotos: [
            { url: "https://blob/f0.jpg", legenda: "frente" },
            { url: "https://blob/f1.jpg", legenda: "lateral" },
          ],
        }),
      })
    )
  })

  it("falha no envio da foto: não fecha, mantém na fila, anota o erro e segue com os outros", async () => {
    const { deps, estado } = criarDeps(
      [
        item("orc-a", {
          item: {
            materialId: "m1", servicoId: "nenhum", largura: 1, altura: 1,
            quantidadeUnidades: 1, horasEstimadas: 0,
            fotos: [{ url: "foto:0", legenda: "" }],
          },
          fotos: [arquivo("f0.jpg")],
        }),
        item("orc-b", { criadoEm: "2026-10-28T10:05:00.000Z" }),
      ],
      { enviarArquivo: vi.fn(async () => { throw new Error("sem rede") }) }
    )
    const r = await sincronizarFila(deps)
    expect(r.falhas).toEqual([{ id: "orc-a", erro: "sem rede" }])
    expect(r.enviados).toEqual(["orc-b"])
    expect(estado.fila.map((i) => i.id)).toEqual(["orc-a"])
    expect(estado.fila[0].tentativas).toBe(1)
    expect(estado.fila[0].ultimoErro).toBe("sem rede")
  })

  it("se o servidor não confirma, mantém na fila com erro", async () => {
    const { deps, estado } = criarDeps([item("orc-a")], {
      fecharOrcamento: vi.fn(() => ({ id: "orc-a", numero: 1003, totalFechado: 100 }) as Orcamento),
    })
    const r = await sincronizarFila(deps)
    expect(r.enviados).toEqual([])
    expect(r.falhas[0].id).toBe("orc-a")
    expect(estado.fila).toHaveLength(1)
  })

  it("não tenta de novo itens que precisam de atenção", async () => {
    const { deps } = criarDeps([item("orc-a", { tentativas: 5 })])
    const r = await sincronizarFila(deps)
    expect(deps.fecharOrcamento).not.toHaveBeenCalled()
    expect(r.enviados).toEqual([])
    expect(r.falhas).toEqual([])
  })

  it("com forcar, tenta de novo também os que precisam de atenção", async () => {
    const { deps } = criarDeps([item("orc-a", { tentativas: 5 })])
    const r = await sincronizarFila(deps, { forcar: true })
    expect(r.enviados).toEqual(["orc-a"])
  })

  it("avisa quando o valor final é diferente do provisório", async () => {
    const { deps } = criarDeps([item("orc-a", { totalProvisorio: 90 })])
    const r = await sincronizarFila(deps)
    expect(r.mudancas).toEqual([{ numero: 1003, de: 90, para: 100 }])
  })

  it("não avisa quando o valor é o mesmo (diferença de centavos de arredondamento)", async () => {
    const { deps } = criarDeps([item("orc-a", { totalProvisorio: 100.004 })])
    const r = await sincronizarFila(deps)
    expect(r.mudancas).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/offline-sincronizar.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

Crie `lib/offline/sincronizar.ts`:

```ts
import { precisaAtencao, type ArquivoFila, type ItemFila } from "./fila"
import type { Cliente, Orcamento, OrcamentoItem } from "@/lib/types"

export interface DependenciasSincronizacao {
  listar(): Promise<ItemFila[]>
  remover(id: string): Promise<void>
  registrarFalha(id: string, mensagem: string): Promise<void>
  // Consulta o SERVIDOR (não a memória da tela): é o que prova que salvou.
  existeNoServidor(id: string): Promise<boolean>
  clienteExiste(id: string): boolean
  criarCliente(cliente: Cliente): void
  enviarArquivo(arquivo: ArquivoFila): Promise<string>
  fecharOrcamento(dados: {
    id: string
    clienteId: string
    item: OrcamentoItem
    ajusteManual: number
    anexoNome: string | null
    anexoUrl?: string
    validadeDias: number
  }): Orcamento
}

export interface ResultadoSincronizacao {
  enviados: string[]
  falhas: { id: string; erro: string }[]
  // Orçamentos cujo valor final difere do mostrado no PDF provisório.
  mudancas: { numero: number; de: number; para: number }[]
}

// Envia a fila, em ordem de criação. Um item só sai da fila depois que o
// servidor confirma que o orçamento existe; qualquer falha deixa o item lá,
// com a mensagem do erro, e os demais seguem.
export async function sincronizarFila(
  deps: DependenciasSincronizacao,
  opcoes: { forcar?: boolean } = {}
): Promise<ResultadoSincronizacao> {
  const resultado: ResultadoSincronizacao = { enviados: [], falhas: [], mudancas: [] }
  const itens = (await deps.listar()).filter(
    (item) => opcoes.forcar || !precisaAtencao(item)
  )

  for (const item of itens) {
    try {
      if (await deps.existeNoServidor(item.id)) {
        await deps.remover(item.id)
        resultado.enviados.push(item.id)
        continue
      }

      if (item.clienteNovo && !deps.clienteExiste(item.clienteNovo.id)) {
        deps.criarCliente(item.clienteNovo)
      }

      const urlsDasFotos: string[] = []
      for (const foto of item.fotos) urlsDasFotos.push(await deps.enviarArquivo(foto))
      const anexoUrl = item.anexo ? await deps.enviarArquivo(item.anexo) : undefined
      const fotos = (item.item.fotos ?? []).map((foto, i) => ({
        ...foto,
        url: urlsDasFotos[i] ?? foto.url,
      }))

      const orcamento = deps.fecharOrcamento({
        id: item.id,
        clienteId: item.clienteId,
        item: { ...item.item, fotos: fotos.length > 0 ? fotos : undefined },
        ajusteManual: item.ajusteManual,
        anexoNome: item.anexo?.nome ?? null,
        anexoUrl,
        validadeDias: item.validadeDias,
      })

      if (!(await deps.existeNoServidor(orcamento.id))) {
        throw new Error("O servidor não confirmou o salvamento do orçamento")
      }

      await deps.remover(item.id)
      resultado.enviados.push(item.id)
      if (
        orcamento.totalFechado !== undefined &&
        Math.abs(orcamento.totalFechado - item.totalProvisorio) > 0.005
      ) {
        resultado.mudancas.push({
          numero: orcamento.numero,
          de: item.totalProvisorio,
          para: orcamento.totalFechado,
        })
      }
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "Erro desconhecido"
      await deps.registrarFalha(item.id, mensagem)
      resultado.falhas.push({ id: item.id, erro: mensagem })
    }
  }
  return resultado
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/offline-sincronizar.test.ts && npx tsc --noEmit && npx vitest run`
Expected: PASS em tudo.

- [ ] **Step 5: Commit**

```bash
git add lib/offline/sincronizar.ts tests/offline-sincronizar.test.ts
git commit -m "Offline fase 1: motor de sincronização da fila"
```

---

### Task 3: `DataProvider` — id opcional, `carregado` e cópia local

**Files:**
- Modify: `context/data-context.tsx`
- Test: `tests/data-context.test.tsx`

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/data-context.test.tsx`, dentro do `describe("fluxos de dados", ...)`, acrescente (usa `montar`, `criarDadosOrcamento` e `act`/`waitFor` já importados):

```tsx
  it("fecha o orçamento com o id recebido (idempotência do envio offline)", async () => {
    const { result } = await montar()
    let orcamento: { id: string } | undefined
    act(() => {
      orcamento = result.current.fecharOrcamento({ ...criarDadosOrcamento(), id: "orc-offline-1" })
    })
    expect(orcamento?.id).toBe("orc-offline-1")
    await waitFor(() =>
      expect(result.current.orcamentos.some((o) => o.id === "orc-offline-1")).toBe(true)
    )
  })

  it("sem id, o orçamento continua ganhando um id gerado", async () => {
    const { result } = await montar()
    let id = ""
    act(() => {
      id = result.current.fecharOrcamento(criarDadosOrcamento()).id
    })
    expect(id).toMatch(/^orc-/)
  })

  it("cadastra cliente com o id recebido", async () => {
    const { result } = await montar()
    let cliente: { id: string } | undefined
    act(() => {
      cliente = result.current.addCliente({ nome: "Seu José", telefone: "27988880000" }, "cli-offline-1")
    })
    expect(cliente?.id).toBe("cli-offline-1")
    await waitFor(() =>
      expect(result.current.clientes.some((c) => c.id === "cli-offline-1")).toBe(true)
    )
  })

  it("expõe `carregado` verdadeiro depois de carregar os dados do servidor", async () => {
    const { result } = await montar()
    await waitFor(() => expect(result.current.carregado).toBe(true))
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/data-context.test.tsx -t "idempotência|id gerado|id recebido|carregado"`
Expected: FAIL (`carregado` indefinido, `id` ignorado).

- [ ] **Step 3: Implementar**

Em `context/data-context.tsx`:

(a) Exporte o contexto e o tipo: troque `interface DataContextValue {` por `export interface DataContextValue {` e `const DataContext = createContext<DataContextValue | null>(null)` por `export const DataContext = createContext<DataContextValue | null>(null)`.

(b) No `DataContextValue`: acrescente `carregado: boolean` logo depois de `rascunho: RascunhoOrcamento | null`; troque `addCliente: (dados: Omit<Cliente, "id">) => Cliente` por `addCliente: (dados: Omit<Cliente, "id">, id?: string) => Cliente`; no tipo de `fecharOrcamento`, acrescente `id?: string` como primeiro campo do objeto.

(c) Estado: depois de `const [rascunho, setRascunho] = ...` acrescente `const [carregado, setCarregado] = useState(false)`.

(d) Em `carregar()`, depois de `setMensagensBot(msg)` (último `set` do `try`), acrescente `setCarregado(true)`.

(e) `addCliente`: troque `const addCliente: DataContextValue["addCliente"] = (dados) => {` e a linha `const novo: Cliente = { id: gerarId("cli"), ...dados }` por:

```ts
  const addCliente: DataContextValue["addCliente"] = (dados, id) => {
    const novo: Cliente = { id: id ?? gerarId("cli"), ...dados }
```

(f) `fecharOrcamento`: troque `id: gerarId("orc"),` (dentro do objeto `novo: Orcamento`) por `id: dados.id ?? gerarId("orc"),`.

(g) Cópia local: acrescente os imports `import { armazenamentoLocal } from "@/lib/offline/armazenamento"` e `import { salvarCatalogo } from "@/lib/offline/catalogo"`, e, logo depois do `useEffect` que chama `carregar()`, acrescente:

```ts
  // Guarda uma cópia dos dados que o orçamento usa, pra abrir sem internet.
  // Só depois da primeira carga (senão guardaria listas vazias por cima).
  useEffect(() => {
    if (!carregado) return
    try {
      salvarCatalogo(armazenamentoLocal(), { clientes, materiais, servicos }).catch(() => {})
    } catch {
      // Sem IndexedDB (ex.: testes): segue sem cópia local.
    }
  }, [carregado, clientes, materiais, servicos])
```

(h) No objeto `value` do `useMemo`, acrescente `carregado,` (depois de `rascunho,`) e `carregado` na lista de dependências (depois de `rascunho`).

- [ ] **Step 4: Rodar tudo**

Run: `npx vitest run && npx tsc --noEmit && npx eslint context/data-context.tsx`
Expected: tudo PASS; eslint sem avisos novos.

- [ ] **Step 5: Commit**

```bash
git add context/data-context.tsx tests/data-context.test.tsx
git commit -m "Offline fase 1: DataProvider com id opcional, carregado e cópia local do catálogo"
```

---

### Task 4: Extrair a tela de orçamento e criar o modo offline dela

**Files:**
- Create: `context/modo-offline-context.tsx`
- Create (mover): `components/orcamento/novo-orcamento-form.tsx`
- Modify: `app/(app)/orcamentos/novo/page.tsx`
- Modify: `components/orcamentos/orcamento-oficial.tsx`

- [ ] **Step 1: Contexto do modo offline**

Crie `context/modo-offline-context.tsx`:

```tsx
"use client"

import { createContext, useContext } from "react"

// Verdadeiro dentro da tela /offline: o orçamento não grava no servidor, vai
// pra fila do aparelho.
export const ModoOfflineContext = createContext(false)

export function useModoOffline() {
  return useContext(ModoOfflineContext)
}
```

- [ ] **Step 2: Mover a tela para um componente**

```bash
git mv "app/(app)/orcamentos/novo/page.tsx" components/orcamento/novo-orcamento-form.tsx
```

Em `components/orcamento/novo-orcamento-form.tsx` troque `export default function NovoOrcamentoPage() {` por `export function NovoOrcamentoForm() {`. Crie o novo `app/(app)/orcamentos/novo/page.tsx`:

```tsx
import { NovoOrcamentoForm } from "@/components/orcamento/novo-orcamento-form"

export default function NovoOrcamentoPage() {
  return <NovoOrcamentoForm />
}
```

Run: `npx tsc --noEmit && npx vitest run`. Expected: PASS (mudança só de lugar; os testes que importavam a página, se houver, devem ser ajustados para o novo componente sem mudar o que verificam).

- [ ] **Step 3: PDF provisório**

Em `components/orcamentos/orcamento-oficial.tsx`, leia como o número é mostrado (procure `numero` no JSX). Acrescente a prop opcional `provisorio?: boolean` ao componente e ao tipo. Quando `provisorio` for verdadeiro: no lugar do texto "ORÇAMENTO Nº {numero}" mostre "ORÇAMENTO PROVISÓRIO", e logo abaixo, em fonte pequena, "O número oficial será enviado quando o orçamento for sincronizado." Sem `provisorio`, nada muda. Não altere o restante do layout.

- [ ] **Step 4: Ramo offline na tela**

Em `components/orcamento/novo-orcamento-form.tsx`:

(a) Imports novos:

```ts
import { useRef } from "react"   // junto do import existente de "react" (acrescente useRef à lista)
import { useModoOffline } from "@/context/modo-offline-context"
import { armazenamentoLocal } from "@/lib/offline/armazenamento"
import { enfileirar, type ArquivoFila } from "@/lib/offline/fila"
```

(b) No início do componente, depois de `const router = useRouter()`:

```ts
  const offline = useModoOffline()
  // Arquivos das fotos adicionadas sem internet (a chave é a url temporária de prévia).
  const arquivosDasFotos = useRef(new Map<string, File>())
  const [salvoOffline, setSalvoOffline] = useState<{ clienteNome: string; total: number } | null>(null)
```

(c) Em `adicionarFotos`, logo depois de `if (imagens.length === 0) return`, acrescente:

```ts
    if (offline) {
      const novas: FotoOrcamento[] = imagens.map((imagem) => {
        const url = URL.createObjectURL(imagem)
        arquivosDasFotos.current.set(url, imagem)
        return { url, legenda: "" }
      })
      setFotos((atual) => [...atual, ...novas])
      return
    }
```

(d) Acrescente a função (perto de `handleFechar`):

```ts
  function paraArquivoFila(arquivoLocal: File): ArquivoFila {
    return { nome: arquivoLocal.name, tipo: arquivoLocal.type, dados: arquivoLocal }
  }

  // Sem internet: guarda o orçamento na fila do aparelho (sobe quando o sinal voltar).
  async function handleEnfileirar() {
    if (!podeFechar || !cliente || !material) return
    setEnviando(true)
    try {
      const id = `orc-${Math.random().toString(36).slice(2, 10)}`
      const fotosComArquivo = fotos.filter((f) => arquivosDasFotos.current.has(f.url))
      await enfileirar(armazenamentoLocal(), {
        id,
        clienteId: cliente.id,
        clienteNovo: cliente.id.startsWith("cli-offline-") ? cliente : undefined,
        item: {
          ...item,
          fotos:
            fotosComArquivo.length > 0
              ? fotosComArquivo.map((f, i) => ({ url: `foto:${i}`, legenda: f.legenda }))
              : undefined,
        },
        ajusteManual: numeroOuZero(ajusteManual),
        validadeDias: numeroOuZero(validadeDias),
        anexo: arquivo ? paraArquivoFila(arquivo) : undefined,
        fotos: fotosComArquivo.map((f) => paraArquivoFila(arquivosDasFotos.current.get(f.url)!)),
        totalProvisorio: resultado?.total ?? 0,
        criadoEm: new Date().toISOString(),
      })
      setSalvoOffline({ clienteNome: cliente.nome, total: resultado?.total ?? 0 })
    } catch {
      toast.error("Não foi possível salvar no aparelho. Tente de novo.")
    } finally {
      setEnviando(false)
    }
  }
```

(e) No começo de `handleFechar`, logo depois da linha `async function handleFechar() {`, acrescente `if (offline) return handleEnfileirar()`.

(f) No PDF: na chamada `<OrcamentoOficial ... />`, passe `provisorio={offline}` e, quando `offline`, `numero=""` (mantenha o `numero` atual quando não for offline).

(g) Tela de sucesso: o bloco que renderiza a grade do formulário (`<div className="grid gap-6 lg:grid-cols-3 print:hidden">`) deve ficar dentro de `{!salvoOffline && ( ... )}`; e **antes** dele (ainda dentro do `<div className="flex flex-col gap-6">` raiz) acrescente:

```tsx
      {salvoOffline && (
        <Card className="print:hidden">
          <CardContent className="flex flex-col gap-4 pt-6">
            <p className="text-lg font-semibold">Orçamento salvo no aparelho</p>
            <p className="text-sm text-muted-foreground">
              Cliente: {salvoOffline.clienteNome} · Total {formatarMoeda(salvoOffline.total)}.
              Ele será enviado automaticamente quando houver internet. Enquanto isso,
              você pode gerar o PDF provisório (sem número) para mostrar ao cliente.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Gerar PDF provisório
              </Button>
              <Button onClick={() => window.location.assign("/offline")}>
                Fazer outro orçamento
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
```

O bloco `<div className="hidden print:block"><OrcamentoOficial .../></div>` (PDF) **não** pode ficar dentro do `{!salvoOffline && ...}`: precisa continuar renderizado para o botão de PDF funcionar.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npx vitest run && npx eslint components/orcamento components/orcamentos context`
Expected: PASS; eslint sem avisos novos. Online, a tela se comporta como antes (nada muda sem o `ModoOfflineContext`).

- [ ] **Step 6: Commit**

```bash
git add context/modo-offline-context.tsx components/orcamento/novo-orcamento-form.tsx "app/(app)/orcamentos/novo/page.tsx" components/orcamentos/orcamento-oficial.tsx
git commit -m "Offline fase 1: tela de orçamento reutilizável com modo offline e PDF provisório"
```

---

### Task 5: Tela `/offline` com o orçamento completo

**Files:**
- Create: `components/offline/offline-data-provider.tsx`, `components/offline/offline-app.tsx`
- Modify: `app/offline/page.tsx`, `public/sw.js`
- Delete: `app/offline/botao-tentar-novamente.tsx` (passa a ser parte do `OfflineApp`)

- [ ] **Step 1: Provedor de dados offline**

Crie `components/offline/offline-data-provider.tsx`:

```tsx
"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { DataContext, type DataContextValue } from "@/context/data-context"
import { armazenamentoLocal } from "@/lib/offline/armazenamento"
import { lerCatalogo, type CatalogoLocal } from "@/lib/offline/catalogo"
import { listarFila } from "@/lib/offline/fila"
import type { Cliente } from "@/lib/types"

type Estado =
  | { situacao: "carregando" }
  | { situacao: "sem-copia" }
  | { situacao: "pronto"; catalogo: CatalogoLocal; clientesDaFila: Cliente[] }

// Alimenta a tela de orçamento com a cópia local (clientes, materiais, serviços)
// e com os clientes cadastrados offline que ainda estão na fila. Só implementa o
// que o orçamento novo usa; qualquer outra função chamada por engano falha alto.
export function OfflineDataProvider({
  children,
  aoCarregar,
}: {
  children: (estado: { situacao: Estado["situacao"]; atualizadoEm?: string }) => ReactNode
  aoCarregar?: () => void
}) {
  const [estado, setEstado] = useState<Estado>({ situacao: "carregando" })
  const [clientesNovos, setClientesNovos] = useState<Cliente[]>([])

  useEffect(() => {
    let ativo = true
    ;(async () => {
      try {
        const arm = armazenamentoLocal()
        const catalogo = await lerCatalogo(arm)
        const fila = await listarFila(arm)
        if (!ativo) return
        if (!catalogo) {
          setEstado({ situacao: "sem-copia" })
          return
        }
        const clientesDaFila = fila.flatMap((i) => (i.clienteNovo ? [i.clienteNovo] : []))
        setEstado({ situacao: "pronto", catalogo, clientesDaFila })
        aoCarregar?.()
      } catch {
        if (ativo) setEstado({ situacao: "sem-copia" })
      }
    })()
    return () => {
      ativo = false
    }
  }, [aoCarregar])

  const addCliente = useCallback<DataContextValue["addCliente"]>((dados, id) => {
    const novo: Cliente = { id: id ?? `cli-offline-${Math.random().toString(36).slice(2, 10)}`, ...dados }
    setClientesNovos((atual) => [...atual, novo])
    return novo
  }, [])

  const valor = useMemo(() => {
    if (estado.situacao !== "pronto") return null
    const clientes = [
      ...estado.catalogo.clientes,
      ...estado.clientesDaFila.filter((c) => !estado.catalogo.clientes.some((x) => x.id === c.id)),
      ...clientesNovos.filter((c) => !estado.clientesDaFila.some((x) => x.id === c.id)),
    ]
    const usado: Partial<DataContextValue> = {
      materiais: estado.catalogo.materiais,
      servicos: estado.catalogo.servicos,
      clientes,
      orcamentos: [],
      rascunho: null,
      carregado: true,
      consumirRascunho: () => {},
      updateOrcamento: () => false,
      addCliente,
    }
    // Funções que o orçamento novo não usa: falham alto se alguém chamar.
    return new Proxy(usado, {
      get(alvo, chave) {
        if (chave in alvo) return alvo[chave as keyof typeof alvo]
        return () => {
          throw new Error(`"${String(chave)}" não está disponível offline`)
        }
      },
    }) as unknown as DataContextValue
  }, [estado, clientesNovos, addCliente])

  const ctx = { situacao: estado.situacao, atualizadoEm: estado.situacao === "pronto" ? estado.catalogo.atualizadoEm : undefined }
  if (!valor) return <>{children(ctx)}</>
  return <DataContext.Provider value={valor}>{children(ctx)}</DataContext.Provider>
}
```

- [ ] **Step 2: Casca da tela offline**

Crie `components/offline/offline-app.tsx`:

```tsx
"use client"

import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { ModoOfflineContext } from "@/context/modo-offline-context"
import { NovoOrcamentoForm } from "@/components/orcamento/novo-orcamento-form"
import { OfflineDataProvider } from "./offline-data-provider"

function formatarDataHora(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
}

// Tela mostrada sem internet: faz o orçamento completo com os dados guardados
// no aparelho e põe na fila pra enviar depois.
export function OfflineApp() {
  return (
    <ModoOfflineContext.Provider value={true}>
      <OfflineDataProvider>
        {({ situacao, atualizadoEm }) => (
          <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 px-4 py-4">
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm print:hidden">
              <p className="font-medium">Modo offline</p>
              <p className="text-muted-foreground">
                Os orçamentos feitos aqui ficam salvos no aparelho e sobem sozinhos quando
                houver internet (abra o app com sinal).
                {atualizadoEm && ` Dados de ${formatarDataHora(atualizadoEm)}.`}
              </p>
            </div>

            {situacao === "carregando" && (
              <p className="text-sm text-muted-foreground">Carregando dados do aparelho…</p>
            )}

            {situacao === "sem-copia" && (
              <div className="flex flex-col items-start gap-3 rounded-lg border border-border p-4">
                <p className="font-medium">Ainda não há dados guardados neste aparelho.</p>
                <p className="text-sm text-muted-foreground">
                  Abra o sistema com internet pelo menos uma vez para guardar clientes,
                  materiais e serviços. Depois disso o orçamento funciona sem sinal.
                </p>
                <Button onClick={() => window.location.assign("/dashboard")}>
                  Tentar abrir o sistema
                </Button>
              </div>
            )}

            {situacao === "pronto" && (
              <Suspense fallback={null}>
                <NovoOrcamentoForm />
              </Suspense>
            )}
          </main>
        )}
      </OfflineDataProvider>
    </ModoOfflineContext.Provider>
  )
}
```

- [ ] **Step 3: Página `/offline`**

Substitua `app/offline/page.tsx` por:

```tsx
import type { Metadata } from "next"
import { OfflineApp } from "@/components/offline/offline-app"

export const metadata: Metadata = {
  title: "Sem internet — Toldos Print",
}

// Tela pública (sem login) que o service worker mostra quando uma página do
// app não abre por falta de internet. Fica guardada no aparelho (ver
// public/sw.js) e roda o orçamento completo com os dados salvos no aparelho.
export default function OfflinePage() {
  return <OfflineApp />
}
```

Apague `app/offline/botao-tentar-novamente.tsx` (`git rm`).

- [ ] **Step 4: Service worker v3 (fontes e estilos da tela offline)**

Em `public/sw.js`: troque `const CACHE = "toldosprint-v2"` por `"toldosprint-v3"` e, dentro de `guardarTelaOffline`, depois do `Promise.all` que guarda os arquivos achados no HTML, acrescente a leitura dos CSS para guardar as fontes que eles pedem:

```js
  // Fontes (e imagens) citadas dentro dos CSS da tela offline.
  const folhas = [...arquivos].filter((arquivo) => arquivo.endsWith(".css"))
  const extras = new Set()
  for (const folha of folhas) {
    const guardado = await cache.match(folha)
    if (!guardado) continue
    const css = await guardado.clone().text()
    for (const achado of css.matchAll(/url\((?:"|')?(\/_next\/static\/[^)"']+)(?:"|')?\)/g)) {
      extras.add(achado[1])
    }
  }
  await Promise.all(
    [...extras].map(async (arquivo) => {
      try {
        const r = await fetch(arquivo)
        if (r.ok) await cache.put(arquivo, r)
      } catch {
        // Fonte que falhar: a tela abre com a fonte padrão.
      }
    })
  )
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npx vitest run && npx eslint components/offline app/offline`
Expected: PASS, sem avisos novos.

Teste no navegador (Playwright, produção local): `npx next build` e `npx next start -p 3003`; 1) logado e **online**, abra `/dashboard` (a cópia local é gravada); 2) confira no console `indexedDB` (banco `toldosprint-offline`, loja `catalogo` com clientes/materiais/serviços); 3) modo offline, abra `/dashboard`: deve aparecer a faixa "Modo offline" e a tela de Novo Orçamento com a lista de clientes e materiais preenchida; 4) monte um orçamento com 2 itens e um cliente novo (botão "Novo cliente"), feche, confira a tela "Orçamento salvo no aparelho" e a fila no IndexedDB (loja `fila`, 1 item). **Não** religue a internet nesta tarefa (o envio é a Tarefa 6).

- [ ] **Step 6: Commit**

```bash
git add components/offline app/offline public/sw.js
git commit -m "Offline fase 1: orçamento completo na tela /offline, com os dados guardados no aparelho"
```

---

### Task 6: Envio automático e faixa "aguardando envio" (área logada)

**Files:**
- Create: `components/offline/sincronizador-offline.tsx`
- Modify: `app/(app)/layout.tsx`
- Modify: `app/(auth)/sign-in/[[...sign-in]]/page.tsx`

- [ ] **Step 1: Sincronizador**

Crie `components/offline/sincronizador-offline.tsx`:

```tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useData } from "@/context/data-context"
import { armazenamentoLocal } from "@/lib/offline/armazenamento"
import {
  listarFila,
  precisaAtencao,
  registrarFalha,
  removerDaFila,
  type ItemFila,
} from "@/lib/offline/fila"
import { sincronizarFila } from "@/lib/offline/sincronizar"
import { formatarMoeda } from "@/lib/format"

async function existeNoServidor(id: string): Promise<boolean> {
  // O fecharOrcamento grava em segundo plano: dá uns segundos pra aparecer.
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const res = await fetch("/api/orcamentos", { cache: "no-store" })
    if (res.ok) {
      const lista = (await res.json()) as { id: string }[]
      if (lista.some((o) => o.id === id)) return true
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

async function enviarArquivo(arquivo: { nome: string; dados: Blob }): Promise<string> {
  const form = new FormData()
  form.append("file", new File([arquivo.dados], arquivo.nome))
  const res = await fetch("/api/upload", { method: "POST", body: form })
  if (!res.ok) throw new Error(`Falha ao enviar ${arquivo.nome}`)
  const { url } = await res.json()
  return url as string
}

// Dentro da área logada: manda a fila de orçamentos feitos offline quando há
// internet (ao abrir o app, quando o sinal volta ou no botão "Enviar agora") e
// mostra quantos estão esperando.
export function SincronizadorOffline() {
  const { carregado, clientes, fecharOrcamento, addCliente } = useData()
  const [fila, setFila] = useState<ItemFila[]>([])
  const [enviando, setEnviando] = useState(false)
  const rodando = useRef(false)
  const clientesRef = useRef(clientes)
  clientesRef.current = clientes

  const atualizarFila = useCallback(async () => {
    try {
      setFila(await listarFila(armazenamentoLocal()))
    } catch {
      setFila([])
    }
  }, [])

  const enviar = useCallback(
    async (forcar = false) => {
      if (rodando.current || !carregado || !navigator.onLine) return
      rodando.current = true
      setEnviando(true)
      try {
        const arm = armazenamentoLocal()
        const resultado = await sincronizarFila(
          {
            listar: () => listarFila(arm),
            remover: (id) => removerDaFila(arm, id),
            registrarFalha: (id, mensagem) => registrarFalha(arm, id, mensagem),
            existeNoServidor,
            clienteExiste: (id) => clientesRef.current.some((c) => c.id === id),
            criarCliente: (c) => addCliente({ nome: c.nome, telefone: c.telefone, email: c.email }, c.id),
            enviarArquivo,
            fecharOrcamento: (dados) => fecharOrcamento(dados),
          },
          { forcar }
        )
        if (resultado.enviados.length > 0) {
          toast.success(
            resultado.enviados.length === 1
              ? "1 orçamento feito offline foi enviado."
              : `${resultado.enviados.length} orçamentos feitos offline foram enviados.`
          )
        }
        for (const m of resultado.mudancas) {
          toast.warning(
            `Orçamento #${m.numero}: o valor mudou de ${formatarMoeda(m.de)} para ${formatarMoeda(m.para)}.`
          )
        }
        for (const f of resultado.falhas) {
          toast.error(`Não foi possível enviar um orçamento: ${f.erro}`)
        }
      } catch {
        // Sem IndexedDB ou rede: tenta de novo na próxima oportunidade.
      } finally {
        rodando.current = false
        setEnviando(false)
        atualizarFila()
      }
    },
    [carregado, addCliente, fecharOrcamento, atualizarFila]
  )

  useEffect(() => {
    atualizarFila()
  }, [atualizarFila])

  useEffect(() => {
    if (!carregado) return
    enviar()
    const aoVoltarSinal = () => enviar()
    window.addEventListener("online", aoVoltarSinal)
    return () => window.removeEventListener("online", aoVoltarSinal)
  }, [carregado, enviar])

  if (fila.length === 0) return null
  const precisamAtencao = fila.filter(precisaAtencao).length

  return (
    <div className="fixed inset-x-3 bottom-20 z-20 flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-card p-3 shadow-lg md:bottom-4 md:left-auto md:w-96 print:hidden">
      <p className="text-sm font-medium">
        {fila.length === 1
          ? "1 orçamento aguardando envio"
          : `${fila.length} orçamentos aguardando envio`}
      </p>
      {precisamAtencao > 0 && (
        <p className="text-xs text-red-600 dark:text-red-300">
          {precisamAtencao} precisa de atenção (falhou várias vezes). Toque em “Enviar agora”.
        </p>
      )}
      <Button size="sm" disabled={enviando} onClick={() => enviar(true)}>
        {enviando ? "Enviando…" : "Enviar agora"}
      </Button>
    </div>
  )
}
```

(`Cliente` pode não ter `email` opcional — se o `tsc` reclamar do campo `email`, ajuste `criarCliente` para repassar exatamente os campos que o tipo `Cliente` tem, sem o `id`.)

- [ ] **Step 2: Montar na área logada**

Em `app/(app)/layout.tsx`, acrescente `import { SincronizadorOffline } from "@/components/offline/sincronizador-offline"` e, dentro do `DataProvider`, depois de `<RegistrarServiceWorker />`, acrescente `<SincronizadorOffline />` (precisa estar **dentro** do `DataProvider`).

- [ ] **Step 3: Apagar a cópia local ao chegar na tela de login**

Os dados do catálogo ficam no aparelho; quem sai do sistema não deve deixá-los acessíveis pela tela offline. Em `app/(auth)/sign-in/[[...sign-in]]/page.tsx`, transforme em componente que apaga a cópia (a fila **não** é apagada: ela tem orçamentos que ainda precisam subir):

Crie `components/offline/limpar-copia-local.tsx`:

```tsx
"use client"

import { useEffect } from "react"
import { armazenamentoLocal } from "@/lib/offline/armazenamento"
import { limparCatalogo } from "@/lib/offline/catalogo"

// Quem chega na tela de login não está logado: tira do aparelho a cópia de
// clientes/materiais/serviços (a fila de orçamentos pendentes é mantida).
export function LimparCopiaLocal() {
  useEffect(() => {
    try {
      limparCatalogo(armazenamentoLocal()).catch(() => {})
    } catch {
      // Sem IndexedDB: nada a limpar.
    }
  }, [])
  return null
}
```

E em `app/(auth)/sign-in/[[...sign-in]]/page.tsx`:

```tsx
import { SignIn } from "@clerk/nextjs"
import { LimparCopiaLocal } from "@/components/offline/limpar-copia-local"

export default function SignInPage() {
  return (
    <>
      <LimparCopiaLocal />
      <SignIn signUpUrl="/sign-up" />
    </>
  )
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npx vitest run && npx eslint components/offline "app/(app)/layout.tsx" "app/(auth)"`
Expected: PASS, sem avisos novos.

- [ ] **Step 5: Commit**

```bash
git add components/offline/sincronizador-offline.tsx components/offline/limpar-copia-local.tsx "app/(app)/layout.tsx" "app/(auth)/sign-in/[[...sign-in]]/page.tsx"
git commit -m "Offline fase 1: envio automático da fila e faixa de orçamentos aguardando envio"
```

---

### Task 7: Teste de ponta a ponta e entrega (feito pelo controlador, não por subagente)

- [ ] **Step 1: Suíte completa**

Run: `npx tsc --noEmit && npx vitest run && npx next build 2>&1 | tail -6`
Expected: tudo PASS e build sem erro.

- [ ] **Step 2: Roteiro no navegador (produção local, porta 3003, viewport 390x844)**

1. Logado, online: abra `/dashboard`; confirme a cópia local (IndexedDB `toldosprint-offline`/`catalogo`).
2. Modo offline: abra `/dashboard` → deve cair em "Modo offline" com o orçamento completo.
3. Cadastre um cliente novo ("Teste Offline"), monte um orçamento com 2 itens + foto, feche. Confira "Orçamento salvo no aparelho" e o PDF provisório (sem número).
4. Religue a internet, abra `/dashboard`: a faixa deve aparecer e o orçamento subir sozinho; confira no banco (via `/api/orcamentos`, `/api/clientes`, `/api/lancamentos`): orçamento com o número oficial, cliente criado uma vez, parcelas, `itensAdicionais`.
5. Rode o envio de novo: nada duplica.
6. **Limpeza:** remover o orçamento de teste pelo Histórico (devolve estoque e apaga parcelas), apagar o cliente "Teste Offline", e as mensagens do bot geradas (via `DELETE ... WHERE id = ...` com o id exato), como na vez anterior.

- [ ] **Step 3: Entrega**

Não dar push sem o dono pedir. Quando pedir: `git checkout main && git merge --ff-only feat/offline-fase1`, push, esperar o status do Vercel e passar o roteiro de teste no celular (Android e iPhone, modo avião).
