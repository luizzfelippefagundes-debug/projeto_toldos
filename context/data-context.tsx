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
  RetornoOrcamento,
  PedidoRapido,
  ProdutoRapido,
  Servico,
  StatusLancamento,
  StatusPedidoRapido,
} from "@/lib/types"
import { acabamentosSeed, equipamentosAcessoSeed } from "@/lib/seed-data"
import { gerarParcelasOrcamento } from "@/lib/parcelas"
import { calcularOrcamentoCompleto } from "@/lib/calculo"
import {
  deltasDeEstoque,
  devolucoesDoOrcamento,
  itemComBaixas,
  itensDoOrcamento,
  planejarBaixas,
} from "@/lib/orcamento-itens"
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
  // Edita um orçamento aberto ou fechado. Em fechado, refaz a baixa de
  // estoque e atualiza o lançamento financeiro. Com `fechar`, um orçamento
  // aberto (ex.: reaberto) volta a ser fechado mantendo o número. Devolve
  // false se não puder editar (cancelado, ou já tem pagamento registrado).
  updateOrcamento: (
    id: string,
    dados: {
      clienteId: string
      item: OrcamentoItem
      ajusteManual: number
      validadeDias: number
      anexoNome?: string | null
      anexoUrl?: string
    },
    opcoes?: { fechar?: boolean }
  ) => boolean
  // Etapa/lembrete do quadro Retornos. Não mexe em estoque nem financeiro.
  atualizarRetorno: (
    id: string,
    retorno: Omit<RetornoOrcamento, "atualizadoEm">
  ) => void
  reabrirOrcamento: (id: string) => boolean
  removeOrcamento: (id: string) => void
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
  updateLancamento: (id: string, dados: Omit<LancamentoFinanceiro, "id" | "criadoEm">) => void
  removeLancamento: (id: string) => void
  marcarLancamentoStatus: (id: string, status: StatusLancamento) => void
  addMensagemBot: (dados: Omit<MensagemBot, "id" | "criadoEm">) => void
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

  // Aplica uma variação de estoque por material (positiva devolve, negativa baixa).
  function ajustarEstoque(deltas: Map<string, number>) {
    if ([...deltas.values()].every((d) => d === 0)) return
    setMateriais((atual) =>
      atual.map((m) => {
        const delta = deltas.get(m.id) ?? 0
        if (delta === 0) return m
        const atualizado = {
          ...m,
          quantidadeEstoque: Math.max(0, m.quantidadeEstoque + delta),
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
    const baixas = planejarBaixas(itensDoOrcamento(dados.item), materiais)
    const itemFechado = itemComBaixas(dados.item, baixas, materiais)
    const quantidadeConsumidaSolicitada = baixas[0].solicitada
    const quantidadeMaterialDebitada = material ? baixas[0].debitada : undefined
    const resultado = material
      ? calcularOrcamentoCompleto(
          dados.item,
          material,
          servico ?? null,
          dados.ajusteManual,
          acabamentosSeed,
          equipamentosAcessoSeed,
          { materiais, servicos }
        )
      : null

    const novo: Orcamento = {
      id: gerarId("orc"),
      numero,
      clienteId: dados.clienteId,
      item: itemFechado,
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

    ajustarEstoque(deltasDeEstoque(baixas, new Map()))

    if (resultado) {
      const agora = new Date()
      const parcelas = gerarParcelasOrcamento({
        total: resultado.total,
        entradaPercent: dados.item.entradaPercent,
        descricaoBase: `Orçamento #${numero} — ${cliente?.nome ?? "Cliente"}`,
        vencimentoEntrada: agora.toISOString(),
        vencimentoRestante: new Date(
          agora.getTime() + (dados.validadeDias ?? 7) * UM_DIA_MS
        ).toISOString(),
      })
      const novosLancamentos: LancamentoFinanceiro[] = parcelas.map((p) => ({
        id: gerarId("lan"),
        descricao: p.descricao,
        tipo: "receita",
        categoria: "Orçamento",
        valor: p.valor,
        vencimento: p.vencimento,
        status: "pendente",
        origem: "orcamento",
        origemId: novo.id,
        criadoEm: agora.toISOString(),
        clienteId: dados.clienteId,
        parcela: p.parcela,
      }))
      setLancamentos((atual) => [...novosLancamentos, ...atual])
      novosLancamentos.forEach((l) => apiPost("/api/lancamentos", l))

      if (cliente) {
        registrarMensagemBot({
          clienteId: cliente.id,
          clienteNome: cliente.nome,
          telefone: cliente.telefone,
          texto: `Olá! Seu orçamento #${numero} foi fechado no valor de ${formatarMoeda(resultado.total)}${parcelas.length > 1 ? ` (entrada de ${formatarMoeda(parcelas[0].valor)} agora e ${formatarMoeda(parcelas[1].valor)} na entrega)` : ""}, válido por ${dados.validadeDias ?? 7} dias. Qualquer dúvida é só chamar por aqui.`,
          origem: "automatica",
          autor: "bot",
        })
      }
    }

    return novo
  }

  const updateOrcamento: DataContextValue["updateOrcamento"] = (id, dados, opcoes) => {
    const orcamento = orcamentos.find((o) => o.id === id)
    if (!orcamento || orcamento.status === "cancelado") return false

    const base = {
      ...orcamento,
      clienteId: dados.clienteId,
      item: dados.item,
      ajusteManual: dados.ajusteManual,
      validadeDias: dados.validadeDias,
      anexoNome: dados.anexoNome ?? orcamento.anexoNome,
      anexoUrl: dados.anexoUrl ?? orcamento.anexoUrl,
    }

    const estavaAberto = orcamento.status === "aberto"
    if (estavaAberto && !opcoes?.fechar) {
      setOrcamentos((atual) => atual.map((o) => (o.id === id ? base : o)))
      apiPut(`/api/orcamentos/${id}`, base)
      return true
    }

    const lancamentosRelacionados = lancamentos.filter(
      (l) => l.origem === "orcamento" && l.origemId === id
    )
    if (lancamentosRelacionados.some((l) => l.status === "pago")) return false

    // Estoque: devolve o que a versão antiga baixou e baixa o da nova. Aberto
    // não tem baixa (o Reabrir já devolveu), mesmo que o campo tenha ficado.
    const devolucoes = estavaAberto
      ? new Map<string, number>()
      : devolucoesDoOrcamento(orcamento, materiais)
    const baixas = planejarBaixas(itensDoOrcamento(dados.item), materiais, devolucoes)
    const itemFechado = itemComBaixas(dados.item, baixas, materiais)
    const material = materiais.find((m) => m.id === dados.item.materialId)
    const servico = servicos.find((s) => s.id === dados.item.servicoId)
    const cliente = clientes.find((c) => c.id === dados.clienteId)
    const consumo = baixas[0].solicitada

    ajustarEstoque(deltasDeEstoque(baixas, devolucoes))

    const resultado = material
      ? calcularOrcamentoCompleto(
          dados.item,
          material,
          servico ?? null,
          dados.ajusteManual,
          acabamentosSeed,
          equipamentosAcessoSeed,
          { materiais, servicos }
        )
      : null

    const atualizado: Orcamento = {
      ...base,
      status: "fechado",
      item: itemFechado,
      fechadoEm: orcamento.fechadoEm ?? new Date().toISOString(),
      quantidadeMaterialDebitada: material ? baixas[0].debitada : undefined,
      materialFechado: material
        ? {
            id: material.id,
            nome: material.nome,
            unidade: material.unidade,
            quantidade: consumo,
            custo: consumo * material.precoUnitario,
          }
        : orcamento.materialFechado,
      servicoFechado: servico
        ? { nome: servico.nome, ferramentas: servico.ferramentas }
        : undefined,
      totalFechado: resultado?.total ?? orcamento.totalFechado,
    }
    setOrcamentos((atual) => atual.map((o) => (o.id === id ? atualizado : o)))
    apiPut(`/api/orcamentos/${id}`, atualizado)

    if (resultado) {
      // Refaz as parcelas conforme o novo total e a nova entrada. As que já
      // existiam (mesma parcela) mantêm o id e o vencimento, que a pessoa
      // pode ter ajustado; nada aqui está pago (checado acima).
      const agora = new Date()
      const parcelas = gerarParcelasOrcamento({
        total: resultado.total,
        entradaPercent: dados.item.entradaPercent,
        descricaoBase: `Orçamento #${orcamento.numero} — ${cliente?.nome ?? "Cliente"}`,
        vencimentoEntrada: agora.toISOString(),
        vencimentoRestante: new Date(
          new Date(orcamento.criadoEm).getTime() + dados.validadeDias * UM_DIA_MS
        ).toISOString(),
      })
      const chave = (parcela: string | undefined) => parcela ?? "unica"
      const existentes = new Map(lancamentosRelacionados.map((l) => [chave(l.parcela), l]))
      const novos: LancamentoFinanceiro[] = parcelas.map((p) => {
        const antigo = existentes.get(chave(p.parcela))
        return {
          id: antigo?.id ?? gerarId("lan"),
          descricao: p.descricao,
          tipo: "receita",
          categoria: "Orçamento",
          valor: p.valor,
          vencimento: antigo?.vencimento ?? p.vencimento,
          status: "pendente",
          origem: "orcamento",
          origemId: id,
          criadoEm: antigo?.criadoEm ?? agora.toISOString(),
          clienteId: dados.clienteId,
          formaPagamento: antigo?.formaPagamento,
          parcela: p.parcela,
        }
      })
      const idsNovos = new Set(novos.map((l) => l.id))
      lancamentosRelacionados
        .filter((l) => !idsNovos.has(l.id))
        .forEach((l) => apiDelete(`/api/lancamentos/${l.id}`))
      novos.forEach((l) => {
        if (existentes.has(chave(l.parcela))) apiPut(`/api/lancamentos/${l.id}`, l)
        else apiPost("/api/lancamentos", l)
      })
      setLancamentos((atual) => [
        ...novos,
        ...atual.filter((l) => !(l.origem === "orcamento" && l.origemId === id)),
      ])
    }
    return true
  }

  const atualizarRetorno: DataContextValue["atualizarRetorno"] = (id, retorno) => {
    setOrcamentos((atual) =>
      atual.map((o) => {
        if (o.id !== id) return o
        const atualizado = {
          ...o,
          retorno: { ...retorno, atualizadoEm: new Date().toISOString() },
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

      ajustarEstoque(devolucoesDoOrcamento(orcamento, materiais))

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

  const removeOrcamento: DataContextValue["removeOrcamento"] = (id) => {
    const orcamento = orcamentos.find((o) => o.id === id)
    if (!orcamento) return

    if (orcamento.status === "fechado") {
      ajustarEstoque(devolucoesDoOrcamento(orcamento, materiais))
      const relacionados = lancamentos.filter(
        (l) => l.origem === "orcamento" && l.origemId === id
      )
      relacionados.forEach((l) => apiDelete(`/api/lancamentos/${l.id}`))
      setLancamentos((atual) =>
        atual.filter((l) => !(l.origem === "orcamento" && l.origemId === id))
      )
    }

    setOrcamentos((atual) => atual.filter((o) => o.id !== id))
    apiDelete(`/api/orcamentos/${id}`)
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

  const updateLancamento: DataContextValue["updateLancamento"] = (id, dados) => {
    setLancamentos((atual) =>
      atual.map((l) => {
        if (l.id !== id) return l
        const atualizado = { ...l, ...dados }
        apiPut(`/api/lancamentos/${id}`, atualizado)
        return atualizado
      })
    )
  }

  const removeLancamento: DataContextValue["removeLancamento"] = (id) => {
    setLancamentos((atual) => atual.filter((l) => l.id !== id))
    apiDelete(`/api/lancamentos/${id}`)
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
      updateOrcamento,
      atualizarRetorno,
      reabrirOrcamento,
      removeOrcamento,
      duplicarOrcamento,
      consumirRascunho,
      addProdutoRapido,
      addPedidoRapido,
      moverPedidoRapido,
      addLancamento,
      updateLancamento,
      removeLancamento,
      marcarLancamentoStatus,
      addMensagemBot,
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
