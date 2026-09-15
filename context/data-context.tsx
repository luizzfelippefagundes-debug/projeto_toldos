"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type {
  Cliente,
  EntradaEstoque,
  Material,
  Orcamento,
  OrcamentoItem,
  PedidoRapido,
  ProdutoRapido,
  Servico,
} from "@/lib/types"
import {
  clientesSeed,
  entradasEstoqueSeed,
  materiaisSeed,
  orcamentosSeed,
  pedidosRapidosSeed,
  produtosRapidosSeed,
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
  produtosRapidos: ProdutoRapido[]
  pedidosRapidos: PedidoRapido[]
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
  addProdutoRapido: (dados: Omit<ProdutoRapido, "id">) => ProdutoRapido
  addPedidoRapido: (
    dados: Omit<PedidoRapido, "id" | "numero" | "criadoEm">
  ) => PedidoRapido
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
  const [produtosRapidos, setProdutosRapidos] = useState<ProdutoRapido[]>(
    produtosRapidosSeed
  )
  const [pedidosRapidos, setPedidosRapidos] = useState<PedidoRapido[]>(
    pedidosRapidosSeed
  )
  const [rascunho, setRascunho] = useState<RascunhoOrcamento | null>(null)
  const [hidratado, setHidratado] = useState(false)

  // Contador de número de orçamento em um ref (não em state): fecharOrcamento
  // lê e incrementa isso de forma síncrona, então dois fechamentos disparados
  // em sequência rápida (ex.: duplo clique antes do botão desabilitar) nunca
  // recebem o mesmo número — o que aconteceria se o número fosse derivado do
  // state `orcamentos`, que só reflete a última renderização.
  const proximoNumeroRef = useRef(
    orcamentosSeed.reduce((max, o) => Math.max(max, o.numero), 1000) + 1
  )
  const proximoNumeroPedidoRef = useRef(
    pedidosRapidosSeed.reduce((max, p) => Math.max(max, p.numero), 5000) + 1
  )

  // localStorage só existe no cliente, então sincronizar com ele (ler uma vez
  // após montar e refletir no state) só pode acontecer aqui; é exatamente o
  // caso de "sincronizar com um sistema externo" que a regra abaixo descreve
  // como legítimo, e é o ponto central do design anti-hydration-mismatch
  // explicado no comentário do estado inicial, acima.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMateriais(lerArmazenamento("toldosys.materiais", materiaisSeed))
    setServicos(lerArmazenamento("toldosys.servicos", servicosSeed))
    setClientes(lerArmazenamento("toldosys.clientes", clientesSeed))
    const orcamentosCarregados = lerArmazenamento(
      "toldosys.orcamentos",
      orcamentosSeed
    )
    setOrcamentos(orcamentosCarregados)
    proximoNumeroRef.current =
      orcamentosCarregados.reduce((max, o) => Math.max(max, o.numero), 1000) +
      1
    setEntradasEstoque(
      lerArmazenamento("toldosys.entradasEstoque", entradasEstoqueSeed)
    )
    setProdutosRapidos(
      lerArmazenamento("toldosys.produtosRapidos", produtosRapidosSeed)
    )
    const pedidosRapidosCarregados = lerArmazenamento(
      "toldosys.pedidosRapidos",
      pedidosRapidosSeed
    )
    setPedidosRapidos(pedidosRapidosCarregados)
    proximoNumeroPedidoRef.current =
      pedidosRapidosCarregados.reduce(
        (max, p) => Math.max(max, p.numero),
        5000
      ) + 1
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
  useEffect(() => {
    if (!hidratado) return
    salvarArmazenamento("toldosys.produtosRapidos", produtosRapidos)
  }, [hidratado, produtosRapidos])
  useEffect(() => {
    if (!hidratado) return
    salvarArmazenamento("toldosys.pedidosRapidos", pedidosRapidos)
  }, [hidratado, pedidosRapidos])

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
    const numero = proximoNumeroRef.current
    proximoNumeroRef.current += 1

    const novo: Orcamento = {
      id: gerarId("orc"),
      numero,
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

  const addProdutoRapido: DataContextValue["addProdutoRapido"] = (dados) => {
    const novo: ProdutoRapido = { id: gerarId("prod"), ...dados }
    setProdutosRapidos((atual) => [...atual, novo])
    return novo
  }

  const addPedidoRapido: DataContextValue["addPedidoRapido"] = (dados) => {
    const numero = proximoNumeroPedidoRef.current
    proximoNumeroPedidoRef.current += 1
    const novo: PedidoRapido = {
      id: gerarId("ped"),
      numero,
      criadoEm: new Date().toISOString(),
      ...dados,
    }
    setPedidosRapidos((atual) => [novo, ...atual])
    return novo
  }

  const value = useMemo<DataContextValue>(
    () => ({
      materiais,
      servicos,
      clientes,
      orcamentos,
      entradasEstoque,
      produtosRapidos,
      pedidosRapidos,
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
      addProdutoRapido,
      addPedidoRapido,
    }),
    // fecharOrcamento e duplicarOrcamento leem `materiais`/`orcamentos` por
    // closure (os únicos dois entre as ações que não usam só updates
    // funcionais) — como esses dois states já estão nas deps abaixo, o memo
    // já recalcula sempre que essas closures precisariam ficar atualizadas;
    // adicionar as próprias funções às deps as tornaria "instáveis" (são
    // recriadas a cada render) e faria o memo recalcular sempre, sem ganho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      materiais,
      servicos,
      clientes,
      orcamentos,
      entradasEstoque,
      produtosRapidos,
      pedidosRapidos,
      rascunho,
    ]
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error("useData deve ser usado dentro de DataProvider")
  return ctx
}
