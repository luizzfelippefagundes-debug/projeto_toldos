"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { LOGO_PRINT_BASE64 } from "@/lib/logo-data"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Copy,
  Check,
  Phone,
  Plus,
  Trash2,
  Smartphone,
  Wallet,
  Calendar,
  CalendarRange,
  CalendarCheck,
  Receipt,
  CheckCircle2,
  Clock,
  History,
  Users2,
  Share2,
  DollarSign,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  Search,
  Filter,
  X,
  Printer,
  FileSpreadsheet,
  Coins,
  ShieldCheck,
  FileText,
  Layers,
  LayoutList,
  UserCheck,
  Settings2,
  BarChart3,
  Trophy,
  TrendingUp,
  TrendingDown,
  Award,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { usePapelAtivo } from "@/context/papel-ativo-context"
import type { Papel } from "@/lib/types"
import { formatarMoeda, formatarDataHora, formatarData } from "@/lib/format"
import { EMPRESA_ORCAMENTO } from "@/lib/orcamento-pdf"

interface Membro {
  id: string
  nome: string
  email: string
  papel: Papel
  imagemUrl: string
  ultimoLogin: number | null
}

interface ComissaoItem {
  id: string
  colaborador_id: string
  colaborador_nome: string
  origem_tipo: "pedido" | "orcamento"
  origem_id: string
  numero: number
  cliente_nome: string
  produto_nome: string
  valor_pedido: number
  comissao_percent: number
  valor_comissao: number
  status: "pendente" | "pago"
  recibo_id?: string | null
  pago_em?: string | null
  pago_por?: string | null
  criado_em: string
}

interface ResumoColaborador {
  colaborador_nome: string
  total_pendente: number
  total_pago: number
  quantidade_pecas: number
  quantidade_pendente: number
  comissoes_pendentes_ids: string[]
}

interface ElegibilidadeItem {
  colaborador_id: string
  colaborador_nome: string
  email: string | null
  papel: string
  imagemUrl?: string
  recebe_bonus: boolean
  comissao_padrao_percent: number
}

const corPapel: Record<string, string> = {
  dono: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  producao: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  financeiro: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  operador: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
}

const rotuloPapel: Record<string, string> = {
  producao: "Produção",
  financeiro: "Financeiro",
  dono: "Dono",
  operador: "Colaborador",
}

function Avatar({ nome, imagemUrl }: { nome: string; imagemUrl: string }) {
  const [erro, setErro] = useState(false)
  const iniciais = nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase()

  if (erro || !imagemUrl) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {iniciais}
      </div>
    )
  }

  return (
    <img
      src={imagemUrl}
      alt={nome}
      onError={() => setErro(true)}
      className="h-9 w-9 shrink-0 rounded-full object-cover"
    />
  )
}


// Helpers de Período (Semana e Mês)
function obterInicioEFimSemana(dataRef = new Date()) {
  const d = new Date(dataRef)
  const diaSemana = d.getDay()
  const diffSegunda = d.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1)
  const inicio = new Date(d.setDate(diffSegunda))
  inicio.setHours(0, 0, 0, 0)
  const fim = new Date(inicio)
  fim.setDate(fim.getDate() + 6)
  fim.setHours(23, 59, 59, 999)
  return { inicio, fim }
}

function obterInicioEFimMes(dataRef = new Date()) {
  const inicio = new Date(dataRef.getFullYear(), dataRef.getMonth(), 1, 0, 0, 0, 0)
  const fim = new Date(dataRef.getFullYear(), dataRef.getMonth() + 1, 0, 23, 59, 59, 999)
  return { inicio, fim }
}

export default function EquipePage() {
  const router = useRouter()
  const { papel, papelReal, verComo } = usePapelAtivo()
  const isOperador = papel === "operador" || papelReal === "operador"

  // Aba ativa: "extrato" (Fechamento) | "meu-extrato" | "historico" | "membros"
  const [abaAtiva, setAbaAtiva] = useState<
    "extrato" | "graficos" | "recibos" | "historico" | "membros" | "meu-extrato"
  >(isOperador ? "meu-extrato" : "extrato")

  // Estado do extrato pessoal do usuário logado
  const [meuExtrato, setMeuExtrato] = useState<any | null>(null)
  const [carregandoMeuExtrato, setCarregandoMeuExtrato] = useState(false)
  const [abaInternaMeuExtrato, setAbaInternaMeuExtrato] = useState<"semana" | "recibos" | "historico">("semana")

  // Estado dos membros do Clerk
  const [membros, setMembros] = useState<Membro[]>([])
  const [carregandoMembros, setCarregandoMembros] = useState(true)
  const [copiado, setCopiado] = useState(false)
  const [telefonesProducao, setTelefonesProducao] = useState<string[]>([])
  const [novoTelefone, setNovoTelefone] = useState("")
  const [salvandoTelefones, setSalvandoTelefones] = useState(false)

  // Estado das comissões
  const [comissoes, setComissoes] = useState<ComissaoItem[]>([])
  const [resumoColaboradores, setResumoColaboradores] = useState<ResumoColaborador[]>([])
  const [totalPendenteGeral, setTotalPendenteGeral] = useState(0)
  const [totalPagoGeral, setTotalPagoGeral] = useState(0)
  const [carregandoComissoes, setCarregandoComissoes] = useState(true)

  // Recibos Emitidos e Dashboard de Desempenho
  const [todosRecibos, setTodosRecibos] = useState<any[]>([])
  const [carregandoRecibos, setCarregandoRecibos] = useState(false)
  const [buscaRecibo, setBuscaRecibo] = useState("")
  const [filtroColabDashboard, setFiltroColabDashboard] = useState<string>("todos")

  const carregarTodosRecibos = useCallback(async () => {
    setCarregandoRecibos(true)
    try {
      const res = await fetch("/api/comissoes/recibo", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setTodosRecibos(data.recibos || [])
      }
    } catch {
      // silencioso
    } finally {
      setCarregandoRecibos(false)
    }
  }, [])


  // Filtros do Histórico
  const [modoVisualizacao, setModoVisualizacao] = useState<"demandas" | "detalhada">("demandas")
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>("todos")
  const [dataInicioCustom, setDataInicioCustom] = useState("")
  const [dataFimCustom, setDataFimCustom] = useState("")
  const [filtroStatus, setFiltroStatus] = useState<string>("todos")
  const [filtroColaborador, setFiltroColaborador] = useState<string>("todos")
  const [buscaHistorico, setBuscaHistorico] = useState("")

  // Modal de Pagamento
  const [modalPagamento, setModalPagamento] = useState<{
    colaborador: ResumoColaborador
    lancarFinanceiro: boolean
    formaPagamento: "pix" | "dinheiro" | "deposito" | "outro"
    tipoAssinatura: "fisica" | "digital"
    observacao: string
  } | null>(null)
  const [salvandoPagamento, setSalvandoPagamento] = useState(false)

  // Modal de Elegibilidade de Bônus (Quem Recebe Bônus)
  const [dialogElegibilidadeAberto, setDialogElegibilidadeAberto] = useState(false)
  const [listaElegibilidade, setListaElegibilidade] = useState<ElegibilidadeItem[]>([])
  const [carregandoElegibilidade, setCarregandoElegibilidade] = useState(false)
  const [salvandoElegibilidade, setSalvandoElegibilidade] = useState(false)

  const carregarElegibilidade = useCallback(async () => {
    setCarregandoElegibilidade(true)
    try {
      const res = await fetch("/api/comissoes/elegibilidade", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setListaElegibilidade(data.elegibilidade || [])
      } else {
        toast.error("Erro ao carregar lista de colaboradores.")
      }
    } catch {
      toast.error("Falha ao comunicar com o servidor.")
    } finally {
      setCarregandoElegibilidade(false)
    }
  }, [])

  const salvarElegibilidade = async () => {
    setSalvandoElegibilidade(true)
    try {
      const res = await fetch("/api/comissoes/elegibilidade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colaboradores: listaElegibilidade }),
      })
      if (res.ok) {
        toast.success("Regras de bônus atualizadas com sucesso!")
        setDialogElegibilidadeAberto(false)
        carregarDadosComissoes()
      } else {
        const err = await res.json()
        toast.error(err.error || "Erro ao salvar regras.")
      }
    } catch {
      toast.error("Erro ao salvar regras de bônus.")
    } finally {
      setSalvandoElegibilidade(false)
    }
  }

  
  const { inicio: inicioSemanaAtual, fim: fimSemanaAtual } = useMemo(() => obterInicioEFimSemana(), [])
  const { inicio: inicioMesAtual, fim: fimMesAtual } = useMemo(() => obterInicioEFimMes(), [])

  // Detalhamento enriquecido por colaborador com dados de Semana, Mês e Vendas
  const colaboradoresDetalhados = useMemo(() => {
    return resumoColaboradores.map((colab) => {
      const itensDoColab = comissoes.filter((c) => c.colaborador_nome === colab.colaborador_nome)

      // Semana atual
      const itensSemana = itensDoColab.filter((c) => {
        const data = new Date(c.criado_em)
        return data >= inicioSemanaAtual && data <= fimSemanaAtual
      })
      const totalSemana = itensSemana.reduce((acc, c) => acc + (Number(c.valor_comissao) || 0), 0)
      const pecasSemana = itensSemana.length

      // Mês atual
      const itensMes = itensDoColab.filter((c) => {
        const data = new Date(c.criado_em)
        return data >= inicioMesAtual && data <= fimMesAtual
      })
      const totalMes = itensMes.reduce((acc, c) => acc + (Number(c.valor_comissao) || 0), 0)
      const pecasMes = itensMes.length
      const vendasMes = itensMes.reduce((acc, c) => acc + (Number(c.valor_pedido) || 0), 0)

      // Total pendente da semana / a pagar
      const totalPendente = colab.total_pendente
      const pecasPendentes = colab.quantidade_pendente

      // Total histórico
      const totalHistorico = colab.total_pendente + colab.total_pago
      const pecasHistorico = colab.quantidade_pecas

      // Último recibo emitido para ele
      const ultimoRecibo = todosRecibos.find((r) => r.colaborador_nome === colab.colaborador_nome)

      return {
        ...colab,
        totalSemana,
        pecasSemana,
        totalMes,
        pecasMes,
        vendasMes,
        totalPendente,
        pecasPendentes,
        totalHistorico,
        pecasHistorico,
        ultimoRecibo,
      }
    })
  }, [resumoColaboradores, comissoes, inicioSemanaAtual, fimSemanaAtual, inicioMesAtual, fimMesAtual, todosRecibos])

  // Total acumulado no mês atual da fábrica inteira
  const totalMesFabrica = useMemo(() => {
    return comissoes
      .filter((c) => {
        const data = new Date(c.criado_em)
        return data >= inicioMesAtual && data <= fimMesAtual
      })
      .reduce((acc, c) => acc + (Number(c.valor_comissao) || 0), 0)
  }, [comissoes, inicioMesAtual, fimMesAtual])

  // Dados do Dashboard de Produção & Gráficos
  const dadosDashboard = useMemo(() => {
    const itens = filtroColabDashboard === "todos"
      ? comissoes
      : comissoes.filter((c) => c.colaborador_nome === filtroColabDashboard)

    const mesesMap: Record<string, {
      chave: string
      ano: number
      mesNum: number
      nomeMes: string
      bonusTotal: number
      pecasTotal: number
      vendasTotal: number
    }> = {}

    itens.forEach((c) => {
      const data = new Date(c.criado_em)
      if (isNaN(data.getTime())) return
      const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`
      if (!mesesMap[chave]) {
        const nomeMes = data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
        const nomeCapitalizado = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)
        mesesMap[chave] = {
          chave,
          ano: data.getFullYear(),
          mesNum: data.getMonth() + 1,
          nomeMes: nomeCapitalizado,
          bonusTotal: 0,
          pecasTotal: 0,
          vendasTotal: 0,
        }
      }
      mesesMap[chave].bonusTotal += Number(c.valor_comissao) || 0
      mesesMap[chave].pecasTotal += 1
      mesesMap[chave].vendasTotal += Number(c.valor_pedido) || 0
    })

    const hoje = new Date()
    const chaveHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`
    if (!mesesMap[chaveHoje]) {
      const nomeMes = hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      mesesMap[chaveHoje] = {
        chave: chaveHoje,
        ano: hoje.getFullYear(),
        mesNum: hoje.getMonth() + 1,
        nomeMes: nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1),
        bonusTotal: 0,
        pecasTotal: 0,
        vendasTotal: 0,
      }
    }

    const listaMesesCrescente = Object.values(mesesMap).sort((a, b) => a.chave.localeCompare(b.chave))

    const listaComVariacao = listaMesesCrescente.map((mes, idx, arr) => {
      const mesAnterior = idx > 0 ? arr[idx - 1] : null
      let variacaoPercent = 0
      let statusVariacao: "subiu" | "desceu" | "igual" | "primeiro" = "primeiro"

      if (mesAnterior && mesAnterior.bonusTotal > 0) {
        variacaoPercent = ((mes.bonusTotal - mesAnterior.bonusTotal) / mesAnterior.bonusTotal) * 100
        statusVariacao = variacaoPercent > 0 ? "subiu" : variacaoPercent < 0 ? "desceu" : "igual"
      } else if (mesAnterior && mesAnterior.bonusTotal === 0 && mes.bonusTotal > 0) {
        variacaoPercent = 100
        statusVariacao = "subiu"
      }

      return {
        ...mes,
        mesAnterior,
        variacaoPercent,
        statusVariacao,
      }
    })

    let mesRecorde = listaComVariacao[0]
    listaComVariacao.forEach((m) => {
      if (m.bonusTotal > (mesRecorde?.bonusTotal || 0)) {
        mesRecorde = m
      }
    })

    const mesAtualDados = listaComVariacao.find((m) => m.chave === chaveHoje) || listaComVariacao[listaComVariacao.length - 1]
    const somaBonus = listaComVariacao.reduce((acc, m) => acc + m.bonusTotal, 0)
    const mediaMensal = listaComVariacao.length > 0 ? somaBonus / listaComVariacao.length : 0
    const maxBonusGrafico = Math.max(...listaComVariacao.map((m) => m.bonusTotal), 10)

    const rankingMap: Record<string, { nome: string; bonusTotal: number; pecasTotal: number; vendasTotal: number }> = {}
    comissoes.forEach((c) => {
      const nome = c.colaborador_nome || "Colaborador"
      if (!rankingMap[nome]) {
        rankingMap[nome] = { nome, bonusTotal: 0, pecasTotal: 0, vendasTotal: 0 }
      }
      rankingMap[nome].bonusTotal += Number(c.valor_comissao) || 0
      rankingMap[nome].pecasTotal += 1
      rankingMap[nome].vendasTotal += Number(c.valor_pedido) || 0
    })

    const rankingOrdenado = Object.values(rankingMap).sort((a, b) => b.bonusTotal - a.bonusTotal)
    const totalGeralBonus = rankingOrdenado.reduce((acc, r) => acc + r.bonusTotal, 0) || 1

    return {
      listaMesesCrescente: listaComVariacao,
      listaMesesDecrescente: [...listaComVariacao].reverse(),
      mesRecorde,
      mesAtualDados,
      mediaMensal,
      maxBonusGrafico,
      rankingOrdenado,
      totalGeralBonus,
    }
  }, [comissoes, filtroColabDashboard])

  // Recibos Filtrados por Busca
  const recibosFiltrados = useMemo(() => {
    return todosRecibos.filter((r) => {
      if (!buscaRecibo.trim()) return true
      const termo = buscaRecibo.toLowerCase()
      return (
        r.numero_recibo?.toLowerCase().includes(termo) ||
        r.colaborador_nome?.toLowerCase().includes(termo) ||
        r.forma_pagamento?.toLowerCase().includes(termo)
      )
    })
  }, [todosRecibos, buscaRecibo])

  // Expandir detalhes no card de fechamento
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})

  const linkCadastro = typeof window !== "undefined"
    ? `${window.location.origin}/sign-up`
    : ""

  const carregarDadosComissoes = useCallback(async () => {
    setCarregandoComissoes(true)
    try {
      const res = await fetch("/api/comissoes", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setComissoes(data.comissoes || [])
        setResumoColaboradores(data.resumo || [])
        setTotalPendenteGeral(data.totalGeralPendente || 0)
        setTotalPagoGeral(data.totalGeralPago || 0)
      }
    } catch {
      toast.error("Erro ao carregar banco de comissões.")
    } finally {
      setCarregandoComissoes(false)
    }
  }, [])

  const [colaboradorSimulado, setColaboradorSimulado] = useState<string>("todos")

  const carregarMeuExtrato = useCallback(async (nomeAlvo?: string) => {
    setCarregandoMeuExtrato(true)
    try {
      const url = nomeAlvo && nomeAlvo !== "todos"
        ? `/api/comissoes/meu-extrato?colaborador=${encodeURIComponent(nomeAlvo)}`
        : "/api/comissoes/meu-extrato"
      const res = await fetch(url, { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setMeuExtrato(data)
      }
    } catch {
      // Ignora falha silenciosa para quem não tem dados
    } finally {
      setCarregandoMeuExtrato(false)
    }
  }, [])

  useEffect(() => {
    if (!isOperador) {
      fetch("/api/equipe")
        .then((r) => r.json())
        .then(setMembros)
        .catch(() => toast.error("Erro ao carregar equipe."))
        .finally(() => setCarregandoMembros(false))

      fetch("/api/equipe/telefones-producao")
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d?.telefones)) setTelefonesProducao(d.telefones)
        })
        .catch(() => {})

      carregarDadosComissoes()
      carregarTodosRecibos()
    }
    carregarMeuExtrato()
  }, [carregarDadosComissoes, carregarMeuExtrato, carregarTodosRecibos, isOperador])

  async function atualizarTelefonesProducao(novos: string[]) {
    setSalvandoTelefones(true)
    try {
      const res = await fetch("/api/equipe/telefones-producao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefones: novos }),
      })
      if (!res.ok) throw new Error("Erro ao salvar telefones")
      setTelefonesProducao(novos)
      toast.success("Telefones da equipe atualizados!")
    } catch {
      toast.error("Não foi possível salvar os telefones.")
    } finally {
      setSalvandoTelefones(false)
    }
  }

  function adicionarTelefone() {
    const limpo = novoTelefone.replace(/\D/g, "")
    if (limpo.length < 10) {
      toast.error("Informe um número de WhatsApp válido com DDD.")
      return
    }
    const comDdi = limpo.startsWith("55") ? limpo : `55${limpo}`
    if (telefonesProducao.includes(comDdi)) {
      toast.error("Este telefone já está na lista.")
      return
    }
    const listaAtualizada = [...telefonesProducao, comDdi]
    atualizarTelefonesProducao(listaAtualizada)
    setNovoTelefone("")
  }

  function removerTelefone(tel: string) {
    const listaAtualizada = telefonesProducao.filter((t) => t !== tel)
    atualizarTelefonesProducao(listaAtualizada)
  }

  function copiarLink() {
    navigator.clipboard.writeText(linkCadastro).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  async function atualizarPapel(userId: string, novoPapel: Papel) {
    const anterior = membros
    setMembros((m) =>
      m.map((u) => (u.id === userId ? { ...u, papel: novoPapel } : u))
    )
    try {
      const res = await fetch(`/api/equipe/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ papel: novoPapel }),
      })
      if (!res.ok) {
        const corpo = await res.json().catch(() => null)
        throw new Error(corpo?.error ?? "Erro ao atualizar papel.")
      }
      toast.success("Acesso atualizado. Vale em até 1 minuto (ou ao recarregar a página).")
    } catch (e) {
      setMembros(anterior)
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar papel.")
    }
  }

  // Ação de Pagamento de Comissões e Emissão de Recibo
  async function confirmarPagamento() {
    if (!modalPagamento) return
    setSalvandoPagamento(true)
    try {
      const res = await fetch("/api/comissoes/pagar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comissao_ids: modalPagamento.colaborador.comissoes_pendentes_ids,
          colaborador_nome: modalPagamento.colaborador.colaborador_nome,
          forma_pagamento: modalPagamento.formaPagamento,
          tipo_assinatura: modalPagamento.tipoAssinatura,
          criar_lancamento_financeiro: modalPagamento.lancarFinanceiro,
          observacao: modalPagamento.observacao,
        }),
      })

      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(
        `✓ Pagamento registrado! Recibo ${data.numeroRecibo || ""} gerado com sucesso.`,
        { duration: 5000 }
      )
      const reciboId = data.reciboId
      setModalPagamento(null)
      carregarDadosComissoes()
      carregarTodosRecibos()

      if (reciboId) {
        router.push(`/equipe/recibo/${reciboId}`)
      }
    } catch {
      toast.error("Erro ao registrar pagamento de comissões.")
    } finally {
      setSalvandoPagamento(false)
    }
  }

  // Gerar texto do Extrato para WhatsApp
  function gerarLinkWhatsApp(colab: ResumoColaborador) {
    const itensColab = comissoes.filter(
      (c) => c.colaborador_nome === colab.colaborador_nome && c.status === "pendente"
    )

    let texto = `*TOLDOS PRINT — FECHAMENTO DE BÔNUS DE PRODUÇÃO*\n`
    texto += `Colaborador: *${colab.colaborador_nome}*\n`
    texto += `Total a Receber: *R$ ${colab.total_pendente.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*\n`
    texto += `Quantidade de peças: *${colab.quantidade_pendente} peças concluídas*\n\n`
    texto += `*Detalhamento das Peças:*\n`

    itensColab.slice(0, 15).forEach((item) => {
      const dataFmt = new Date(item.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
      texto += `• OS #${item.numero} (${item.cliente_nome}) — R$ ${Number(item.valor_comissao).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${dataFmt})\n`
    })

    if (itensColab.length > 15) {
      texto += `• ... e mais ${itensColab.length - 15} peças finalizadas.\n`
    }

    texto += `\nParabéns pelo trabalho e dedicação na fábrica! 🚀🪙`

    return `https://wa.me/?text=${encodeURIComponent(texto)}`
  }

  // Filtragem da aba Histórico
  const historicoFiltrado = useMemo(() => {
    const agora = new Date()

    return comissoes.filter((c) => {
      if (filtroStatus !== "todos" && c.status !== filtroStatus) return false
      if (filtroColaborador !== "todos" && c.colaborador_nome !== filtroColaborador) return false

      // Filtro por Período
      if (filtroPeriodo !== "todos") {
        const dataItem = new Date(c.criado_em)

        if (filtroPeriodo === "hoje") {
          const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
          const fimHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999)
          if (dataItem < inicioHoje || dataItem > fimHoje) return false
        } else if (filtroPeriodo === "semana") {
          // Início da semana atual (segunda-feira)
          const diaSemana = agora.getDay()
          const distSegunda = (diaSemana + 6) % 7
          const inicioSemana = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - distSegunda)
          inicioSemana.setHours(0, 0, 0, 0)
          if (dataItem < inicioSemana) return false
        } else if (filtroPeriodo === "semana_passada") {
          const diaSemana = agora.getDay()
          const distSegunda = (diaSemana + 6) % 7
          const fimSemanaPassada = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - distSegunda - 1, 23, 59, 59, 999)
          const inicioSemanaPassada = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - distSegunda - 7, 0, 0, 0, 0)
          if (dataItem < inicioSemanaPassada || dataItem > fimSemanaPassada) return false
        } else if (filtroPeriodo === "mes") {
          const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
          if (dataItem < inicioMes) return false
        } else if (filtroPeriodo === "mes_passado") {
          const inicioMesPassado = new Date(agora.getFullYear(), agora.getMonth() - 1, 1)
          const fimMesPassado = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59, 999)
          if (dataItem < inicioMesPassado || dataItem > fimMesPassado) return false
        } else if (filtroPeriodo === "custom") {
          if (dataInicioCustom) {
            const [ano, mes, dia] = dataInicioCustom.split("-").map(Number)
            const dtIni = new Date(ano, mes - 1, dia, 0, 0, 0, 0)
            if (dataItem < dtIni) return false
          }
          if (dataFimCustom) {
            const [ano, mes, dia] = dataFimCustom.split("-").map(Number)
            const dtFim = new Date(ano, mes - 1, dia, 23, 59, 59, 999)
            if (dataItem > dtFim) return false
          }
        }
      }

      // Busca textual
      if (buscaHistorico.trim()) {
        const termo = buscaHistorico.toLowerCase()
        const matchCliente = c.cliente_nome?.toLowerCase().includes(termo)
        const matchNumero = String(c.numero).includes(termo)
        const matchProduto = c.produto_nome?.toLowerCase().includes(termo)
        if (!matchCliente && !matchNumero && !matchProduto) return false
      }
      return true
    })
  }, [comissoes, filtroStatus, filtroColaborador, filtroPeriodo, dataInicioCustom, dataFimCustom, buscaHistorico])

  // KPIs dos itens filtrados do Histórico
  const kpisHistorico = useMemo(() => {
    let valorPedidosTotal = 0
    let valorComissoesTotal = 0
    let valorPendenteTotal = 0
    let valorPagoTotal = 0

    historicoFiltrado.forEach((item) => {
      const vPed = Number(item.valor_pedido) || 0
      const vCom = Number(item.valor_comissao) || 0
      valorPedidosTotal += vPed
      valorComissoesTotal += vCom
      if (item.status === "pendente") {
        valorPendenteTotal += vCom
      } else {
        valorPagoTotal += vCom
      }
    })

    return {
      quantidadePecas: historicoFiltrado.length,
      valorPedidosTotal,
      valorComissoesTotal,
      valorPendenteTotal,
      valorPagoTotal,
    }
  }, [historicoFiltrado])

  // Demandas agrupadas para não duplicar linhas quando vários colaboradores trabalham na mesma OS
  const demandasAgrupadas = useMemo(() => {
    const mapa = new Map<string, {
      chave: string
      origem_tipo: "pedido" | "orcamento"
      numero: number
      cliente_nome: string
      produto_nome: string
      valor_pedido: number
      criado_em: string
      comissoes: Array<{
        id: string
        colaborador_nome: string
        valor_comissao: number
        comissao_percent: number
        status: "pendente" | "pago"
        recibo_id?: string | null
      }>
      totalComissaoDemanda: number
    }>()

    historicoFiltrado.forEach((c) => {
      const chave = `${c.origem_tipo}_${c.numero}_${c.produto_nome}`
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          chave,
          origem_tipo: c.origem_tipo,
          numero: c.numero,
          cliente_nome: c.cliente_nome,
          produto_nome: c.produto_nome,
          valor_pedido: Number(c.valor_pedido) || 0,
          criado_em: c.criado_em,
          comissoes: [],
          totalComissaoDemanda: 0,
        })
      }
      const grupo = mapa.get(chave)!
      grupo.comissoes.push({
        id: c.id,
        colaborador_nome: c.colaborador_nome,
        valor_comissao: Number(c.valor_comissao) || 0,
        comissao_percent: c.comissao_percent,
        status: c.status,
        recibo_id: c.recibo_id,
      })
      grupo.totalComissaoDemanda += Number(c.valor_comissao) || 0
    })

    return Array.from(mapa.values())
  }, [historicoFiltrado])

  const temFiltrosAtivos =
    filtroPeriodo !== "todos" ||
    filtroStatus !== "todos" ||
    filtroColaborador !== "todos" ||
    buscaHistorico.trim() !== "" ||
    dataInicioCustom !== "" ||
    dataFimCustom !== ""

  function limparFiltros() {
    setFiltroPeriodo("todos")
    setDataInicioCustom("")
    setDataFimCustom("")
    setFiltroStatus("todos")
    setFiltroColaborador("todos")
    setBuscaHistorico("")
  }

  const rotuloPeriodoImpresso = useMemo(() => {
    if (filtroPeriodo === "hoje") return "Hoje"
    if (filtroPeriodo === "semana") return "Esta Semana"
    if (filtroPeriodo === "semana_passada") return "Semana Passada"
    if (filtroPeriodo === "mes") return "Este Mês"
    if (filtroPeriodo === "mes_passado") return "Mês Passado"
    if (filtroPeriodo === "custom") {
      if (dataInicioCustom && dataFimCustom) return `De ${formatarData(dataInicioCustom)} até ${formatarData(dataFimCustom)}`
      if (dataInicioCustom) return `A partir de ${formatarData(dataInicioCustom)}`
      if (dataFimCustom) return `Até ${formatarData(dataFimCustom)}`
      return "Período Personalizado"
    }
    return "Todo o Histórico"
  }, [filtroPeriodo, dataInicioCustom, dataFimCustom])

  return (
    <div className="flex flex-col gap-5 sm:gap-6 pb-12 print:p-0 print:m-0 print:pb-0">
      {/* ========================================================= */}
      {/* CABEÇALHO OFICIAL PROFISSIONAL EXCLUSIVO PARA IMPRESSÃO / PDF */}
      {/* ========================================================= */}
      <div className="hidden print:flex flex-col gap-3 pb-3 mb-4 border-b-2 border-slate-900 text-slate-950 w-full">
        <div className="flex items-center justify-between gap-4">
          {/* Logo Oficial e Dados da Empresa */}
          <div className="flex items-center gap-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGO_PRINT_BASE64}
              alt="Toldos Print"
              className="h-12 w-auto object-contain shrink-0"
            />
            <div className="border-l-2 border-slate-400 pl-3">
              <h1 className="text-sm font-black text-slate-950 uppercase tracking-tight leading-tight">
                TOLDOS PRINT & COMUNICAÇÃO VISUAL
              </h1>
              <p className="text-[9px] text-slate-700 font-bold leading-tight mt-0.5">
                {EMPRESA_ORCAMENTO.cnpj}
              </p>
              <p className="text-[8.5px] text-slate-600 leading-tight">
                {EMPRESA_ORCAMENTO.endereco.join(" — ")} • Tel: (27) 99748-9714
              </p>
            </div>
          </div>

          {/* Metadados do Relatório */}
          <div className="text-right text-[9px] text-slate-700 shrink-0">
            <span className="inline-block px-2 py-0.5 bg-slate-900 text-white font-black text-[8.5px] uppercase tracking-wider rounded">
              Demonstrativo de Produção & Comissões
            </span>
            <p className="font-black text-slate-950 text-[11px] mt-1">
              {rotuloPeriodoImpresso}
            </p>
            <p className="text-[8.5px] text-slate-500 font-medium">
              Emitido em {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-[8.5px] font-bold text-slate-800">
              Colaborador: {filtroColaborador === "todos" ? "Toda a Equipe" : filtroColaborador}
            </p>
          </div>
        </div>

        {/* Quadro Resumo Compacto de Impressão */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-300 text-xs">
          <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
            <span className="text-[8.5px] uppercase font-bold text-slate-500 block">Peças Produzidas</span>
            <span className="text-xs font-black text-slate-900">{kpisHistorico.quantidadePecas} peças</span>
          </div>
          <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
            <span className="text-[8.5px] uppercase font-bold text-slate-500 block">Faturamento (Vendas)</span>
            <span className="text-xs font-black text-slate-900">{formatarMoeda(kpisHistorico.valorPedidosTotal)}</span>
          </div>
          <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
            <span className="text-[8.5px] uppercase font-bold text-slate-500 block">Total em Bônus</span>
            <span className="text-xs font-black text-emerald-800">{formatarMoeda(kpisHistorico.valorComissoesTotal)}</span>
          </div>
          <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
            <span className="text-[8.5px] uppercase font-bold text-slate-500 block">Pendentes / Pagos</span>
            <span className="text-[11px] font-black text-slate-800">
              <span className="text-amber-800">{formatarMoeda(kpisHistorico.valorPendenteTotal)}</span> / <span className="text-slate-600">{formatarMoeda(kpisHistorico.valorPagoTotal)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Cabeçalho Principal (Oculto na Impressão) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3.5">
          {/* Logo da Empresa */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo.png"
            alt="Toldos Print"
            className="h-10 sm:h-11 w-auto object-contain rounded-xl bg-[#0060a7] p-1.5 shadow-xs shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                Equipe & RH
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Gestão de colaboradores, conta-corrente de comissões de produção e controle de acessos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarDadosComissoes}
            disabled={carregandoComissoes}
            className="gap-1.5 text-xs font-bold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${carregandoComissoes ? "animate-spin" : ""}`} />
            <span>Atualizar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              verComo("operador")
              router.push("/producao")
            }}
            className="text-xs font-bold"
          >
            Ver como Colaborador
          </Button>
        </div>
      </div>

      {/* Navegação entre as Abas (Oculta na Impressão) */}
      <div className="flex border-b border-border gap-2 sm:gap-4 overflow-x-auto [scrollbar-width:none] print:hidden">
        {/* Visão do Dono/Gestor */}
        {!isOperador && (
          <>
            <button
              type="button"
              onClick={() => setAbaAtiva("extrato")}
              className={`pb-2.5 pt-1 px-1 border-b-2 text-xs sm:text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                abaAtiva === "extrato"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Wallet className="h-4 w-4" />
              <span>⚡ Fechamento (Semana & Mês)</span>
              {totalPendenteGeral > 0 && (
                <span className="rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-black">
                  R$ {totalPendenteGeral.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setAbaAtiva("graficos")}
              className={`pb-2.5 pt-1 px-1 border-b-2 text-xs sm:text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                abaAtiva === "graficos"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>📊 Desempenho & Gráficos</span>
              <span className="rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 text-[10px] font-black">
                Evolução
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAbaAtiva("recibos")}
              className={`pb-2.5 pt-1 px-1 border-b-2 text-xs sm:text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                abaAtiva === "recibos"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Receipt className="h-4 w-4" />
              <span>🧾 Recibos Emitidos</span>
              <span className="rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 text-[10px] font-black">
                {todosRecibos.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAbaAtiva("historico")}
              className={`pb-2.5 pt-1 px-1 border-b-2 text-xs sm:text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                abaAtiva === "historico"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <History className="h-4 w-4" />
              <span>📜 Histórico de Peças</span>
              <span className="rounded-full bg-muted text-muted-foreground px-1.5 py-0.2 text-[10px] font-black">
                {comissoes.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAbaAtiva("membros")}
              className={`pb-2.5 pt-1 px-1 border-b-2 text-xs sm:text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                abaAtiva === "membros"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users2 className="h-4 w-4" />
              <span>👥 Membros & Acessos</span>
              <span className="rounded-full bg-muted text-muted-foreground px-1.5 py-0.2 text-[10px] font-black">
                {membros.length}
              </span>
            </button>
          </>
        )}

        {/* Visão do Colaborador: Apenas o Extrato dele */}
        {isOperador && (
          <button
            type="button"
            onClick={() => setAbaAtiva("meu-extrato")}
            className="pb-2.5 pt-1 px-1 border-b-2 border-primary text-primary text-xs sm:text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <Coins className="h-4 w-4" />
            <span>Meu Extrato & Comissões</span>
            {meuExtrato?.resumo?.totalPendente > 0 && (
              <span className="rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[10px] font-black">
                R$ {meuExtrato.resumo.totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            )}
          </button>
        )}
      </div>

      {/* CONTEÚDO DA ABA 1: EXTRATO DA SEMANA / FECHAMENTO */}
      {abaAtiva === "extrato" && (
        <div className="flex flex-col gap-5">
          {/* Métricas do Fechamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: A Pagar na Semana */}
            <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                  ⚡ A Pagar Esta Semana
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-950 dark:text-emerald-100 mt-1 block">
                  R$ {totalPendenteGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold mt-0.5 block">
                  Pronto para repasse no sábado
                </span>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center text-2xl shrink-0">
                🪙
              </div>
            </div>

            {/* Card 2: Total Produzido no Mês Atual */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  📆 Total no Mês Atual
                </span>
                <span className="text-2xl sm:text-3xl font-black text-foreground mt-1 block">
                  R$ {totalMesFabrica.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium mt-0.5 block">
                  Acumulado de bônus em {new Date().toLocaleDateString("pt-BR", { month: "long" })}
                </span>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-blue-500/15 text-blue-600 flex items-center justify-center text-xl shrink-0">
                📅
              </div>
            </div>

            {/* Card 3: Recibos Emitidos / Quitado */}
            <div
              onClick={() => setAbaAtiva("recibos")}
              className="rounded-2xl border border-border bg-card p-4 shadow-xs flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all group"
              title="Clique para ver todos os recibos emitidos"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                    🧾 Recibos Emitidos
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <span className="text-2xl sm:text-3xl font-black text-foreground mt-1 block">
                  {todosRecibos.length} recibos
                </span>
                <span className="text-[10px] text-primary font-bold group-hover:underline block">
                  R$ {totalPagoGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} quitados &rarr;
                </span>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-purple-500/15 text-purple-600 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                🧾
              </div>
            </div>

            {/* Card 4: Elegibilidade de Bônus */}
            <div
              onClick={() => {
                carregarElegibilidade()
                setDialogElegibilidadeAberto(true)
              }}
              className="rounded-2xl border border-border bg-card p-4 shadow-xs flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all group"
              title="Clique para configurar quem pode receber bônus"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                    👥 Quem Recebe Bônus
                  </span>
                  <Settings2 className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <span className="text-2xl sm:text-3xl font-black text-foreground mt-1 block">
                  {resumoColaboradores.filter((r) => r.total_pendente > 0).length} de {resumoColaboradores.length}
                </span>
                <span className="text-[10px] text-primary font-bold group-hover:underline">
                  Configurar elegibilidade &rarr;
                </span>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                👥
              </div>
            </div>
          </div>

          {/* Lista de Cards por Colaborador */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black text-foreground uppercase tracking-wider">
                  Fechamento Semanal por Colaborador
                </h2>
                <p className="text-xs text-muted-foreground">
                  Valores semanais prontos para pagamento com emissão de recibo oficial assinado.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAbaAtiva("graficos")}
                  className="gap-2 text-xs font-bold border-blue-500/40 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 shadow-xs"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>Ver Gráficos & Desempenho</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    carregarElegibilidade()
                    setDialogElegibilidadeAberto(true)
                  }}
                  className="gap-2 text-xs font-bold border-primary/40 text-primary hover:bg-primary/10 hover:text-primary shadow-xs"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  <span>Quem Recebe Bônus</span>
                </Button>
              </div>
            </div>

            {colaboradoresDetalhados.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
                <span className="text-3xl block">🪙</span>
                <p className="font-bold text-foreground text-sm mt-2">Nenhum bônus creditado ainda</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quando uma peça for finalizada na tela de Produção com comissão ativa, o valor cairá automaticamente aqui.
                </p>
              </div>
            ) : (
              colaboradoresDetalhados.map((colab) => {
                const itensPendentes = comissoes.filter(
                  (c) => c.colaborador_nome === colab.colaborador_nome && c.status === "pendente"
                )
                const isExpandido = expandidos[colab.colaborador_nome] ?? false

                return (
                  <div
                    key={colab.colaborador_nome}
                    className={`rounded-2xl border-2 transition-all overflow-hidden ${
                      colab.total_pendente > 0
                        ? "border-emerald-500/50 bg-card shadow-md"
                        : "border-border/80 bg-muted/20 opacity-85"
                    }`}
                  >
                    {/* Cabeçalho do Card com as 3 métricas explícitas */}
                    <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Identificação do Colaborador */}
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-lg font-black shrink-0">
                          {colab.colaborador_nome.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-base sm:text-lg text-foreground">
                              {colab.colaborador_nome}
                            </h3>
                            {colab.total_pendente > 0 ? (
                              <span className="rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] sm:text-xs font-black px-2 py-0.5">
                                {colab.quantidade_pendente} peça{colab.quantidade_pendente !== 1 ? "s" : ""} a pagar
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-500/20 text-muted-foreground text-[10px] font-bold px-2 py-0.5">
                                Quitado ✓
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Histórico total: R$ {colab.totalHistorico.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ({colab.pecasHistorico} peças acumuladas)
                          </p>
                        </div>
                      </div>

                      {/* As 3 Métricas Explícitas: Semana (A Pagar) | Mês | Vendas Produzidas */}
                      <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-muted/40 p-2.5 rounded-xl border border-border/60">
                        {/* 1. Esta Semana (A Pagar) */}
                        <div className="text-left px-2 border-r border-border/60">
                          <span className="text-[9px] sm:text-[10px] text-emerald-800 dark:text-emerald-300 uppercase font-black tracking-wider block">
                            ⚡ Esta Semana (A Pagar)
                          </span>
                          <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">
                            R$ {colab.total_pendente.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-muted-foreground block font-medium">
                            {colab.pecasPendentes} peça{colab.pecasPendentes !== 1 ? "s" : ""} pendente{colab.pecasPendentes !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {/* 2. Total no Mês */}
                        <div className="text-left px-2 border-r border-border/60">
                          <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase font-black tracking-wider block">
                            📆 Total no Mês
                          </span>
                          <span className="text-base sm:text-lg font-black text-foreground block mt-0.5">
                            R$ {colab.totalMes.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-muted-foreground block font-medium">
                            {colab.pecasMes} peça{colab.pecasMes !== 1 ? "s" : ""} no mês
                          </span>
                        </div>

                        {/* 3. Vendas Produzidas */}
                        <div className="text-left px-2">
                          <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase font-black tracking-wider block">
                            📦 Vendas Feitas
                          </span>
                          <span className="text-base sm:text-lg font-black text-foreground block mt-0.5">
                            R$ {colab.vendasMes.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-muted-foreground block font-medium">
                            Volume de pedidos
                          </span>
                        </div>
                      </div>

                      {/* Ações: Pagar & Emitir Recibo / Último Recibo / WhatsApp / Expandir */}
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {colab.total_pendente > 0 && (
                          <Button
                            size="sm"
                            onClick={() =>
                              setModalPagamento({
                                colaborador: colab,
                                lancarFinanceiro: true,
                                formaPagamento: "pix",
                                tipoAssinatura: "fisica",
                                observacao: `Pagamento semanal de bônus de produção (${colab.quantidade_pendente} peças)`,
                              })
                            }
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            <span>🧾 Pagar & Emitir Recibo</span>
                          </Button>
                        )}

                        {colab.ultimoRecibo && (
                          <Button
                            size="sm"
                            variant="outline"
                            nativeButton={false}
                            render={
                              <a
                                href={`/equipe/recibo/${colab.ultimoRecibo.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              />
                            }
                            className="gap-1.5 text-xs font-bold border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 shadow-xs"
                            title="Ver ou imprimir o último recibo gerado para este colaborador"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span>🖨️ Último Recibo</span>
                          </Button>
                        )}

                        {colab.total_pendente > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            nativeButton={false}
                            render={<a href={gerarLinkWhatsApp(colab)} target="_blank" rel="noopener noreferrer" />}
                            className="gap-1.5 text-xs font-bold border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                            title="Enviar extrato detalhado pronto no WhatsApp do colaborador"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </Button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setExpandidos((prev) => ({
                              ...prev,
                              [colab.colaborador_nome]: !isExpandido,
                            }))
                          }
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                          title="Ver peças que compõem este valor"
                        >
                          {isExpandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Detalhamento das Peças Expandidas */}
                    {isExpandido && (
                      <div className="border-t border-border/80 bg-muted/40 p-4">
                        <span className="text-xs font-black uppercase tracking-wider text-muted-foreground block mb-2">
                          Peças pendentes deste fechamento:
                        </span>

                        {itensPendentes.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Nenhuma peça pendente para pagamento.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {itensPendentes.map((item) => (
                              <div
                                key={item.id}
                                className="rounded-xl border border-border/80 bg-card p-3 shadow-2xs flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-black text-xs text-foreground">
                                      OS #{item.numero}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground truncate">
                                      {item.cliente_nome}
                                    </span>
                                  </div>
                                  <p className="text-[11px] font-bold text-muted-foreground truncate mt-0.5">
                                    {item.produto_nome || "Produção"}
                                  </p>
                                </div>
                                <span className="shrink-0 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-black text-xs px-2 py-0.5">
                                  + {formatarMoeda(Number(item.valor_comissao) || 0)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: DESEMPENHO & GRÁFICOS */}
      {abaAtiva === "graficos" && (
        <div className="flex flex-col gap-6">
          {/* Header e Filtro por Colaborador */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h2 className="text-base sm:text-lg font-black text-foreground">
                  Dashboard de Produção & Comparativo Mês a Mês
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Veja o histórico se o colaborador fez mais ou menos em cada mês, picos de produção e ranking da fábrica.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">Filtrar por:</span>
              <Select
                value={filtroColabDashboard}
                onValueChange={(v) => {
                  if (v) setFiltroColabDashboard(v)
                }}
              >
                <SelectTrigger className="w-[200px] text-xs font-black bg-background">
                  <SelectValue placeholder="Toda a Equipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">🏭 Toda a Fábrica (Geral)</SelectItem>
                  {resumoColaboradores.map((c) => (
                    <SelectItem key={c.colaborador_nome} value={c.colaborador_nome}>
                      👤 {c.colaborador_nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cards de KPIs de Destaque */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* KPI 1: Mês Recorde */}
            <div className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-transparent p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">
                  🏆 Mês Recorde
                </span>
                <Trophy className="h-4 w-4 text-amber-600" />
              </div>
              <span className="text-xl sm:text-2xl font-black text-foreground mt-1 block">
                {dadosDashboard.mesRecorde?.nomeMes || "—"}
              </span>
              <span className="text-xs text-amber-900 dark:text-amber-200 font-black mt-1 block">
                R$ {(dadosDashboard.mesRecorde?.bonusTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em bônus ({dadosDashboard.mesRecorde?.pecasTotal || 0} peças)
              </span>
            </div>

            {/* KPI 2: Mês Atual vs Mês Anterior (Evolução) */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  📈 Mês Atual vs Anterior
                </span>
                {dadosDashboard.mesAtualDados?.statusVariacao === "subiu" ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                ) : dadosDashboard.mesAtualDados?.statusVariacao === "desceu" ? (
                  <TrendingDown className="h-4 w-4 text-rose-500" />
                ) : (
                  <span className="text-xs text-muted-foreground">●</span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-black text-foreground">
                  {dadosDashboard.mesAtualDados?.statusVariacao === "subiu" ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      +{dadosDashboard.mesAtualDados.variacaoPercent.toFixed(0)}%
                    </span>
                  ) : dadosDashboard.mesAtualDados?.statusVariacao === "desceu" ? (
                    <span className="text-rose-600 dark:text-rose-400">
                      {dadosDashboard.mesAtualDados.variacaoPercent.toFixed(0)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Estável</span>
                  )}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground mt-1 block">
                {dadosDashboard.mesAtualDados?.statusVariacao === "subiu"
                  ? "🟢 Fez mais que o mês anterior!"
                  : dadosDashboard.mesAtualDados?.statusVariacao === "desceu"
                  ? "🔴 Fez menos que o mês anterior"
                  : "Manteve o mesmo ritmo"}
              </span>
            </div>

            {/* KPI 3: Líder Geral */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  🥇 Líder de Produção
                </span>
                <Award className="h-4 w-4 text-primary" />
              </div>
              <span className="text-lg sm:text-xl font-black text-foreground mt-1 block truncate">
                {dadosDashboard.rankingOrdenado[0]?.nome || "—"}
              </span>
              <span className="text-xs text-primary font-bold mt-1 block">
                R$ {(dadosDashboard.rankingOrdenado[0]?.bonusTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ({dadosDashboard.rankingOrdenado[0]?.pecasTotal || 0} peças)
              </span>
            </div>

            {/* KPI 4: Média Mensal */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  💰 Média Mensal
                </span>
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
              <span className="text-xl sm:text-2xl font-black text-foreground mt-1 block">
                R$ {dadosDashboard.mediaMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Média de bônus por mês registrado
              </span>
            </div>
          </div>

          {/* Gráfico Visual de Barras Mês a Mês */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
                  Evolução do Bônus Mês a Mês
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Comparativo de cada mês registrado para conferência visual de crescimento.
                </p>
              </div>
              <span className="rounded-full bg-primary/10 text-primary text-xs font-black px-2.5 py-1">
                {filtroColabDashboard === "todos" ? "Toda a Fábrica" : filtroColabDashboard}
              </span>
            </div>

            {dadosDashboard.listaMesesCrescente.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs">
                Nenhum dado mensal para o período selecionado.
              </div>
            ) : (
              <div className="w-full overflow-x-auto pt-6 pb-2">
                <div className="min-w-[400px] flex items-end justify-between gap-4 h-56 px-4 border-b border-border">
                  {dadosDashboard.listaMesesCrescente.map((mes) => {
                    const alturaPct = Math.max(
                      14,
                      Math.round((mes.bonusTotal / dadosDashboard.maxBonusGrafico) * 100)
                    )
                    const isRecorde = mes.chave === dadosDashboard.mesRecorde?.chave && mes.bonusTotal > 0

                    return (
                      <div key={mes.chave} className="flex-1 flex flex-col items-center justify-end h-full group">
                        {/* Valor acima da barra */}
                        <div className="mb-2 text-center transition-transform group-hover:scale-105">
                          {isRecorde && (
                            <span className="text-[10px] block font-black text-amber-500 animate-bounce">
                              🏆 Recorde
                            </span>
                          )}
                          <span className="text-xs font-black text-foreground block">
                            R$ {mes.bonusTotal.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                          <span className="text-[10px] text-muted-foreground block font-bold">
                            {mes.pecasTotal} un
                          </span>
                        </div>

                        {/* Barra */}
                        <div
                          style={{ height: `${alturaPct}%` }}
                          className={`w-full max-w-[48px] rounded-t-xl transition-all duration-300 group-hover:brightness-110 shadow-sm ${
                            isRecorde
                              ? "bg-gradient-to-t from-amber-500 to-amber-400"
                              : "bg-gradient-to-t from-emerald-600 to-emerald-400"
                          }`}
                        />

                        {/* Rótulo do Mês */}
                        <div className="pt-2 text-center">
                          <span className="text-[11px] font-black text-muted-foreground block whitespace-nowrap">
                            {mes.nomeMes.split(" de ")[0]}
                          </span>
                          <span className="text-[9px] text-muted-foreground/70 block">
                            {mes.ano}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Duas Colunas: Comparativo Mês a Mês (Tabela) + Ranking Geral da Fábrica */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Tabela de Comparativo Mês a Mês */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-wider mb-1">
                  Comparativo Detalhado (Mês Fez Mais ou Menos?)
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Histórico comparativo direto com o mês anterior.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground font-black text-[10px] uppercase">
                        <th className="text-left py-2">Mês / Ano</th>
                        <th className="text-right py-2">Bônus</th>
                        <th className="text-right py-2">Peças</th>
                        <th className="text-right py-2">Desempenho</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {dadosDashboard.listaMesesDecrescente.map((mes) => {
                        const isRecorde = mes.chave === dadosDashboard.mesRecorde?.chave && mes.bonusTotal > 0

                        return (
                          <tr key={mes.chave} className="hover:bg-muted/40 transition-colors">
                            <td className="py-2.5 font-bold text-foreground">
                              {mes.nomeMes}
                              {isRecorde && (
                                <span className="ml-1.5 text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded font-black">
                                  Recorde
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                              R$ {mes.bonusTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 text-right font-bold text-muted-foreground">
                              {mes.pecasTotal} pcs
                            </td>
                            <td className="py-2.5 text-right font-bold">
                              {mes.statusVariacao === "subiu" ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-black">
                                  <TrendingUp className="h-3 w-3" />
                                  +{mes.variacaoPercent.toFixed(0)}% (Fez Mais)
                                </span>
                              ) : mes.statusVariacao === "desceu" ? (
                                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-black">
                                  <TrendingDown className="h-3 w-3" />
                                  {mes.variacaoPercent.toFixed(0)}% (Fez Menos)
                                </span>
                              ) : mes.statusVariacao === "igual" ? (
                                <span className="text-muted-foreground">Mesmo ritmo</span>
                              ) : (
                                <span className="text-muted-foreground italic">Primeiro mês</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Ranking Geral da Fábrica (Pódio) */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-wider mb-1">
                  Ranking Geral da Fábrica (Pódio)
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Colaboradores mais produtivos ranqueados por valor acumulado.
                </p>

                <div className="flex flex-col gap-3">
                  {dadosDashboard.rankingOrdenado.map((item, idx) => {
                    const medalha = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`
                    const pctDoTotal = Math.round((item.bonusTotal / dadosDashboard.totalGeralBonus) * 100)

                    return (
                      <div
                        key={item.nome}
                        className="p-3 rounded-xl border border-border/70 bg-background flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black w-6 text-center">{medalha}</span>
                            <span className="font-black text-sm text-foreground">{item.nome}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                              R$ {item.bonusTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-muted-foreground block font-bold">
                              {item.pecasTotal} peça{item.pecasTotal !== 1 ? "s" : ""} ({pctDoTotal}% da fábrica)
                            </span>
                          </div>
                        </div>

                        {/* Barra de Progresso */}
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-500"
                            style={{ width: `${pctDoTotal}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 3: RECIBOS EMITIDOS */}
      {abaAtiva === "recibos" && (
        <div className="flex flex-col gap-5">
          {/* Header e Busca de Recibos */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-purple-600" />
                <h2 className="text-base sm:text-lg font-black text-foreground">
                  Recibos Oficiais de Bônus de Produção
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Recibos emitidos para conferência, impressão e assinatura física ou digital dos colaboradores.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar colaborador ou nº recibo..."
                  value={buscaRecibo}
                  onChange={(e) => setBuscaRecibo(e.target.value)}
                  className="pl-8 text-xs w-[240px]"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={carregarTodosRecibos}
                disabled={carregandoRecibos}
                className="gap-1.5 text-xs font-bold"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${carregandoRecibos ? "animate-spin" : ""}`} />
                <span>Atualizar</span>
              </Button>
            </div>
          </div>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Total de Recibos Emitidos
                </span>
                <span className="text-2xl sm:text-3xl font-black text-foreground mt-1 block">
                  {todosRecibos.length} recibos
                </span>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-purple-500/15 text-purple-600 flex items-center justify-center text-xl shrink-0">
                🧾
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                  Total Pago em Recibos
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-950 dark:text-emerald-100 mt-1 block">
                  R$ {todosRecibos.reduce((acc, r) => acc + (Number(r.valor_total) || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center text-xl shrink-0">
                ✓
              </div>
            </div>
          </div>

          {/* Lista de Recibos */}
          {carregandoRecibos ? (
            <div className="p-12 text-center">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
              <p className="text-xs font-bold text-muted-foreground">Carregando recibos emitidos...</p>
            </div>
          ) : recibosFiltrados.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
              <Receipt className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="font-bold text-foreground text-sm">Nenhum recibo emitido ainda</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                Quando você clicar em <strong>"Pagar & Emitir Recibo"</strong> na aba de Fechamento, o recibo oficial será gerado e listado aqui para impressão e assinatura a qualquer momento.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {recibosFiltrados.map((recibo) => (
                <div
                  key={recibo.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-xs flex flex-col justify-between gap-3 hover:border-primary/50 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                        Recibo #{recibo.numero_recibo}
                      </span>
                      <h4 className="font-black text-base text-foreground mt-0.5">
                        {recibo.colaborador_nome}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Emitido em {new Date(recibo.criado_em).toLocaleDateString("pt-BR")} às {new Date(recibo.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>

                    <span className="rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-black text-xs px-2.5 py-1 shrink-0">
                      R$ {Number(recibo.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="uppercase text-[10px] font-bold">
                        {recibo.forma_pagamento?.toUpperCase() || "PIX"}
                      </span>
                      <span>•</span>
                      <span className="text-[10px]">
                        {recibo.tipo_assinatura === "digital" ? "✍️ Digital" : "📄 No papel"}
                      </span>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={
                        <a
                          href={`/equipe/recibo/${recibo.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                      className="gap-1.5 text-xs font-bold border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>🖨️ Abrir Recibo</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO DA ABA: MEU EXTRATO PESSOAL */}
      {abaAtiva === "meu-extrato" && (
        <div className="flex flex-col gap-6">
          {/* Se o Dono estiver usando "Ver como Colaborador", permitir alternar qual colaborador está inspecionando */}
          {papelReal === "dono" && (
            <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200 block">
                  Simulação de Visão de Colaborador (Modo Administrador)
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Selecione qual funcionário você quer inspecionar para ver o extrato exatamente como aparece no celular/computador dele:
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={colaboradorSimulado}
                  onValueChange={(v) => {
                    if (v) {
                      setColaboradorSimulado(v)
                      carregarMeuExtrato(v)
                    }
                  }}
                >
                  <SelectTrigger className="w-[200px] text-xs font-black bg-card">
                    <SelectValue placeholder="Selecione o Colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Meu Usuário ({meuExtrato?.colaborador?.nome || "Você"})</SelectItem>
                    {resumoColaboradores.map((c) => (
                      <SelectItem key={c.colaborador_nome} value={c.colaborador_nome}>
                        {c.colaborador_nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {carregandoMeuExtrato && !meuExtrato ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm font-bold text-muted-foreground">Carregando seu extrato...</p>
              </div>
            </div>
          ) : !meuExtrato ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
              <p className="text-sm font-bold text-muted-foreground">Nenhum dado encontrado para o seu login.</p>
              <Button onClick={() => carregarMeuExtrato()} variant="outline" size="sm" className="mt-3">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar
              </Button>
            </div>
          ) : (
            <>
              {/* Resumo do Colaborador Logado */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Card 1: A Receber Esta Semana */}
                <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent relative overflow-hidden shadow-xs">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-amber-700 dark:text-amber-400 font-bold uppercase text-[11px] tracking-wider flex items-center justify-between">
                      <span>A Receber Esta Semana</span>
                      <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
                    </CardDescription>
                    <CardTitle className="text-2xl sm:text-3xl font-black text-amber-950 dark:text-amber-100 mt-1">
                      {formatarMoeda(meuExtrato.resumo?.totalPendente || 0)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground font-medium">
                      <strong>{meuExtrato.resumo?.pecasPendentes || 0} peças</strong> prontas para repasse no fim de semana
                    </p>
                  </CardContent>
                </Card>

                {/* Card 2: Total Já Recebido */}
                <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent shadow-xs">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-emerald-700 dark:text-emerald-400 font-bold uppercase text-[11px] tracking-wider flex items-center justify-between">
                      <span>Total Já Recebido</span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardDescription>
                    <CardTitle className="text-2xl sm:text-3xl font-black text-emerald-950 dark:text-emerald-100 mt-1">
                      {formatarMoeda(meuExtrato.resumo?.totalPago || 0)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground font-medium">
                      <strong>{meuExtrato.recibos?.length || 0} recibos</strong> de pagamento quitados
                    </p>
                  </CardContent>
                </Card>

                {/* Card 3: Peças Produzidas */}
                <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-transparent shadow-xs">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-blue-700 dark:text-blue-400 font-bold uppercase text-[11px] tracking-wider flex items-center justify-between">
                      <span>Peças Produzidas</span>
                      <CalendarCheck className="h-4 w-4 text-blue-500" />
                    </CardDescription>
                    <CardTitle className="text-2xl sm:text-3xl font-black text-blue-950 dark:text-blue-100 mt-1">
                      {meuExtrato.resumo?.totalPecas || 0} un
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground font-medium">
                      Acumulado geral de peças concluídas por você
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Seletor de Sub-Abas do Meu Extrato */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border w-fit">
                <button
                  type="button"
                  onClick={() => setAbaInternaMeuExtrato("semana")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    abaInternaMeuExtrato === "semana"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Semana ({meuExtrato.itensPendentes?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setAbaInternaMeuExtrato("recibos")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    abaInternaMeuExtrato === "recibos"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Recibos ({meuExtrato.recibos?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setAbaInternaMeuExtrato("historico")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    abaInternaMeuExtrato === "historico"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Histórico Geral
                </button>
              </div>

              {/* Sub-Aba 1: Peças da Semana Pendentes */}
              {abaInternaMeuExtrato === "semana" && (
                <Card className="border shadow-xs">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-black flex items-center gap-2">
                        <Coins className="h-4 w-4 text-amber-500" />
                        Peças Desta Semana (A Receber)
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Valores apurados na produção prontos para o fechamento.
                      </CardDescription>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                        Total da Semana:
                      </span>
                      <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                        {formatarMoeda(meuExtrato.resumo?.totalPendente || 0)}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {(!meuExtrato.itensPendentes || meuExtrato.itensPendentes.length === 0) ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                        <Coins className="h-10 w-10 stroke-[1.5] mb-2 opacity-30 text-amber-500" />
                        <p className="text-sm font-bold">Nenhuma peça pendente para esta semana</p>
                        <p className="text-xs opacity-75 mt-0.5">
                          Assim que você concluir peças na Produção, seus bônus entram automaticamente aqui.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-muted/50 text-[10px] uppercase font-black text-muted-foreground border-b">
                            <tr>
                              <th className="py-2.5 px-3">Data</th>
                              <th className="py-2.5 px-3">Demanda</th>
                              <th className="py-2.5 px-3">Cliente</th>
                              <th className="py-2.5 px-3">Produto / Serviço</th>
                              <th className="py-2.5 px-3 text-right">Valor da OS</th>
                              <th className="py-2.5 px-3 text-right">Seu Bônus</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {meuExtrato.itensPendentes.map((item: any) => (
                              <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                                <td className="py-2.5 px-3 text-muted-foreground font-medium">
                                  {formatarData(item.criado_em)}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-primary">
                                  OS #{item.numero}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-foreground">
                                  {item.cliente_nome}
                                </td>
                                <td className="py-2.5 px-3 text-muted-foreground">
                                  {item.produto_nome}
                                </td>
                                <td className="py-2.5 px-3 text-right text-muted-foreground">
                                  {formatarMoeda(Number(item.valor_pedido) || 0)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-black text-amber-600 dark:text-amber-400 text-sm">
                                  +{formatarMoeda(Number(item.valor_comissao) || 0)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Sub-Aba 2: Recibos Oficiais Anteriores */}
              {abaInternaMeuExtrato === "recibos" && (
                <Card className="border shadow-xs">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-black flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-emerald-500" />
                      Meus Recibos de Pagamento
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Comprovantes oficiais emitidos pela administração.
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    {(!meuExtrato.recibos || meuExtrato.recibos.length === 0) ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                        <Receipt className="h-10 w-10 stroke-[1.5] mb-2 opacity-30 text-emerald-500" />
                        <p className="text-sm font-bold">Nenhum recibo emitido ainda</p>
                        <p className="text-xs opacity-75 mt-0.5">
                          Assim que a administração quitar seu fechamento, o recibo aparecerá aqui para visualização e assinatura.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {meuExtrato.recibos.map((rec: any) => {
                          const rotuloForma =
                            rec.forma_pagamento === "pix" ? "PIX" :
                            rec.forma_pagamento === "dinheiro" ? "Dinheiro" :
                            rec.forma_pagamento === "deposito" ? "Depósito" : "Outro"

                          return (
                            <div
                              key={rec.id}
                              className="rounded-xl border p-4 bg-card hover:border-primary/50 transition-all flex flex-col justify-between gap-3 shadow-2xs"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground block">
                                    Recibo Oficial
                                  </span>
                                  <span className="font-black text-base text-foreground">
                                    {rec.numero_recibo}
                                  </span>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Pago em {formatarData(rec.criado_em)} • via {rotuloForma}
                                  </p>
                                </div>

                                <div className="text-right">
                                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400 block">
                                    {formatarMoeda(Number(rec.valor_total) || 0)}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                                    <ShieldCheck className="h-3 w-3 text-emerald-500" />
                                    {rec.assinado_em ? "Assinado" : "Aguardando Assinatura"}
                                  </span>
                                </div>
                              </div>

                              <div className="pt-2 border-t flex items-center justify-between">
                                <span className="text-[11px] text-muted-foreground">
                                  Repassado por: <strong>{rec.pago_por || "Administração"}</strong>
                                </span>

                                <Link
                                  href={`/equipe/recibo/${rec.id}`}
                                  className={buttonVariants({ variant: "outline", size: "sm", className: "h-7 text-xs font-bold gap-1" })}
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  Ver Recibo
                                </Link>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Sub-Aba 3: Histórico Completo */}
              {abaInternaMeuExtrato === "historico" && (
                <Card className="border shadow-xs">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-black flex items-center gap-2">
                      <CalendarCheck className="h-4 w-4 text-primary" />
                      Histórico Recente de Produção
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Todas as peças creditadas a você na fábrica.
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    {(!meuExtrato.historicoRecente || meuExtrato.historicoRecente.length === 0) ? (
                      <div className="py-10 text-center text-muted-foreground text-sm">
                        Nenhum registro histórico encontrado
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-muted/50 text-[10px] uppercase font-black text-muted-foreground border-b">
                            <tr>
                              <th className="py-2 px-3">Data</th>
                              <th className="py-2 px-3">OS</th>
                              <th className="py-2 px-3">Cliente</th>
                              <th className="py-2 px-3">Produto</th>
                              <th className="py-2 px-3">Status</th>
                              <th className="py-2 px-3 text-right">Bônus</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {meuExtrato.historicoRecente.map((h: any) => (
                              <tr key={h.id} className="hover:bg-muted/20">
                                <td className="py-2 px-3 text-muted-foreground">{formatarData(h.criado_em)}</td>
                                <td className="py-2 px-3 font-bold">OS #{h.numero}</td>
                                <td className="py-2 px-3 font-medium">{h.cliente_nome}</td>
                                <td className="py-2 px-3 text-muted-foreground">{h.produto_nome}</td>
                                <td className="py-2 px-3">
                                  {h.status === "pago" ? (
                                    <span className="rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-black uppercase">
                                      Pago
                                    </span>
                                  ) : (
                                    <span className="rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[10px] font-black uppercase">
                                      Pendente
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-foreground">
                                  {formatarMoeda(Number(h.valor_comissao) || 0)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: HISTÓRICO DE COMISSÕES */}
      {abaAtiva === "historico" && (
        <div className="flex flex-col gap-4">
          {/* Métricas Resumo do Filtro Atual (Oculto na Impressão pois o Cabeçalho Oficial já tem) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 print:hidden">
            <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
                Itens / Peças Filtradas
              </span>
              <span className="text-xl sm:text-2xl font-black text-foreground mt-0.5 block">
                {kpisHistorico.quantidadePecas}
              </span>
              <span className="text-[10px] text-muted-foreground truncate block">
                Volume produzido
              </span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
                Valor das Vendas (Pedidos)
              </span>
              <span className="text-xl sm:text-2xl font-black text-foreground mt-0.5 block">
                {formatarMoeda(kpisHistorico.valorPedidosTotal)}
              </span>
              <span className="text-[10px] text-muted-foreground truncate block">
                Faturamento das peças
              </span>
            </div>

            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 shadow-2xs">
              <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300 tracking-wider block">
                Comissões no Período
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-950 dark:text-emerald-100 mt-0.5 block">
                {formatarMoeda(kpisHistorico.valorComissoesTotal)}
              </span>
              <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 truncate block">
                Total de bônus gerado
              </span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
                Pendentes vs Pagos
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-sm sm:text-base font-black text-amber-500">
                  {formatarMoeda(kpisHistorico.valorPendenteTotal)}
                </span>
                <span className="text-xs text-muted-foreground">/</span>
                <span className="text-xs sm:text-sm font-bold text-muted-foreground">
                  {formatarMoeda(kpisHistorico.valorPagoTotal)}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground truncate block">
                A pagar / Já quitado
              </span>
            </div>
          </div>

          {/* Barra de Filtros Completa e Profissional (Oculta na Impressão) */}
          <div className="rounded-2xl border border-border bg-card p-3.5 shadow-2xs flex flex-col gap-3 print:hidden">
            <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between">
              {/* Campo de Busca */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por OS (#10043), cliente ou produto..."
                  value={buscaHistorico}
                  onChange={(e) => setBuscaHistorico(e.target.value)}
                  className="pl-9 text-xs h-9"
                />
              </div>

              {/* Filtros e Modos de Exibição */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Alternância de Modo: Por Demanda Agrupada vs Detalhado */}
                <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => setModoVisualizacao("demandas")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      modoVisualizacao === "demandas"
                        ? "bg-background text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title="Agrupa por demanda: 1 linha por OS com a lista dos colaboradores que ganharam nela"
                  >
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    <span>Por Demanda (Sem duplicar)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoVisualizacao("detalhada")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      modoVisualizacao === "detalhada"
                        ? "bg-background text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title="Exibe 1 linha por comissão individual"
                  >
                    <LayoutList className="h-3.5 w-3.5" />
                    <span>Linha a Linha</span>
                  </button>
                </div>

                {/* Período */}
                <div className="flex items-center gap-1.5">
                  <Select value={filtroPeriodo} onValueChange={(v) => { if (v) setFiltroPeriodo(v) }}>
                    <SelectTrigger className="w-[145px] text-xs font-bold h-9">
                      <CalendarRange className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                      <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todo o Histórico</SelectItem>
                      <SelectItem value="hoje">Hoje</SelectItem>
                      <SelectItem value="semana">Esta Semana</SelectItem>
                      <SelectItem value="semana_passada">Semana Passada</SelectItem>
                      <SelectItem value="mes">Este Mês</SelectItem>
                      <SelectItem value="mes_passado">Mês Passado</SelectItem>
                      <SelectItem value="custom">Personalizado...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Colaborador */}
                <Select value={filtroColaborador} onValueChange={(v) => { if (v) setFiltroColaborador(v) }}>
                  <SelectTrigger className="w-[160px] text-xs font-bold h-9 border-primary/30">
                    <UserCheck className="h-3.5 w-3.5 mr-1 text-primary" />
                    <SelectValue placeholder="Filtrar Funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos Funcionários</SelectItem>
                    {resumoColaboradores.map((c) => (
                      <SelectItem key={c.colaborador_nome} value={c.colaborador_nome}>
                        {c.colaborador_nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Status */}
                <Select value={filtroStatus} onValueChange={(v) => { if (v) setFiltroStatus(v) }}>
                  <SelectTrigger className="w-[130px] text-xs font-bold h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos Status</SelectItem>
                    <SelectItem value="pendente">Apenas Pendentes</SelectItem>
                    <SelectItem value="pago">Apenas Pagos</SelectItem>
                  </SelectContent>
                </Select>

                {/* Limpar Filtros */}
                {temFiltrosAtivos && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={limparFiltros}
                    className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1 font-bold"
                    title="Limpar todos os filtros"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Limpar</span>
                  </Button>
                )}

                {/* Botão Imprimir / Exportar Relatório */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="h-9 px-3 text-xs font-bold gap-1.5"
                  title="Imprimir relatório dos itens filtrados"
                >
                  <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Imprimir</span>
                </Button>
              </div>
            </div>

            {/* Inputs de Data Customizada */}
            {filtroPeriodo === "custom" && (
              <div className="flex items-center gap-2 pt-2 border-t border-border/60 text-xs">
                <span className="text-muted-foreground font-bold">De:</span>
                <Input
                  type="date"
                  value={dataInicioCustom}
                  onChange={(e) => setDataInicioCustom(e.target.value)}
                  className="w-36 h-8 text-xs"
                />
                <span className="text-muted-foreground font-bold">Até:</span>
                <Input
                  type="date"
                  value={dataFimCustom}
                  onChange={(e) => setDataFimCustom(e.target.value)}
                  className="w-36 h-8 text-xs"
                />
              </div>
            )}
          </div>

          {/* Lista de Registros */}
          {historicoFiltrado.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-muted-foreground text-xs font-medium print:border-slate-300">
              Nenhum registro encontrado para estes filtros.
            </div>
          ) : modoVisualizacao === "demandas" ? (
            /* ======================================================== */
            /* MODO 1: AGRUPADO POR DEMANDA (1 LINHA POR OS - SEM REPETIÇÃO) */
            /* ======================================================== */
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs print:border-none print:shadow-none print:rounded-none">
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-left text-xs print:text-[9.5pt]">
                  <thead className="bg-muted/50 border-b border-border/80 font-black text-muted-foreground uppercase text-[10px] print:bg-slate-100 print:text-slate-900 print:border-b-2 print:border-slate-400">
                    <tr>
                      <th className="p-3 print:p-1.5">Demanda</th>
                      <th className="p-3 print:p-1.5">Cliente</th>
                      <th className="p-3 print:p-1.5">Produto / Serviço</th>
                      <th className="p-3 print:p-1.5">Valor Pedido</th>
                      <th className="p-3 print:p-1.5">Equipe / Colaboradores Bonificados</th>
                      <th className="p-3 print:p-1.5 text-right">Total em Bônus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 print:divide-slate-200">
                    {demandasAgrupadas.map((demanda) => (
                      <tr key={demanda.chave} className="hover:bg-muted/30 transition-colors print:hover:bg-transparent">
                        <td className="p-3 whitespace-nowrap print:p-1.5">
                          <span className="font-black text-primary print:text-slate-950 block">
                            {demanda.origem_tipo === "orcamento" ? `OS #${demanda.numero}` : `#${demanda.numero}`}
                          </span>
                          <span className="text-[10px] text-muted-foreground print:text-slate-500 block">
                            {formatarDataHora(demanda.criado_em)}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-foreground truncate max-w-[150px] print:p-1.5 print:text-slate-900">
                          {demanda.cliente_nome}
                        </td>
                        <td className="p-3 text-foreground font-medium truncate max-w-[200px] print:p-1.5 print:text-slate-800" title={demanda.produto_nome}>
                          {demanda.produto_nome || "Produção"}
                        </td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap font-bold print:p-1.5 print:text-slate-700">
                          {formatarMoeda(demanda.valor_pedido)}
                        </td>
                        <td className="p-3 print:p-1.5">
                          {/* Pílulas de cada colaborador com seu respectivo bônus */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {demanda.comissoes.map((c) => (
                              <div
                                key={c.id}
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-xs font-bold ${
                                  c.status === "pago"
                                    ? "bg-slate-500/10 border-slate-500/20 text-muted-foreground print:bg-slate-100 print:text-slate-800"
                                    : "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 print:bg-emerald-50 print:text-emerald-950"
                                }`}
                              >
                                <span className="font-extrabold">{c.colaborador_nome}:</span>
                                <span className="font-black">{formatarMoeda(c.valor_comissao)}</span>
                                {c.status === "pago" && (
                                  <span className="text-[10px] text-muted-foreground">✓</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap print:p-1.5">
                          <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 print:text-slate-950 block">
                            + {formatarMoeda(demanda.totalComissaoDemanda)}
                          </span>
                          <span className="text-[10px] text-muted-foreground print:text-slate-500 block">
                            {demanda.comissoes.length} pessoa{demanda.comissoes.length !== 1 ? "s" : ""}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* MODO 2: DETALHADO LINHA A LINHA */
            /* ======================================================== */
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs print:border-none print:shadow-none print:rounded-none">
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-left text-xs print:text-[9.5pt] print:table-fixed">
                  <thead className="bg-muted/50 border-b border-border/80 font-black text-muted-foreground uppercase text-[10px] print:bg-slate-100 print:text-slate-900 print:border-b-2 print:border-slate-400">
                    <tr>
                      <th className="p-3 print:p-1.5 print:w-[15%]">Data</th>
                      <th className="p-3 print:p-1.5 print:w-[18%]">Colaborador</th>
                      <th className="p-3 print:p-1.5 print:w-[12%]">Demanda</th>
                      <th className="p-3 print:p-1.5 print:w-[18%]">Cliente</th>
                      <th className="p-3 print:p-1.5 print:w-[20%]">Produto / Serviço</th>
                      <th className="p-3 print:p-1.5 print:w-[17%] text-right">Bônus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 print:divide-slate-200">
                    {historicoFiltrado.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors print:hover:bg-transparent">
                        <td className="p-3 text-muted-foreground whitespace-nowrap print:p-1.5 print:text-slate-700 print:text-[8.5pt]">
                          {formatarDataHora(item.criado_em)}
                        </td>
                        <td className="p-3 font-black text-foreground print:p-1.5 print:text-slate-950">
                          {item.colaborador_nome}
                        </td>
                        <td className="p-3 font-bold text-primary whitespace-nowrap print:p-1.5 print:text-slate-900">
                          {item.origem_tipo === "orcamento" ? `OS #${item.numero}` : `#${item.numero}`}
                        </td>
                        <td className="p-3 font-medium text-foreground truncate max-w-[150px] print:p-1.5 print:text-slate-800 print:truncate">
                          {item.cliente_nome}
                        </td>
                        <td className="p-3 text-foreground font-semibold truncate max-w-[200px] print:p-1.5 print:text-slate-800 print:truncate" title={item.produto_nome}>
                          {item.produto_nome || "Produção"}
                        </td>
                        <td className="p-3 text-right font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap print:p-1.5 print:text-slate-950">
                          + {formatarMoeda(Number(item.valor_comissao) || 0)}
                          <span className="block text-[8pt] font-normal text-muted-foreground print:text-slate-500">
                            (OS: {formatarMoeda(Number(item.valor_pedido) || 0)})
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO DA ABA 3: MEMBROS & ACESSOS (CLERK + TELEFONES) */}
      {abaAtiva === "membros" && (
        <div className="flex flex-col gap-6">
          {/* Link de Cadastro */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
            <p className="mb-1 text-sm font-bold text-foreground">Link de cadastro para a Equipe</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Envie este link para qualquer novo funcionário da empresa criar o login dele. Após o cadastro, você pode definir o papel de acesso dele logo abaixo.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 truncate rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-mono text-muted-foreground">
                {linkCadastro}
              </div>
              <button
                type="button"
                onClick={copiarLink}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold transition-colors hover:bg-accent cursor-pointer"
              >
                {copiado ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copiado ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>

          {/* WhatsApp Notificações Automáticas */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                  Notificações no WhatsApp da Equipe
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                    Ativo
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  A cada nova OS assinada, demanda na produção ou emergência no telão, o robô avisa estes números automaticamente.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {telefonesProducao.map((tel) => {
                const numLimpo = tel.replace(/^55/, "")
                const formatado =
                  numLimpo.length === 11
                    ? `(${numLimpo.slice(0, 2)}) ${numLimpo.slice(2, 7)}-${numLimpo.slice(7)}`
                    : tel

                return (
                  <div
                    key={tel}
                    className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-muted/30 px-3 py-1.5 text-xs font-medium"
                  >
                    <Phone className="h-3 w-3 text-emerald-600" />
                    <span>+55 {formatado}</span>
                    <button
                      type="button"
                      onClick={() => removerTelefone(tel)}
                      disabled={salvandoTelefones}
                      className="ml-1 text-muted-foreground hover:text-red-500 transition-colors p-0.5"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-2 pt-1 max-w-sm">
              <Input
                placeholder="DDD + WhatsApp (ex: 28999887766)"
                value={novoTelefone}
                onChange={(e) => setNovoTelefone(e.target.value)}
                className="text-xs"
              />
              <Button
                type="button"
                size="sm"
                onClick={adicionarTelefone}
                disabled={salvandoTelefones}
                className="gap-1 text-xs font-bold"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Adicionar</span>
              </Button>
            </div>
          </div>

          {/* Tabela de Membros Cadastrados */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-black text-foreground uppercase tracking-wider">
              Usuários e Permissões do Sistema
            </h2>

            {carregandoMembros ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Carregando membros...</div>
            ) : (
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border/80 font-black text-muted-foreground uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Colaborador</th>
                        <th className="p-3">E-mail</th>
                        <th className="p-3">Último Acesso</th>
                        <th className="p-3 text-right">Papel / Acesso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {membros.map((m) => (
                        <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar nome={m.nome} imagemUrl={m.imagemUrl} />
                              <span className="font-bold text-foreground">{m.nome}</span>
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground font-mono text-[11px]">
                            {m.email}
                          </td>
                          <td className="p-3 text-muted-foreground whitespace-nowrap">
                            {m.ultimoLogin
                              ? new Date(m.ultimoLogin).toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Nunca acessou"}
                          </td>
                          <td className="p-3 text-right">
                            <Select
                              value={m.papel}
                              onValueChange={(val) => atualizarPapel(m.id, val as Papel)}
                            >
                              <SelectTrigger className="w-[140px] ml-auto text-xs font-bold">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="dono">Dono (Acesso Total)</SelectItem>
                                <SelectItem value="financeiro">Financeiro</SelectItem>
                                <SelectItem value="producao">Produção</SelectItem>
                                <SelectItem value="operador">Colaborador</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Pagamento de Comissões */}
      <Dialog open={!!modalPagamento} onOpenChange={(open) => !open && setModalPagamento(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-600" />
              <span>Pagar & Emitir Recibo Oficial</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Dar baixa nas comissões semanais e gerar o Recibo Oficial com assinatura e logo da Toldos Print.
            </DialogDescription>
          </DialogHeader>

          {modalPagamento && (
            <div className="flex flex-col gap-3 py-2 text-xs">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase block">
                    Colaborador: {modalPagamento.colaborador.colaborador_nome}
                  </span>
                  <span className="text-xs text-muted-foreground block mt-0.5">
                    {modalPagamento.colaborador.quantidade_pendente} peças prontas
                  </span>
                </div>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  R$ {modalPagamento.colaborador.total_pendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Forma de Pagamento */}
              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-foreground text-[11px]">Forma de Pagamento:</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "pix", label: "PIX", icon: "⚡" },
                    { id: "dinheiro", label: "Dinheiro", icon: "💵" },
                    { id: "deposito", label: "Depósito", icon: "🏦" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() =>
                        setModalPagamento((prev) => (prev ? { ...prev, formaPagamento: f.id as any } : prev))
                      }
                      className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                        modalPagamento.formaPagamento === f.id
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/80"
                      }`}
                    >
                      <span>{f.icon}</span>
                      <span>{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipo de Assinatura */}
              <div className="flex flex-col gap-1.5">
                <span className="font-bold text-foreground text-[11px]">Tipo de Assinatura no Recibo:</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "fisica", label: "Imprimir (Caneta)", icon: "🖨️" },
                    { id: "digital", label: "Assinar na Tela", icon: "✍️" },
                  ].map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() =>
                        setModalPagamento((prev) => (prev ? { ...prev, tipoAssinatura: a.id as any } : prev))
                      }
                      className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                        modalPagamento.tipoAssinatura === a.id
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/80"
                      }`}
                    >
                      <span>{a.icon}</span>
                      <span>{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                <div>
                  <span className="font-bold text-foreground block">Lançar no Financeiro</span>
                  <span className="text-[11px] text-muted-foreground block">
                    Cria automaticamente uma despesa de comissão no módulo financeiro
                  </span>
                </div>
                <Switch
                  checked={modalPagamento.lancarFinanceiro}
                  onCheckedChange={(c) =>
                    setModalPagamento((prev) => (prev ? { ...prev, lancarFinanceiro: c } : prev))
                  }
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-bold text-muted-foreground text-[11px]">Observação / Comprovante:</span>
                <Input
                  value={modalPagamento.observacao}
                  onChange={(e) =>
                    setModalPagamento((prev) => (prev ? { ...prev, observacao: e.target.value } : prev))
                  }
                  className="text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalPagamento(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={confirmarPagamento}
              disabled={salvandoPagamento}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
            >
              <Receipt className="h-4 w-4" />
              <span>{salvandoPagamento ? "Gravando e Gerando Recibo..." : "Confirmar e Emitir Recibo"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Elegibilidade de Bônus (Quem Recebe Bônus) */}
      <Dialog open={dialogElegibilidadeAberto} onOpenChange={setDialogElegibilidadeAberto}>
        <DialogContent className="sm:max-w-xl max-h-[88vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-border bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-foreground">
                  Quem Recebe Bônus de Produção
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Selecione quem acumula bônus ao finalizar peças no Controle de Qualidade da fábrica.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-3">
            {carregandoElegibilidade ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground font-medium">Carregando colaboradores...</span>
              </div>
            ) : listaElegibilidade.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                Nenhum colaborador encontrado no sistema.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {listaElegibilidade.map((item, idx) => {
                  const isAtivo = item.recebe_bonus
                  return (
                    <div
                      key={item.colaborador_id || item.colaborador_nome}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border transition-all gap-3 ${
                        isAtivo
                          ? "bg-card border-border/80 shadow-xs"
                          : "bg-muted/30 border-dashed border-border/60 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar nome={item.colaborador_nome} imagemUrl={item.imagemUrl || ""} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-foreground truncate">
                              {item.colaborador_nome}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                corPapel[item.papel] || "bg-muted text-muted-foreground"
                              }`}
                            >
                              {rotuloPapel[item.papel] || item.papel}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.email || "Sem e-mail cadastrado"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                        <div className="text-left sm:text-right">
                          <span
                            className={`text-xs font-bold block ${
                              isAtivo ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                            }`}
                          >
                            {isAtivo ? "Recebe Bônus" : "Não Recebe"}
                          </span>
                          <span className="text-[10px] text-muted-foreground block">
                            {isAtivo ? "Pontua na produção" : "Inapto / Bloqueado"}
                          </span>
                        </div>

                        <Switch
                          checked={item.recebe_bonus}
                          onCheckedChange={(checked) => {
                            setListaElegibilidade((prev) =>
                              prev.map((c, i) => (i === idx ? { ...c, recebe_bonus: checked } : c))
                            )
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2.5 mt-2">
              <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
                <strong className="font-bold">Flexibilidade total:</strong> Desative quem não deve participar do rateio de bônus (ex: diretores, administradores ou terceirizados). Ao concluir demandas na produção, apenas os membros marcados como ativos terão comissões geradas.
              </p>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border bg-muted/10 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogElegibilidadeAberto(false)}
              disabled={salvandoElegibilidade}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={salvarElegibilidade}
              disabled={salvandoElegibilidade || carregandoElegibilidade}
              className="text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {salvandoElegibilidade ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Salvar Regras</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regras de Estilo de Documento Oficial A4 para Impressão */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 12mm 10mm 12mm 10mm;
        }
        @media print {
          html, body {
            background: white !important;
            color: #0f172a !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          aside, header, nav, .print\\:hidden {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            overflow: visible !important;
          }
          table {
            width: 100% !important;
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  )
}
