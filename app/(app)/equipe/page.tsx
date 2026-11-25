"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
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
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
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

export default function EquipePage() {
  const router = useRouter()
  const { verComo } = usePapelAtivo()

  // Aba ativa: "extrato" (Fechamento da Semana) | "historico" | "membros"
  const [abaAtiva, setAbaAtiva] = useState<"extrato" | "historico" | "membros">("extrato")

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

  // Filtros do Histórico
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

  useEffect(() => {
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
  }, [carregarDadosComissoes])

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
    return comissoes.filter((c) => {
      if (filtroStatus !== "todos" && c.status !== filtroStatus) return false
      if (filtroColaborador !== "todos" && c.colaborador_nome !== filtroColaborador) return false
      if (buscaHistorico.trim()) {
        const termo = buscaHistorico.toLowerCase()
        const matchCliente = c.cliente_nome?.toLowerCase().includes(termo)
        const matchNumero = String(c.numero).includes(termo)
        const matchProduto = c.produto_nome?.toLowerCase().includes(termo)
        if (!matchCliente && !matchNumero && !matchProduto) return false
      }
      return true
    })
  }, [comissoes, filtroStatus, filtroColaborador, buscaHistorico])

  return (
    <div className="flex flex-col gap-5 sm:gap-6 pb-12">
      {/* Cabeçalho Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users2 className="h-5 w-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              Equipe & RH
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Gestão de colaboradores, conta-corrente de comissões de produção e controle de acessos.
          </p>
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

      {/* Navegação entre as 3 Abas Principais */}
      <div className="flex border-b border-border gap-2 sm:gap-4 overflow-x-auto [scrollbar-width:none]">
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
          <span>Extrato da Semana (Fechamento)</span>
          {totalPendenteGeral > 0 && (
            <span className="rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-black">
              R$ {totalPendenteGeral.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          )}
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
          <span>Histórico de Comissões</span>
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
          <span>Membros & Acessos</span>
          <span className="rounded-full bg-muted text-muted-foreground px-1.5 py-0.2 text-[10px] font-black">
            {membros.length}
          </span>
        </button>
      </div>

      {/* CONTEÚDO DA ABA 1: EXTRATO DA SEMANA / FECHAMENTO */}
      {abaAtiva === "extrato" && (
        <div className="flex flex-col gap-5">
          {/* Métricas do Fechamento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                  A Pagar Neste Fim de Semana
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-950 dark:text-emerald-100 mt-1 block">
                  R$ {totalPendenteGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center text-2xl shrink-0">
                🪙
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Total Já Pago (Quitado)
                </span>
                <span className="text-2xl sm:text-3xl font-black text-foreground mt-1 block">
                  R$ {totalPagoGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-blue-500/15 text-blue-600 flex items-center justify-center text-xl shrink-0">
                ✓
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Colaboradores com Bônus
                </span>
                <span className="text-2xl sm:text-3xl font-black text-foreground mt-1 block">
                  {resumoColaboradores.filter((r) => r.total_pendente > 0).length} de {resumoColaboradores.length}
                </span>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center text-xl shrink-0">
                👥
              </div>
            </div>
          </div>

          {/* Lista de Cards por Colaborador */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-black text-foreground uppercase tracking-wider">
              Fechamento por Colaborador
            </h2>

            {resumoColaboradores.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
                <span className="text-3xl block">🪙</span>
                <p className="font-bold text-foreground text-sm mt-2">Nenhum bônus creditado ainda</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quando uma peça for finalizada na tela de Produção com comissão ativa, o valor cairá automaticamente aqui.
                </p>
              </div>
            ) : (
              resumoColaboradores.map((colab) => {
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
                        : "border-border/80 bg-muted/20 opacity-80"
                    }`}
                  >
                    {/* Cabeçalho do Card */}
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-lg font-black shrink-0">
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
                            Total acumulado histórico: R$ {(colab.total_pendente + colab.total_pago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ({colab.quantidade_pecas} peças)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block">
                            A Pagar
                          </span>
                          <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                            R$ {colab.total_pendente.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {colab.total_pendente > 0 && (
                            <>
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
                                <DollarSign className="h-3.5 w-3.5" />
                                <span>Pagar Agora</span>
                              </Button>

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
                            </>
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
                                  + R$ {Number(item.valor_comissao).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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

      {/* CONTEÚDO DA ABA 2: HISTÓRICO DE COMISSÕES */}
      {abaAtiva === "historico" && (
        <div className="flex flex-col gap-4">
          {/* Barra de Filtros */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por OS, cliente ou produto..."
                value={buscaHistorico}
                onChange={(e) => setBuscaHistorico(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Select value={filtroStatus} onValueChange={(v) => { if (v) setFiltroStatus(v) }}>
                <SelectTrigger className="w-[130px] text-xs font-bold">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="pago">Pagos</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filtroColaborador} onValueChange={(v) => { if (v) setFiltroColaborador(v) }}>
                <SelectTrigger className="w-[150px] text-xs font-bold">
                  <SelectValue placeholder="Colaborador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos da Equipe</SelectItem>
                  {resumoColaboradores.map((c) => (
                    <SelectItem key={c.colaborador_nome} value={c.colaborador_nome}>
                      {c.colaborador_nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lista de Registros */}
          {historicoFiltrado.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-muted-foreground text-xs font-medium">
              Nenhum registro encontrado para estes filtros.
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border/80 font-black text-muted-foreground uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3">Colaborador</th>
                      <th className="p-3">Demanda</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">Produto / Serviço</th>
                      <th className="p-3">Valor Total</th>
                      <th className="p-3 text-right">Bônus Creditado</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {historicoFiltrado.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {new Date(item.criado_em).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="p-3 font-black text-foreground">
                          {item.colaborador_nome}
                        </td>
                        <td className="p-3 font-bold text-primary whitespace-nowrap">
                          {item.origem_tipo === "orcamento" ? `OS #${item.numero}` : `#${item.numero}`}
                        </td>
                        <td className="p-3 font-medium text-foreground truncate max-w-[150px]">
                          {item.cliente_nome}
                        </td>
                        <td className="p-3 text-muted-foreground truncate max-w-[180px]">
                          {item.produto_nome || "Produção"}
                        </td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          R$ {Number(item.valor_pedido).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          + R$ {Number(item.valor_comissao).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {item.status === "pago" ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="rounded-full bg-slate-500/20 text-muted-foreground px-2 py-0.5 font-bold text-[10px]">
                                Pago ✓
                              </span>
                              {item.recibo_id && (
                                <Link
                                  href={`/equipe/recibo/${item.recibo_id}`}
                                  className="text-[10px] font-bold text-primary hover:underline inline-flex items-center gap-0.5"
                                  title="Abrir Recibo Oficial"
                                >
                                  Recibo ↗
                                </Link>
                              )}
                            </div>
                          ) : (
                            <span className="rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 font-black text-[10px]">
                              Pendente
                            </span>
                          )}
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
            <DialogTitle className="text-base font-black text-foreground">
              Confirmar Pagamento de Comissões
            </DialogTitle>
            <DialogDescription className="text-xs">
              Dar baixa nas comissões pendentes acumuladas pelo colaborador neste fechamento.
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {salvandoPagamento ? "Gravando..." : "Confirmar e Dar Baixa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
