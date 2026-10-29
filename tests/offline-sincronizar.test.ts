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
