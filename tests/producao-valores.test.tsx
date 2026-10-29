import { render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DataProvider } from "@/context/data-context"
import { PapelAtivoProvider } from "@/context/papel-ativo-context"
import ProducaoPage from "@/app/(app)/producao/page"
import {
  clientesSeed,
  entradasEstoqueSeed,
  lancamentosFinanceirosSeed,
  materiaisSeed,
  mensagensBotSeed,
  pedidosRapidosSeed,
  produtosRapidosSeed,
  servicosSeed,
} from "@/lib/seed-data"
import { formatarMoeda } from "@/lib/format"
import type { Papel } from "@/lib/types"

type Registro = { id: string } & Record<string, unknown>

function bancoFalso() {
  const tabelas = {
    materiais: structuredClone(materiaisSeed),
    servicos: structuredClone(servicosSeed),
    clientes: structuredClone(clientesSeed),
    orcamentos: [],
    "entradas-estoque": structuredClone(entradasEstoqueSeed),
    "produtos-rapidos": structuredClone(produtosRapidosSeed),
    "pedidos-rapidos": structuredClone(pedidosRapidosSeed),
    lancamentos: structuredClone(lancamentosFinanceirosSeed),
    "mensagens-bot": structuredClone(mensagensBotSeed),
  } as unknown as Record<string, Registro[]>
  return async (url: string) => {
    const [, , tabela] = url.split("/")
    return Response.json(structuredClone(tabelas[tabela] ?? []))
  }
}

async function abrirProducao(papel: Papel) {
  const tela = render(
    <PapelAtivoProvider papelInicial={papel}>
      <DataProvider>
        <ProducaoPage />
      </DataProvider>
    </PapelAtivoProvider>
  )
  // espera os cartões carregarem (o pedido #5001 do seed aparece na lista)
  await waitFor(() => expect(tela.container.textContent).toContain("#5001"))
  return tela.container.textContent ?? ""
}

describe("Produção: valores em reais", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(bancoFalso()))
  })
  afterEach(() => vi.unstubAllGlobals())

  it("o dono vê o valor de cada pedido", async () => {
    const texto = await abrirProducao("dono")
    const pedido = pedidosRapidosSeed.find((p) => p.numero === 5001)!
    expect(texto).toContain(formatarMoeda(pedido.total))
  })

  it("o funcionário (Produção e TV) vê os pedidos, mas nenhum valor em reais", async () => {
    const texto = await abrirProducao("operador")
    expect(texto).toContain("#5001")
    for (const pedido of pedidosRapidosSeed) {
      expect(texto).not.toContain(formatarMoeda(pedido.total))
    }
    expect(texto).not.toMatch(/R\$\s?\d/)
  })
})
