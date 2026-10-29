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
