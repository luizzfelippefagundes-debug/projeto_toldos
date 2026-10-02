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
import {
  acabamentosSeed,
  clientesSeed,
  entradasEstoqueSeed,
  equipamentosAcessoSeed,
  lancamentosFinanceirosSeed,
  materiaisSeed,
  mensagensBotSeed,
  orcamentosSeed,
  pedidosRapidosSeed,
  produtosRapidosSeed,
  servicosSeed,
} from "@/lib/seed-data"
import { lerArmazenamento, salvarArmazenamento } from "@/lib/storage"
import { calcularOrcamentoCompleto, quantidadeMaterialConsumida } from "@/lib/calculo"
import { formatarMoeda } from "@/lib/format"

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
  addEntradaEstoque: (dados: Omit<EntradaEstoque, "id" | "data">) => void
  fecharOrcamento: (dados: {
    clienteId: string
    item: OrcamentoItem
    ajusteManual: number
    anexoNome: string
    validadeDias?: number
  }) => Orcamento
  reabrirOrcamento: (id: string) => void
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
}

const DataContext = createContext<DataContextValue | null>(null)

function gerarId(prefixo: string) {
  return `${prefixo}-${Math.random().toString(36).slice(2, 10)}`
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
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>(
    lancamentosFinanceirosSeed
  )
  const [mensagensBot, setMensagensBot] = useState<MensagemBot[]>(
    mensagensBotSeed
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
    setLancamentos(
      lerArmazenamento("toldosys.lancamentos", lancamentosFinanceirosSeed)
    )
    setMensagensBot(
      lerArmazenamento("toldosys.mensagensBot", mensagensBotSeed)
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
  useEffect(() => {
    if (!hidratado) return
    salvarArmazenamento("toldosys.produtosRapidos", produtosRapidos)
  }, [hidratado, produtosRapidos])
  useEffect(() => {
    if (!hidratado) return
    salvarArmazenamento("toldosys.pedidosRapidos", pedidosRapidos)
  }, [hidratado, pedidosRapidos])
  useEffect(() => {
    if (!hidratado) return
    salvarArmazenamento("toldosys.lancamentos", lancamentos)
  }, [hidratado, lancamentos])
  useEffect(() => {
    if (!hidratado) return
    salvarArmazenamento("toldosys.mensagensBot", mensagensBot)
  }, [hidratado, mensagensBot])

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
    const servico = servicos.find((s) => s.id === dados.item.servicoId)
    const cliente = clientes.find((c) => c.id === dados.clienteId)
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
      validadeDias: dados.validadeDias ?? 7,
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

    // Fechar um orçamento gera automaticamente uma receita "a receber" no
    // Financeiro — igual ao que acontece com um pedido da Gráfica Rápida
    // aprovado (ver addPedidoRapido/moverPedidoRapido). Sem isso o módulo
    // financeiro ficaria desconectado do resto do sistema.
    if (material && servico) {
      const resultado = calcularOrcamentoCompleto(
        dados.item,
        material,
        servico,
        dados.ajusteManual,
        acabamentosSeed,
        equipamentosAcessoSeed
      )
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

  // Registra uma mensagem na Central do Bot (automática, lembrete ou
  // resposta de pergunta) — usado por fecharOrcamento/addPedidoRapido/
  // moverPedidoRapido abaixo, e exposto como addMensagemBot pra quem for
  // disparar manualmente (lembrete de boleto, "Testar bot").
  function registrarMensagemBot(dados: Omit<MensagemBot, "id" | "criadoEm">) {
    const nova: MensagemBot = {
      id: gerarId("msg"),
      criadoEm: new Date().toISOString(),
      ...dados,
    }
    setMensagensBot((atual) => [nova, ...atual])
  }

  // Cria a receita "a receber" de um pedido da Gráfica Rápida assim que ele
  // sai de "aguardando" (ou já nasce assim, no caso de "Virar Pedido") — o
  // mesmo gatilho de fecharOrcamento, adaptado pra esse fluxo mais simples.
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
    setPedidosRapidos((atual) =>
      atual.map((p) => (p.id === id ? { ...p, status } : p))
    )
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
      ...dados,
    }
    setLancamentos((atual) => [novo, ...atual])
    return novo
  }

  const marcarLancamentoStatus: DataContextValue["marcarLancamentoStatus"] = (
    id,
    status
  ) => {
    setLancamentos((atual) =>
      atual.map((l) => (l.id === id ? { ...l, status } : l))
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
      addEntradaEstoque,
      fecharOrcamento,
      reabrirOrcamento,
      duplicarOrcamento,
      consumirRascunho,
      addProdutoRapido,
      addPedidoRapido,
      moverPedidoRapido,
      addLancamento,
      marcarLancamentoStatus,
      addMensagemBot,
    }),
    // Algumas ações (fecharOrcamento, duplicarOrcamento, addPedidoRapido,
    // moverPedidoRapido) leem outros states por closure em vez de usar só
    // updates funcionais — mas todo state que elas leem já está nas deps
    // abaixo, então o memo já recalcula sempre que essas closures
    // precisariam ficar atualizadas; adicionar as próprias funções às deps
    // as tornaria "instáveis" (são recriadas a cada render) e faria o memo
    // recalcular sempre, sem ganho.
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
