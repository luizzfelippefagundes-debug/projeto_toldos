"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type {
  Cliente,
  EntradaEstoque,
  Material,
  Orcamento,
  OrcamentoItem,
  Servico,
} from "@/lib/types"
import {
  clientesSeed,
  entradasEstoqueSeed,
  materiaisSeed,
  orcamentosSeed,
  servicosSeed,
} from "@/lib/seed-data"
import { lerArmazenamento, salvarArmazenamento } from "@/lib/storage"
import { quantidadeMaterialConsumida } from "@/lib/calculo"

interface RascunhoOrcamento {
  clienteId: string
  item: OrcamentoItem
  ajusteManual: number
}

interface DataContextValue {
  materiais: Material[]
  servicos: Servico[]
  clientes: Cliente[]
  orcamentos: Orcamento[]
  entradasEstoque: EntradaEstoque[]
  rascunho: RascunhoOrcamento | null
  addMaterial: (dados: Omit<Material, "id">) => Material
  updateMaterial: (id: string, dados: Omit<Material, "id">) => void
  addServico: (dados: Omit<Servico, "id">) => Servico
  updateServico: (id: string, dados: Omit<Servico, "id">) => void
  addCliente: (dados: Omit<Cliente, "id">) => Cliente
  addEntradaEstoque: (dados: Omit<EntradaEstoque, "id" | "data">) => void
  fecharOrcamento: (dados: {
    clienteId: string
    item: OrcamentoItem
    ajusteManual: number
    anexoNome: string
  }) => Orcamento
  reabrirOrcamento: (id: string) => void
  duplicarOrcamento: (id: string) => void
  consumirRascunho: () => void
}

const DataContext = createContext<DataContextValue | null>(null)

function gerarId(prefixo: string) {
  return `${prefixo}-${Math.random().toString(36).slice(2, 10)}`
}

export function DataProvider({ children }: { children: ReactNode }) {
  // Estado inicial é SEMPRE o seed — igual no servidor e no primeiro render
  // do cliente — para não causar hydration mismatch. Os dados salvos no
  // localStorage só são lidos depois da montagem, no efeito abaixo.
  const [materiais, setMateriais] = useState<Material[]>(materiaisSeed)
  const [servicos, setServicos] = useState<Servico[]>(servicosSeed)
  const [clientes, setClientes] = useState<Cliente[]>(clientesSeed)
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>(orcamentosSeed)
  const [entradasEstoque, setEntradasEstoque] = useState<EntradaEstoque[]>(
    entradasEstoqueSeed
  )
  const [rascunho, setRascunho] = useState<RascunhoOrcamento | null>(null)
  const [hidratado, setHidratado] = useState(false)

  useEffect(() => {
    setMateriais(lerArmazenamento("toldosys.materiais", materiaisSeed))
    setServicos(lerArmazenamento("toldosys.servicos", servicosSeed))
    setClientes(lerArmazenamento("toldosys.clientes", clientesSeed))
    setOrcamentos(lerArmazenamento("toldosys.orcamentos", orcamentosSeed))
    setEntradasEstoque(
      lerArmazenamento("toldosys.entradasEstoque", entradasEstoqueSeed)
    )
    setHidratado(true)
  }, [])

  useEffect(() => {
    if (!hidratado) return
    salvarArmazenamento("toldosys.materiais", materiais)
  }, [hidratado, materiais])
  useEffect(() => {
    if (!hidratado) return
    salvarArmazenamento("toldosys.servicos", servicos)
  }, [hidratado, servicos])
  useEffect(() => {
    if (!hidratado) return
    salvarArmazenamento("toldosys.clientes", clientes)
  }, [hidratado, clientes])
  useEffect(() => {
    if (!hidratado) return
    salvarArmazenamento("toldosys.orcamentos", orcamentos)
  }, [hidratado, orcamentos])
  useEffect(() => {
    if (!hidratado) return
    salvarArmazenamento("toldosys.entradasEstoque", entradasEstoque)
  }, [hidratado, entradasEstoque])

  const addMaterial: DataContextValue["addMaterial"] = (dados) => {
    const novo: Material = { id: gerarId("mat"), ...dados }
    setMateriais((atual) => [...atual, novo])
    return novo
  }

  const updateMaterial: DataContextValue["updateMaterial"] = (id, dados) => {
    setMateriais((atual) =>
      atual.map((m) => (m.id === id ? { id, ...dados } : m))
    )
  }

  const addServico: DataContextValue["addServico"] = (dados) => {
    const novo: Servico = { id: gerarId("srv"), ...dados }
    setServicos((atual) => [...atual, novo])
    return novo
  }

  const updateServico: DataContextValue["updateServico"] = (id, dados) => {
    setServicos((atual) =>
      atual.map((s) => (s.id === id ? { id, ...dados } : s))
    )
  }

  const addCliente: DataContextValue["addCliente"] = (dados) => {
    const novo: Cliente = { id: gerarId("cli"), ...dados }
    setClientes((atual) => [...atual, novo])
    return novo
  }

  const addEntradaEstoque: DataContextValue["addEntradaEstoque"] = (
    dados
  ) => {
    const nova: EntradaEstoque = {
      id: gerarId("ent"),
      data: new Date().toISOString(),
      ...dados,
    }
    setEntradasEstoque((atual) => [nova, ...atual])
    setMateriais((atual) =>
      atual.map((m) =>
        m.id === dados.materialId
          ? { ...m, quantidadeEstoque: m.quantidadeEstoque + dados.quantidade }
          : m
      )
    )
  }

  const fecharOrcamento: DataContextValue["fecharOrcamento"] = (dados) => {
    const material = materiais.find((m) => m.id === dados.item.materialId)
    const proximoNumero =
      orcamentos.reduce((max, o) => Math.max(max, o.numero), 1000) + 1

    const novo: Orcamento = {
      id: gerarId("orc"),
      numero: proximoNumero,
      clienteId: dados.clienteId,
      item: dados.item,
      ajusteManual: dados.ajusteManual,
      anexoNome: dados.anexoNome,
      status: "fechado",
      criadoEm: new Date().toISOString(),
      fechadoEm: new Date().toISOString(),
    }

    setOrcamentos((atual) => [novo, ...atual])

    if (material) {
      const consumido = quantidadeMaterialConsumida(dados.item, material)
      setMateriais((atual) =>
        atual.map((m) =>
          m.id === material.id
            ? {
                ...m,
                quantidadeEstoque: Math.max(0, m.quantidadeEstoque - consumido),
              }
            : m
        )
      )
    }

    return novo
  }

  const reabrirOrcamento: DataContextValue["reabrirOrcamento"] = (id) => {
    setOrcamentos((atual) =>
      atual.map((o) =>
        o.id === id ? { ...o, status: "aberto", fechadoEm: null } : o
      )
    )
  }

  const duplicarOrcamento: DataContextValue["duplicarOrcamento"] = (id) => {
    const original = orcamentos.find((o) => o.id === id)
    if (!original) return
    setRascunho({
      clienteId: original.clienteId,
      item: original.item,
      ajusteManual: original.ajusteManual,
    })
  }

  const consumirRascunho = () => setRascunho(null)

  const value = useMemo<DataContextValue>(
    () => ({
      materiais,
      servicos,
      clientes,
      orcamentos,
      entradasEstoque,
      rascunho,
      addMaterial,
      updateMaterial,
      addServico,
      updateServico,
      addCliente,
      addEntradaEstoque,
      fecharOrcamento,
      reabrirOrcamento,
      duplicarOrcamento,
      consumirRascunho,
    }),
    [materiais, servicos, clientes, orcamentos, entradasEstoque, rascunho]
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error("useData deve ser usado dentro de DataProvider")
  return ctx
}
