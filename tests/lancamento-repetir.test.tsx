import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DataProvider, useData } from "@/context/data-context"
import { LancamentoFormDialog } from "@/components/financeiro/lancamento-form-dialog"
import { LancamentoDetalheDialog } from "@/components/financeiro/lancamento-detalhe-dialog"
import { act } from "@testing-library/react"
import {
  clientesSeed,
  entradasEstoqueSeed,
  materiaisSeed,
  mensagensBotSeed,
  pedidosRapidosSeed,
  produtosRapidosSeed,
  servicosSeed,
} from "@/lib/seed-data"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

type Registro = { id: string } & Record<string, unknown>

function bancoFalso() {
  const t = {
    materiais: structuredClone(materiaisSeed),
    servicos: structuredClone(servicosSeed),
    clientes: structuredClone(clientesSeed),
    orcamentos: [],
    "entradas-estoque": structuredClone(entradasEstoqueSeed),
    "produtos-rapidos": structuredClone(produtosRapidosSeed),
    "pedidos-rapidos": structuredClone(pedidosRapidosSeed),
    lancamentos: [] as Registro[],
    "mensagens-bot": structuredClone(mensagensBotSeed),
  } as unknown as Record<string, Registro[]>
  return async (url: string, init?: RequestInit) => {
    const tabela = url.split("/")[2]
    const metodo = init?.method ?? "GET"
    if (metodo === "GET") return Response.json(structuredClone(t[tabela]))
    if (metodo === "POST") t[tabela].push(JSON.parse(init!.body as string))
    return Response.json({ ok: true })
  }
}

let ctx: ReturnType<typeof useData> | null = null
function Sonda() {
  const dados = useData()
  // Guarda o contexto fora da árvore pra o teste poder ler/agir; só em teste.
  // eslint-disable-next-line react-hooks/globals
  ctx = dados
  return null
}

describe("Novo lançamento repetido por meses", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(bancoFalso()))
    // jsdom não tem PointerEvent, que o componente Switch usa ao clicar.
    if (!("PointerEvent" in window)) vi.stubGlobal("PointerEvent", MouseEvent)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  async function preencher(meses: string, pessoal: boolean) {
    render(
      <DataProvider>
        <Sonda />
        <LancamentoFormDialog open onOpenChange={() => {}} trigger={<span hidden />} />
      </DataProvider>
    )
    // espera a carga inicial, senão ela sobrescreve o que for salvo antes
    await waitFor(() => expect(ctx!.materiais.length).toBeGreaterThan(0))
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "STRADA" } })
    fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "FINANCIAMENTO" } })
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "1598.18" } })
    fireEvent.change(screen.getByLabelText("Vencimento"), { target: { value: "2026-10-28" } })
    fireEvent.change(screen.getByLabelText("Repetir por quantos meses?"), { target: { value: meses } })
    if (pessoal) {
      const chave = screen.getByRole("switch")
      fireEvent.click(chave)
    }
  }

  it("cria uma parcela por mês, numeradas e com as datas certas", async () => {
    await preencher("15", false)
    expect(screen.getByText(/Cria 15 lançamentos/)).toBeTruthy()
    expect(screen.getByText(/até 28\/12\/2027/)).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(ctx!.lancamentos).toHaveLength(15))

    const nomes = ctx!.lancamentos.map((l) => l.descricao)
    expect(nomes).toContain("STRADA (1/15)")
    expect(nomes).toContain("STRADA (15/15)")
    const datas = ctx!.lancamentos.map((l) => new Date(l.vencimento).toLocaleDateString("sv-SE")).sort()
    expect(datas[0]).toBe("2026-10-28")
    expect(datas[14]).toBe("2027-12-28")
    expect(ctx!.lancamentos.every((l) => l.valor === 1598.18 && l.status === "pendente")).toBe(true)
  })

  it("com 1 mês cria um lançamento só, sem numerar", async () => {
    await preencher("1", false)
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(ctx!.lancamentos).toHaveLength(1))
    expect(ctx!.lancamentos[0].descricao).toBe("STRADA")
  })

  it("marca as parcelas como pessoais quando a chave está ligada", async () => {
    await preencher("3", true)
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(ctx!.lancamentos).toHaveLength(3))
    expect(ctx!.lancamentos.every((l) => l.pessoal === true)).toBe(true)
  })

  it("não deixa salvar com quantidade de meses inválida", async () => {
    await preencher("0", false)
    expect(screen.getByRole("button", { name: "Salvar" }).hasAttribute("disabled")).toBe(true)
    fireEvent.change(screen.getByLabelText("Repetir por quantos meses?"), { target: { value: "61" } })
    expect(screen.getByRole("button", { name: "Salvar" }).hasAttribute("disabled")).toBe(true)
  })
})

describe("Marcar série como pessoal", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn(bancoFalso())))
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("marca todas as despesas da mesma categoria de uma vez", async () => {
    render(
      <DataProvider>
        <Sonda />
      </DataProvider>
    )
    await waitFor(() => expect(ctx!.materiais.length).toBeGreaterThan(0))
    const base = {
      tipo: "despesa" as const, categoria: "FINANCIAMENTO", valor: 100, status: "pendente" as const,
      origem: "manual" as const, origemId: null, vencimento: "2026-11-28T03:00:00.000Z",
    }
    act(() => {
      ctx!.addLancamento({ ...base, descricao: "STRADA (1/3)" })
      ctx!.addLancamento({ ...base, descricao: "STRADA (2/3)" })
      ctx!.addLancamento({ ...base, descricao: "STRADA (3/3)" })
      ctx!.addLancamento({ ...base, categoria: "OUTRA", descricao: "INTERNET" })
    })
    await waitFor(() => expect(ctx!.lancamentos).toHaveLength(4))
    const alvo = ctx!.lancamentos.find((l) => l.descricao === "STRADA (1/3)")!

    cleanup()
    function Abrir() {
      const dados = useData()
      // eslint-disable-next-line react-hooks/globals
      ctx = dados
      return <LancamentoDetalheDialog lancamento={dados.lancamentos.find((l) => l.id === alvo.id) ?? null} onOpenChange={() => {}} hoje={new Date()} />
    }
    render(
      <DataProvider>
        <Abrir />
      </DataProvider>
    )
    // a nova árvore recarrega do "banco": as 4 despesas voltam por GET
    await waitFor(() => expect(ctx!.lancamentos.length).toBe(4))
    fireEvent.click(await screen.findByRole("button", { name: /Marcar todas de .FINANCIAMENTO. \(3\)/ }))

    await waitFor(() => {
      const pessoais = ctx!.lancamentos.filter((l) => l.pessoal).map((l) => l.descricao).sort()
      expect(pessoais).toEqual(["STRADA (1/3)", "STRADA (2/3)", "STRADA (3/3)"])
    })
    expect(ctx!.lancamentos.find((l) => l.descricao === "INTERNET")?.pessoal).toBeFalsy()
  })
})
