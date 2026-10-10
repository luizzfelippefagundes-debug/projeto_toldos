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
import { toast } from "sonner"
import type {
  Cliente,
  EntradaEstoque,
  LancamentoFinanceiro,
  Material,
  MensagemBot,
  Orcamento,
  OrcamentoItem,
  PedidoRapido,
  ProdutoRapido,
  Servico,
  StatusLancamento,
  StatusPedidoRapido,
} from "@/lib/types"
import { acabamentosSeed, equipamentosAcessoSeed } from "@/lib/seed-data"
import { calcularOrcamentoCompleto, quantidadeMaterialConsumida } from "@/lib/calculo"
import { formatarMoeda } from "@/lib/format"
import { criarPrazoEntregaPedido } from "@/lib/pedidos-rapidos"

const UM_DIA_MS = 24 * 60 * 60 * 1000
const SETE_DIAS_MS = 7 * UM_DIA_MS

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
  lancamentos: LancamentoFinanceiro[]
  mensagensBot: MensagemBot[]
  rascunho: RascunhoOrcamento | null
  addMaterial: (dados: Omit<Material, "id">) => Material
  updateMaterial: (id: string, dados: Omit<Material, "id">) => void
  addServico: (dados: Omit<Servico, "id">) => Servico
  updateServico: (id: string, dados: Omit<Servico, "id">) => void
  addCliente: (dados: Omit<Cliente, "id">) => Cliente
  updateCliente: (id: string, dados: Omit<Cliente, "id">) => void
  removeCliente: (id: string) => void
  addEntradaEstoque: (dados: Omit<EntradaEstoque, "id" | "data">) => void
  fecharOrcamento: (dados: {
    clienteId: string
    item: OrcamentoItem
    ajusteManual: number
    anexoNome: string | null
    anexoUrl?: string
    validadeDias?: number
  }) => Orcamento
  updateOrcamentoAberto: (
    id: string,
    dados: {
      clienteId: string
      item: OrcamentoItem
      ajusteManual: number
      validadeDias: number
      anexoNome?: string | null
      anexoUrl?: string
    }
  ) => void
  reabrirOrcamento: (id: string) => boolean
  duplicarOrcamento: (id: string) => void
  consumirRascunho: () => void
  addProdutoRapido: (dados: Omit<ProdutoRapido, "id">) => ProdutoRapido
  addPedidoRapido: (
    dados: Omit<PedidoRapido, "id" | "numero" | "criadoEm">
  ) => PedidoRapido
  moverPedidoRapido: (id: string, status: StatusPedidoRapido) => void
  addLancamento: (
    dados: Omit<LancamentoFinanceiro, "id" | "criadoEm">
  ) => LancamentoFinanceiro
  marcarLancamentoStatus: (id: string, status: StatusLancamento) => void
  addMensagemBot: (dados: Omit<MensagemBot, "id" | "criadoEm">) => void
  totalAlertas: number
}

const DataContext = createContext<DataContextValue | null>(null)

function gerarId(prefixo: string) {
  return `${prefixo}-${Math.random().toString(36).slice(2, 10)}`
}

// Dispara chamada à API em background — erros mostram toast mas não revertem
// o estado otimista, pois o dado já está na memória para o usuário.
function apiPost(url: string, body: unknown) {
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() =>
    toast.error("Erro ao salvar no banco. Recarregue se o problema persistir.")
  )
}

function apiPut(url: string, body: unknown) {
  fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() =>
    toast.error("Erro ao salvar no banco. Recarregue se o problema persistir.")
  )
}

function apiDelete(url: string) {
  fetch(url, { method: "DELETE" }).catch(() =>
    toast.error("Erro ao salvar no banco. Recarregue se o problema persistir.")
  )
}

// Mensagens automáticas por status do pedido — a base do bot de atendimento
// (ver context/papel-ativo-context.tsx para o padrão de papéis, análogo).
// Sem WhatsApp conectado ainda, essas mensagens só ficam registradas na
// Central do Bot (app/bot/page.tsx); quando o canal entrar, é só trocar o
// destino de "salvar" pra "enviar".
const mensagemStatusPedido: Partial<Record<StatusPedidoRapido, string>> = {
  aprovado: "Seu pedido #{numero} foi aprovado e já entrou pra produção!",
  arte: "Estamos finalizando a arte do seu pedido #{numero}.",
  impressao: "Seu pedido #{numero} está sendo impresso.",
  acabamento: "Seu pedido #{numero} está no acabamento, já é a última etapa!",
  pronto: "Seu pedido #{numero} ficou pronto! Já pode vir buscar.",
  entregue: "Seu pedido #{numero} foi entregue. Obrigado pela confiança!",
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [materiais, setMateriais] = useState<Material[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [entradasEstoque, setEntradasEstoque] = useState<EntradaEstoque[]>([])
  const [produtosRapidos, setProdutosRapidos] = useState<ProdutoRapido[]>([])
  const [pedidosRapidos, setPedidosRapidos] = useState<PedidoRapido[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([])
  const [mensagensBot, setMensagensBot] = useState<MensagemBot[]>([])
  const [rascunho, setRascunho] = useState<RascunhoOrcamento | null>(null)

  const proximoNumeroRef = useRef(1001)
  const proximoNumeroPedidoRef = useRef(5001)

  // Busca dados do banco na montagem do componente
  useEffect(() => {
    async function carregar() {
      try {
        const [
          resMateriais,
          resServicos,
          resClientes,
          resOrcamentos,
          resEntradas,
          resProdutos,
          resPedidos,
          resLancamentos,
          resMensagens,
        ] = await Promise.all([
          fetch("/api/materiais"),
          fetch("/api/servicos"),
          fetch("/api/clientes"),
          fetch("/api/orcamentos"),
          fetch("/api/entradas-estoque"),
          fetch("/api/produtos-rapidos"),
          fetch("/api/pedidos-rapidos"),
          fetch("/api/lancamentos"),
          fetch("/api/mensagens-bot"),
        ])

        const [
          mat,
          srv,
          cli,
          orc,
          ent,
          prod,
          ped,
          lan,
          msg,
        ] = await Promise.all([
          resMateriais.json() as Promise<Material[]>,
          resServicos.json() as Promise<Servico[]>,
          resClientes.json() as Promise<Cliente[]>,
          resOrcamentos.json() as Promise<Orcamento[]>,
          resEntradas.json() as Promise<EntradaEstoque[]>,
          resProdutos.json() as Promise<ProdutoRapido[]>,
          resPedidos.json() as Promise<PedidoRapido[]>,
          resLancamentos.json() as Promise<LancamentoFinanceiro[]>,
          resMensagens.json() as Promise<MensagemBot[]>,
        ])

        setMateriais(mat)
        setServicos(srv)
        setClientes(cli)
        setOrcamentos(orc)
        proximoNumeroRef.current =
          orc.reduce((max, o) => Math.max(max, o.numero), 1000) + 1
        setEntradasEstoque(ent)
        setProdutosRapidos(prod)
        setPedidosRapidos(ped)
        proximoNumeroPedidoRef.current =
          ped.reduce((max, p) => Math.max(max, p.numero), 5000) + 1
        setLancamentos(lan)
        setMensagensBot(msg)
      } catch {
        toast.error("Não foi possível carregar os dados do servidor.")
      }
    }
    carregar()
  }, [])

  const addMaterial: DataContextValue["addMaterial"] = (dados) => {
    const novo: Material = { id: gerarId("mat"), ...dados }
    setMateriais((atual) => [...atual, novo])
    apiPost("/api/materiais", novo)
    return novo
  }

  const updateMaterial: DataContextValue["updateMaterial"] = (id, dados) => {
    const atualizado = { id, ...dados }
    setMateriais((atual) =>
      atual.map((m) => (m.id === id ? atualizado : m))
    )
    apiPut(`/api/materiais/${id}`, dados)
  }

  const addServico: DataContextValue["addServico"] = (dados) => {
    const novo: Servico = { id: gerarId("srv"), ...dados }
    setServicos((atual) => [...atual, novo])
    apiPost("/api/servicos", novo)
    return novo
  }

  const updateServico: DataContextValue["updateServico"] = (id, dados) => {
    setServicos((atual) =>
      atual.map((s) => (s.id === id ? { id, ...dados } : s))
    )
    apiPut(`/api/servicos/${id}`, dados)
  }

  const addCliente: DataContextValue["addCliente"] = (dados) => {
    const novo: Cliente = { id: gerarId("cli"), ...dados }
    setClientes((atual) => [...atual, novo])
    apiPost("/api/clientes", novo)
    return novo
  }

  const updateCliente: DataContextValue["updateCliente"] = (id, dados) => {
    setClientes((atual) => atual.map((c) => (c.id === id ? { id, ...dados } : c)))
    apiPut(`/api/clientes/${id}`, dados)
  }

  const removeCliente: DataContextValue["removeCliente"] = (id) => {
    setClientes((atual) => atual.filter((c) => c.id !== id))
    apiDelete(`/api/clientes/${id}`)
  }

  const addEntradaEstoque: DataContextValue["addEntradaEstoque"] = (dados) => {
    const nova: EntradaEstoque = {
      id: gerarId("ent"),
      data: new Date().toISOString(),
      ...dados,
    }
    setEntradasEstoque((atual) => [nova, ...atual])
    apiPost("/api/entradas-estoque", nova)

    setMateriais((atual) =>
      atual.map((m) => {
        if (m.id !== dados.materialId) return m
        const atualizado = {
          ...m,
          quantidadeEstoque: m.quantidadeEstoque + dados.quantidade,
        }
        apiPut(`/api/materiais/${m.id}`, { ...atualizado, id: undefined })
        return atualizado
      })
    )
  }

  const fecharOrcamento: DataContextValue["fecharOrcamento"] = (dados) => {
    const material = materiais.find((m) => m.id === dados.item.materialId)
    const servico = servicos.find((s) => s.id === dados.item.servicoId)
    const cliente = clientes.find((c) => c.id === dados.clienteId)
    const numero = proximoNumeroRef.current
    proximoNumeroRef.current += 1
    const quantidadeConsumidaSolicitada = material
      ? quantidadeMaterialConsumida(dados.item, material)
      : 0
    const quantidadeMaterialDebitada = material
      ? Math.min(material.quantidadeEstoque, quantidadeConsumidaSolicitada)
      : undefined
    const resultado =
      material && servico
        ? calcularOrcamentoCompleto(
            dados.item,
            material,
            servico,
            dados.ajusteManual,
            acabamentosSeed,
            equipamentosAcessoSeed
          )
        : null

    const novo: Orcamento = {
      id: gerarId("orc"),
      numero,
      clienteId: dados.clienteId,
      item: dados.item,
      quantidadeMaterialDebitada,
      materialFechado: material
        ? {
            id: material.id,
            nome: material.nome,
            unidade: material.unidade,
            quantidade: quantidadeConsumidaSolicitada,
            custo: quantidadeConsumidaSolicitada * material.precoUnitario,
          }
        : undefined,
      servicoFechado: servico
        ? { nome: servico.nome, ferramentas: servico.ferramentas }
        : undefined,
      totalFechado: resultado?.total,
      ajusteManual: dados.ajusteManual,
      anexoNome: dados.anexoNome,
      anexoUrl: dados.anexoUrl,
      status: "fechado",
      criadoEm: new Date().toISOString(),
      fechadoEm: new Date().toISOString(),
      validadeDias: dados.validadeDias ?? 7,
    }

    setOrcamentos((atual) => [novo, ...atual])
    apiPost("/api/orcamentos", novo)

    if (material) {
      setMateriais((atual) =>
        atual.map((m) => {
          if (m.id !== material.id) return m
          const atualizado = {
            ...m,
            quantidadeEstoque: Math.max(
              0,
              m.quantidadeEstoque - quantidadeConsumidaSolicitada
            ),
          }
          apiPut(`/api/materiais/${m.id}`, { ...atualizado, id: undefined })
          return atualizado
        })
      )
    }

    if (resultado) {
      const lancamento: LancamentoFinanceiro = {
        id: gerarId("lan"),
        descricao: `Orçamento #${numero} — ${cliente?.nome ?? "Cliente"}`,
        tipo: "receita",
        categoria: "Orçamento",
        valor: resultado.total,
        vencimento: new Date(
          Date.now() + (dados.validadeDias ?? 7) * UM_DIA_MS
        ).toISOString(),
        status: "pendente",
        origem: "orcamento",
        origemId: novo.id,
        criadoEm: new Date().toISOString(),
        clienteId: dados.clienteId,
      }
      setLancamentos((atual) => [lancamento, ...atual])
      apiPost("/api/lancamentos", lancamento)

      if (cliente) {
        registrarMensagemBot({
          clienteId: cliente.id,
          clienteNome: cliente.nome,
          telefone: cliente.telefone,
          texto: `Olá! Seu orçamento #${numero} foi fechado no valor de ${formatarMoeda(resultado.total)}, válido por ${dados.validadeDias ?? 7} dias. Qualquer dúvida é só chamar por aqui.`,
          origem: "automatica",
          autor: "bot",
        })
      }
    }

    return novo
  }

  const updateOrcamentoAberto: DataContextValue["updateOrcamentoAberto"] = (id, dados) => {
    setOrcamentos((atual) =>
      atual.map((o) => {
        if (o.id !== id || o.status !== "aberto") return o
        const atualizado: typeof o = {
          ...o,
          clienteId: dados.clienteId,
          item: dados.item,
          ajusteManual: dados.ajusteManual,
          validadeDias: dados.validadeDias,
          anexoNome: dados.anexoNome ?? o.anexoNome,
          anexoUrl: dados.anexoUrl ?? o.anexoUrl,
        }
        apiPut(`/api/orcamentos/${id}`, atualizado)
        return atualizado
      })
    )
  }

  const reabrirOrcamento: DataContextValue["reabrirOrcamento"] = (id) => {
    const orcamento = orcamentos.find((o) => o.id === id)
    if (!orcamento || orcamento.status === "aberto") return false

    if (orcamento.status === "fechado") {
      const lancamentosRelacionados = lancamentos.filter(
        (l) => l.origem === "orcamento" && l.origemId === id
      )
      if (lancamentosRelacionados.some((l) => l.status === "pago")) return false

      const material = materiais.find(
        (m) => m.id === orcamento.item.materialId
      )
      if (material) {
        const consumido =
          orcamento.quantidadeMaterialDebitada ??
          quantidadeMaterialConsumida(orcamento.item, material)
        setMateriais((atual) =>
          atual.map((m) => {
            if (m.id !== material.id) return m
            const atualizado = { ...m, quantidadeEstoque: m.quantidadeEstoque + consumido }
            apiPut(`/api/materiais/${m.id}`, { ...atualizado, id: undefined })
            return atualizado
          })
        )
      }

      lancamentosRelacionados.forEach((l) => apiDelete(`/api/lancamentos/${l.id}`))
      setLancamentos((atual) =>
        atual.filter(
          (l) => !(l.origem === "orcamento" && l.origemId === id)
        )
      )
    }

    const reaberto = { ...orcamento, status: "aberto" as const, fechadoEm: null }
    setOrcamentos((atual) =>
      atual.map((o) => (o.id === id ? reaberto : o))
    )
    apiPut(`/api/orcamentos/${id}`, reaberto)
    return true
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
    apiPost("/api/produtos-rapidos", novo)
    return novo
  }

  function registrarMensagemBot(dados: Omit<MensagemBot, "id" | "criadoEm">) {
    const nova: MensagemBot = {
      id: gerarId("msg"),
      criadoEm: new Date().toISOString(),
      ...dados,
    }
    setMensagensBot((atual) => [nova, ...atual])
    apiPost("/api/mensagens-bot", nova)
  }

  function adicionarReceitaPedido(pedido: PedidoRapido) {
    const lancamento: LancamentoFinanceiro = {
      id: gerarId("lan"),
      descricao: `Pedido #${pedido.numero} — ${pedido.clienteNome || "Sem cliente"}`,
      tipo: "receita",
      categoria: "Gráfica Rápida",
      valor: pedido.total,
      vencimento: new Date(Date.now() + SETE_DIAS_MS).toISOString(),
      status: "pendente",
      origem: "pedido-rapido",
      origemId: pedido.id,
      criadoEm: new Date().toISOString(),
    }
    setLancamentos((atual) => [lancamento, ...atual])
    apiPost("/api/lancamentos", lancamento)
  }

  const addPedidoRapido: DataContextValue["addPedidoRapido"] = (dados) => {
    const numero = proximoNumeroPedidoRef.current
    proximoNumeroPedidoRef.current += 1
    const criadoEm = new Date().toISOString()
    const produto = produtosRapidos.find((p) => p.id === dados.produtoId)
    const novo: PedidoRapido = {
      id: gerarId("ped"),
      numero,
      criadoEm,
      produtoNome: produto?.nome,
      varianteNome: produto?.variantes.find((v) => v.id === dados.varianteId)
        ?.nome,
      prazoEntregaEm:
        dados.prazoEntregaEm ??
        (produto
          ? criarPrazoEntregaPedido(criadoEm, produto.prazoDias)
          : undefined),
      ...dados,
    }
    setPedidosRapidos((atual) => [novo, ...atual])
    apiPost("/api/pedidos-rapidos", novo)
    if (novo.status !== "aguardando") {
      adicionarReceitaPedido(novo)
    }
    const mensagem = mensagemStatusPedido[novo.status]
    if (mensagem && novo.clienteTelefone) {
      registrarMensagemBot({
        clienteNome: novo.clienteNome || "Cliente",
        telefone: novo.clienteTelefone,
        texto: mensagem.replace("{numero}", String(novo.numero)),
        origem: "automatica",
        autor: "bot",
      })
    }
    return novo
  }

  const moverPedidoRapido: DataContextValue["moverPedidoRapido"] = (
    id,
    status
  ) => {
    const pedido = pedidosRapidos.find((p) => p.id === id)
    const atualizado = pedido ? { ...pedido, status } : null
    setPedidosRapidos((atual) =>
      atual.map((p) => (p.id === id ? { ...p, status } : p))
    )
    if (atualizado) apiPut(`/api/pedidos-rapidos/${id}`, atualizado)
    if (pedido && pedido.status === "aguardando" && status !== "aguardando") {
      adicionarReceitaPedido(pedido)
    }
    const mensagem = pedido && mensagemStatusPedido[status]
    if (pedido && mensagem && status !== pedido.status && pedido.clienteTelefone) {
      registrarMensagemBot({
        clienteNome: pedido.clienteNome || "Cliente",
        telefone: pedido.clienteTelefone,
        texto: mensagem.replace("{numero}", String(pedido.numero)),
        origem: "automatica",
        autor: "bot",
      })
    }
  }

  const addLancamento: DataContextValue["addLancamento"] = (dados) => {
    const novo: LancamentoFinanceiro = {
      id: gerarId("lan"),
      criadoEm: new Date().toISOString(),
      ...(dados.status === "pago" && !dados.pagoEm
        ? { pagoEm: new Date().toISOString() }
        : {}),
      ...dados,
    }
    setLancamentos((atual) => [novo, ...atual])
    apiPost("/api/lancamentos", novo)
    return novo
  }

  const marcarLancamentoStatus: DataContextValue["marcarLancamentoStatus"] = (
    id,
    status
  ) => {
    const pagoEm = status === "pago" ? new Date().toISOString() : undefined
    setLancamentos((atual) =>
      atual.map((l) => {
        if (l.id !== id) return l
        const atualizado = {
          ...l,
          status,
          ...(pagoEm ? { pagoEm } : { pagoEm: undefined }),
        }
        apiPut(`/api/lancamentos/${id}`, atualizado)
        return atualizado
      })
    )
  }

  const addMensagemBot: DataContextValue["addMensagemBot"] = (dados) => {
    registrarMensagemBot(dados)
  }

  const totalAlertas = useMemo(() => {
    const agora = new Date()
    const tresDs = 3 * UM_DIA_MS
    const estoqueBaixo = materiais.filter(m => m.quantidadeEstoque < m.estoqueMinimo).length
    const pedidosAtrasados = pedidosRapidos.filter(p =>
      p.status !== "entregue" && p.prazoEntregaEm && new Date(p.prazoEntregaEm) < agora
    ).length
    const boletosVencendo = lancamentos.filter(l =>
      l.status === "pendente" && l.formaPagamento === "boleto" &&
      new Date(l.vencimento).getTime() - agora.getTime() <= tresDs &&
      new Date(l.vencimento) >= agora
    ).length
    const lancamentosVencidos = lancamentos.filter(l =>
      l.status === "pendente" && new Date(l.vencimento) < agora
    ).length
    const orcamentosVencendo = orcamentos.filter(o => {
      if (o.status !== "aberto" || !o.validadeDias) return false
      const criado = new Date(o.criadoEm)
      const validoAte = new Date(criado.getTime() + o.validadeDias * UM_DIA_MS)
      return validoAte.getTime() - agora.getTime() <= tresDs && validoAte >= agora
    }).length
    return estoqueBaixo + pedidosAtrasados + boletosVencendo + lancamentosVencidos + orcamentosVencendo
  }, [materiais, pedidosRapidos, lancamentos, orcamentos])

  const value = useMemo<DataContextValue>(
    () => ({
      materiais,
      servicos,
      clientes,
      orcamentos,
      entradasEstoque,
      produtosRapidos,
      pedidosRapidos,
      lancamentos,
      mensagensBot,
      rascunho,
      addMaterial,
      updateMaterial,
      addServico,
      updateServico,
      addCliente,
      updateCliente,
      removeCliente,
      addEntradaEstoque,
      fecharOrcamento,
      updateOrcamentoAberto,
      reabrirOrcamento,
      duplicarOrcamento,
      consumirRascunho,
      addProdutoRapido,
      addPedidoRapido,
      moverPedidoRapido,
      addLancamento,
      marcarLancamentoStatus,
      addMensagemBot,
      totalAlertas,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      materiais,
      servicos,
      clientes,
      orcamentos,
      entradasEstoque,
      produtosRapidos,
      pedidosRapidos,
      lancamentos,
      mensagensBot,
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
