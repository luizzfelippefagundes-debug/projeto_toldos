"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import Link from "next/link"
import {
  Tv2,
  Trash2,
  Plus,
  ExternalLink,
  Volume2,
  VolumeX,
  Search,
  RefreshCw,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  Sun,
  Moon,
  Layers,
  Sparkles,
  Radio,
  Clock,
  Zap,
  Minimize2,
  Maximize2,
  Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Aviso {
  id: string
  mensagem: string
  criado_em: string
  cor: string
  icone: string
  som: boolean
  ativo?: boolean
}

interface TvConfig {
  statusVisiveis: string[]
  tiposVisiveis: ("rapido" | "orcamento")[]
  mostrarAtrasados: boolean
  somAlarme: boolean
  tema: "light" | "dark"
  apenasRecentes?: boolean
  densidade?: "normal" | "compacto"
  tamanhoFonte?: "normal" | "grande"
  ocultarVazias?: boolean
}

const DEFAULT_TV_CONFIG: TvConfig = {
  statusVisiveis: ["aguardando", "aprovado", "ag_confirmacao", "impressao", "acabamento", "pronto"],
  tiposVisiveis: ["rapido", "orcamento"],
  mostrarAtrasados: true,
  somAlarme: true,
  tema: "dark",
  apenasRecentes: false,
  densidade: "normal",
  tamanhoFonte: "grande",
  ocultarVazias: true,
}

const TIPOS = [
  {
    tipo: "aviso",
    label: "Aviso",
    icone: "📢",
    cor: "azul",
    classe: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    ativo: "border-blue-600 bg-blue-600 text-white shadow-xs",
    corTexto: "text-blue-700 dark:text-blue-300",
  },
  {
    tipo: "atencao",
    label: "Atenção",
    icone: "⚠️",
    cor: "amarelo",
    classe: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    ativo: "border-amber-600 bg-amber-600 text-white shadow-xs",
    corTexto: "text-amber-800 dark:text-amber-300",
  },
  {
    tipo: "alerta",
    label: "Alerta",
    icone: "🚨",
    cor: "vermelho",
    classe: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
    ativo: "border-red-600 bg-red-600 text-white shadow-xs",
    corTexto: "text-red-700 dark:text-red-300",
  },
  {
    tipo: "ok",
    label: "Concluído",
    icone: "✅",
    cor: "verde",
    classe: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    ativo: "border-emerald-600 bg-emerald-600 text-white shadow-xs",
    corTexto: "text-emerald-700 dark:text-emerald-300",
  },
]

const ETAPAS_TV = [
  { id: "aguardando", label: "Ag. Assinatura", cor: "bg-slate-500" },
  { id: "aprovado", label: "Produção", cor: "bg-blue-600" },
  { id: "ag_confirmacao", label: "Arte Enviada", cor: "bg-pink-600" },
  { id: "impressao", label: "Impressão", cor: "bg-orange-600" },
  { id: "acabamento", label: "Acabamento", cor: "bg-amber-500" },
  { id: "pronto", label: "Pronto", cor: "bg-emerald-600" },
]

const MODELOS_RAPIDOS = [
  {
    titulo: "Retirada",
    icone: "🚚",
    tipoIdx: 1,
    texto: "Atenção equipe: Retirada de material agendada para hoje.",
    som: false,
  },
  {
    titulo: "Prioridade",
    icone: "⚡",
    tipoIdx: 2,
    texto: "Prioridade máxima de produção: pedido urgente em andamento!",
    som: true,
  },
  {
    titulo: "Instalação / Chuva",
    icone: "🌧️",
    tipoIdx: 1,
    texto: "Previsão de chuva: suspender instalações externas em altura.",
    som: false,
  },
  {
    titulo: "Manutenção",
    icone: "🔧",
    tipoIdx: 1,
    texto: "Máquina de impressão em calibração rápida. Retorno em breve.",
    som: false,
  },
  {
    titulo: "Meta Batida",
    icone: "🎉",
    tipoIdx: 3,
    texto: "Parabéns a toda a equipe: meta de produção do dia concluída!",
    som: false,
  },
]

function gerarId() {
  return `aviso-${Math.random().toString(36).slice(2, 10)}`
}

export default function CentralTvPage() {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [config, setConfig] = useState<TvConfig>(DEFAULT_TV_CONFIG)
  const [pedidosTvCount, setPedidosTvCount] = useState(0)
  const [carregando, setCarregando] = useState(true)

  // Formulário de novo aviso
  const [abaMobile, setAbaMobile] = useState<"config" | "avisos">("config")
  const [mensagem, setMensagem] = useState("")
  const [tipoIdx, setTipoIdx] = useState(0)
  const [som, setSom] = useState(false)
  const [salvandoAviso, setSalvandoAviso] = useState(false)

  // Filtros de avisos na central
  const [buscaAvisos, setBuscaAvisos] = useState("")
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativos" | "pausados">("todos")

  const carregarDados = useCallback(async () => {
    setCarregando(true)
    try {
      const [resAvisos, resConfig, resTv] = await Promise.all([
        fetch("/api/avisos-tv"),
        fetch("/api/tv/config"),
        fetch("/api/tv/pedidos"),
      ])

      if (resAvisos.ok) {
        const dadosAvisos = await resAvisos.json()
        setAvisos(dadosAvisos)
      }
      if (resConfig.ok) {
        const dadosConfig = await resConfig.json()
        setConfig(dadosConfig)
      }
      if (resTv.ok) {
        const dadosTv = await resTv.json()
        setPedidosTvCount(Array.isArray(dadosTv.pedidos) ? dadosTv.pedidos.length : 0)
      }
    } catch (e) {
      console.error(e)
      toast.error("Erro ao carregar dados do painel TV")
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  const tipoSelecionado = TIPOS[tipoIdx]

  // Adicionar novo aviso
  async function adicionarAviso() {
    if (!mensagem.trim()) return
    setSalvandoAviso(true)
    const novo: Aviso = {
      id: gerarId(),
      mensagem: mensagem.trim(),
      criado_em: new Date().toISOString(),
      cor: tipoSelecionado.cor,
      icone: tipoSelecionado.icone,
      som,
      ativo: true,
    }

    try {
      const res = await fetch("/api/avisos-tv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(novo),
      })
      if (!res.ok) throw new Error()
      setAvisos((atual) => [novo, ...atual])
      setMensagem("")
      toast.success("Aviso publicado no telão da TV!")
    } catch {
      toast.error("Erro ao publicar aviso")
    } finally {
      setSalvandoAviso(false)
    }
  }

  // Alternar ativo/pausado
  async function alternarAtivoAviso(id: string, novoAtivo: boolean) {
    try {
      const res = await fetch(`/api/avisos-tv/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: novoAtivo }),
      })
      if (!res.ok) throw new Error()
      setAvisos((atual) =>
        atual.map((a) => (a.id === id ? { ...a, ativo: novoAtivo } : a))
      )
      toast.success(novoAtivo ? "Aviso colocado no ar na TV" : "Aviso pausado na TV")
    } catch {
      toast.error("Erro ao atualizar aviso")
    }
  }

  // Remover aviso
  async function removerAviso(id: string) {
    try {
      const res = await fetch(`/api/avisos-tv/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setAvisos((atual) => atual.filter((a) => a.id !== id))
      toast.success("Aviso excluído.")
    } catch {
      toast.error("Erro ao excluir aviso")
    }
  }

  // Salvar configurações do telão
  async function salvarConfiguracoes(nova: Partial<TvConfig>) {
    const atualizada = { ...config, ...nova }
    setConfig(atualizada)
    try {
      const res = await fetch("/api/tv/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(atualizada),
      })
      if (!res.ok) throw new Error()
      toast.success("Configuração do telão salva!")
      const resTv = await fetch("/api/tv/pedidos")
      if (resTv.ok) {
        const dadosTv = await resTv.json()
        setPedidosTvCount(Array.isArray(dadosTv.pedidos) ? dadosTv.pedidos.length : 0)
      }
    } catch {
      toast.error("Erro ao salvar configurações do telão")
    }
  }

  // Avisos filtrados para a listagem
  const avisosFiltrados = useMemo(() => {
    return avisos.filter((a) => {
      if (filtroStatus === "ativos" && a.ativo === false) return false
      if (filtroStatus === "pausados" && a.ativo !== false) return false
      if (buscaAvisos) {
        const termo = buscaAvisos.toLowerCase()
        if (!a.mensagem.toLowerCase().includes(termo)) return false
      }
      return true
    })
  }, [avisos, filtroStatus, buscaAvisos])

  const totalAtivos = avisos.filter((a) => a.ativo !== false).length

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Cabeçalho Superior Adaptável ao Mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
            <Tv2 className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground truncate">
                Central do Telão
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Telão Ativo
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
              Gerencie em tempo real etapas, filtros, letreiro e visualização da TV da fábrica.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={carregando}
            className="flex-1 sm:flex-none h-8.5 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", carregando && "animate-spin")} />
            <span>Atualizar</span>
          </Button>

          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/tv" target="_blank" />}
            className="flex-1 sm:flex-none h-8.5 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-xs"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Abrir Telão (/tv)</span>
          </Button>
        </div>
      </div>

      {/* Grid de 4 Métricas Compactas e Responsivas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="rounded-xl border border-border bg-card p-3 sm:p-3.5 flex items-center gap-2.5 sm:gap-3 shadow-2xs">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
            <Radio className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium truncate">Pedidos na TV</p>
            <div className="flex items-center gap-1.5">
              <p className="text-base sm:text-lg font-black text-foreground leading-tight">{pedidosTvCount}</p>
              {config.apenasRecentes && (
                <span className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.2 shrink-0">
                  5 recentes
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 sm:p-3.5 flex items-center gap-2.5 sm:gap-3 shadow-2xs">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <Layers className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium truncate">Colunas Ativas</p>
            <p className="text-base sm:text-lg font-black text-foreground leading-tight">
              {config.statusVisiveis.length} de {ETAPAS_TV.length}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 sm:p-3.5 flex items-center gap-2.5 sm:gap-3 shadow-2xs">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium truncate">Avisos no Ticker</p>
            <p className="text-base sm:text-lg font-black text-foreground leading-tight">
              {totalAtivos}{" "}
              <span className="text-[10px] font-normal text-muted-foreground">({avisos.length} total)</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 sm:p-3.5 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400">
              {config.tema === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium truncate">Tema da TV</p>
              <p className="text-xs sm:text-sm font-bold text-foreground capitalize leading-tight truncate">
                {config.tema === "light" ? "Modo Claro" : "Modo Escuro"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => salvarConfiguracoes({ tema: config.tema === "light" ? "dark" : "light" })}
            className="h-6.5 px-2 text-[10px] font-bold shrink-0"
          >
            Trocar
          </Button>
        </div>
      </div>

      {/* Alternador de Abas Mobile (Configurações vs Letreiro) */}
      <div className="flex lg:hidden rounded-xl bg-muted/60 p-1 border border-border/70 shadow-2xs">
        <button
          type="button"
          onClick={() => setAbaMobile("config")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all",
            abaMobile === "config"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
          <span>Configuração da TV</span>
        </button>

        <button
          type="button"
          onClick={() => setAbaMobile("avisos")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all",
            abaMobile === "avisos"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <span>Letreiro & Avisos</span>
          {totalAtivos > 0 && (
            <span className="rounded-full bg-primary/15 text-primary text-[10px] px-1.5 py-0.2 font-black">
              {totalAtivos}
            </span>
          )}
        </button>
      </div>

      {/* Grid Principal em 2 Colunas Lado a Lado (7/5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUNA ESQUERDA: GESTÃO DO LETREIRO DE AVISOS */}
        <div
          className={cn(
            "lg:col-span-7 flex flex-col gap-4 sm:gap-5 order-2 lg:order-1",
            abaMobile === "avisos" ? "flex" : "hidden lg:flex"
          )}
        >
          {/* Card: Criar Novo Aviso */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Novo Aviso para o Rodapé do Telão
              </h2>
              <span className="text-xs text-muted-foreground">
                {140 - mensagem.length} caracteres
              </span>
            </div>

            {/* Modelos Rápidos de 1 Clique */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3 text-amber-500" />
                Modelos prontos (toque para preencher):
              </span>
              <div className="flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap [scrollbar-width:none]">
                {MODELOS_RAPIDOS.map((m) => (
                  <button
                    key={m.titulo}
                    type="button"
                    onClick={() => {
                      setMensagem(m.texto)
                      setTipoIdx(m.tipoIdx)
                      setSom(m.som)
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/40 hover:bg-muted px-2 py-1 text-xs font-medium text-foreground transition-colors cursor-pointer"
                  >
                    <span>{m.icone}</span>
                    <span>{m.titulo}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Seletor de Tipo */}
            <div className="flex flex-wrap gap-1.5">
              {TIPOS.map((t, i) => (
                <button
                  key={t.tipo}
                  type="button"
                  onClick={() => setTipoIdx(i)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                    tipoIdx === i ? t.ativo : t.classe
                  )}
                >
                  <span>{t.icone}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Campo de Texto + Bip + Botão */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && adicionarAviso()}
                placeholder="Ex: Material da Capacio liberado para produção..."
                maxLength={140}
                className="h-10 text-xs sm:text-sm bg-background flex-1"
              />

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSom((v) => !v)}
                  title={som ? "Alarme sonoro ativo" : "Sem alarme sonoro"}
                  className={cn(
                    "flex items-center gap-1 rounded-lg border px-2.5 h-10 text-xs font-medium transition-colors cursor-pointer",
                    som
                      ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold"
                      : "border-border text-muted-foreground hover:text-foreground bg-background"
                  )}
                >
                  {som ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                  <span>{som ? "Com Som" : "Sem Som"}</span>
                </button>

                <Button
                  onClick={adicionarAviso}
                  disabled={!mensagem.trim() || salvandoAviso}
                  className="h-10 px-3.5 gap-1.5 text-xs font-bold"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Publicar</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Card: Lista de Avisos Cadastrados */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Avisos do Letreiro ({avisos.length})
              </h2>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setFiltroStatus("todos")}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-semibold transition-all",
                    filtroStatus === "todos"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  Todos ({avisos.length})
                </button>
                <button
                  onClick={() => setFiltroStatus("ativos")}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-semibold transition-all",
                    filtroStatus === "ativos"
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  No ar ({totalAtivos})
                </button>
                <button
                  onClick={() => setFiltroStatus("pausados")}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-semibold transition-all",
                    filtroStatus === "pausados"
                      ? "bg-amber-600 text-white shadow-2xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  Pausados ({avisos.length - totalAtivos})
                </button>
              </div>
            </div>

            {/* Barra de Busca de Avisos */}
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar avisos pelo texto..."
                value={buscaAvisos}
                onChange={(e) => setBuscaAvisos(e.target.value)}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>

            {/* Itens da Lista */}
            {avisosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2 border border-dashed border-border rounded-xl p-4">
                <Tv2 className="h-8 w-8 opacity-25" />
                <p className="text-xs font-medium">Nenhum aviso encontrado.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
                {avisosFiltrados.map((aviso) => {
                  const tipo = TIPOS.find((t) => t.cor === aviso.cor) ?? TIPOS[0]
                  const ativo = aviso.ativo !== false

                  return (
                    <div
                      key={aviso.id}
                      className={cn(
                        "flex items-start justify-between gap-3 rounded-xl border p-3 transition-all bg-card shadow-2xs",
                        ativo ? "border-border/80" : "border-border/40 opacity-60 bg-muted/20"
                      )}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="text-base shrink-0 mt-0.5">{aviso.icone ?? "📢"}</span>
                        <div className="min-w-0">
                          <p className={cn("text-xs font-semibold leading-snug", tipo.corTexto)}>
                            {aviso.mensagem}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                            <span className={cn("rounded px-1.5 py-0.2 font-bold", tipo.classe)}>
                              {tipo.label}
                            </span>
                            {aviso.som && (
                              <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-semibold">
                                <Volume2 className="h-2.5 w-2.5" /> Bip
                              </span>
                            )}
                            <span>•</span>
                            <span>
                              {new Date(aviso.criado_em).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className={cn("font-medium", ativo ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                            {ativo ? "No ar" : "Pausado"}
                          </span>
                          <Switch
                            checked={ativo}
                            onCheckedChange={(val) => alternarAtivoAviso(aviso.id, val)}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => removerAviso(aviso.id)}
                          className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Excluir aviso"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: FILTROS DA TV E SIMULADOR */}
        <div
          className={cn(
            "lg:col-span-5 flex flex-col gap-4 sm:gap-5 order-1 lg:order-2",
            abaMobile === "config" ? "flex" : "hidden lg:flex"
          )}
        >
          {/* Card: Mini Simulador ao Vivo */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 text-white p-3.5 sm:p-4 shadow-md flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold uppercase tracking-wider text-[10px] text-slate-300">
                  Telão em Tempo Real
                </span>
                {config.apenasRecentes && (
                  <span className="rounded-full bg-amber-400/20 text-amber-300 px-1.5 py-0.5 text-[9px] font-bold">
                    ⚡ 5 Recentes
                  </span>
                )}
              </div>
              <Link
                href="/tv"
                target="_blank"
                className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>Abrir Telão</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            </div>

            {/* Simulação das Colunas */}
            <div className="grid grid-cols-3 gap-1.5 text-center my-1">
              {ETAPAS_TV.map((etapa) => {
                const ativa = config.statusVisiveis.includes(etapa.id)
                return (
                  <div
                    key={etapa.id}
                    className={cn(
                      "rounded p-1.5 text-[10px] flex items-center justify-center gap-1 border",
                      ativa
                        ? "bg-slate-900 border-slate-700 text-slate-200 font-semibold"
                        : "bg-slate-950/40 border-slate-900 text-slate-600 opacity-40 line-through"
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", etapa.cor)} />
                    <span className="truncate">{etapa.label}</span>
                  </div>
                )
              })}
            </div>

            {/* Simulação do Letreiro */}
            <div className="rounded-md bg-slate-900 border border-slate-800 p-2 text-xs overflow-hidden flex items-center gap-2">
              <span className="rounded bg-primary/20 text-primary-foreground text-[9px] font-bold px-1 py-0.2 shrink-0 uppercase">
                Rodapé
              </span>
              {totalAtivos === 0 ? (
                <span className="text-[11px] text-slate-500 italic">Nenhum aviso no ar.</span>
              ) : (
                <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap text-[11px] text-slate-300">
                  {avisos
                    .filter((a) => a.ativo !== false)
                    .map((a) => (
                      <span key={a.id} className="flex items-center gap-1">
                        <span>{a.icone}</span>
                        <span className={a.cor === "vermelho" ? "text-red-400 font-bold" : a.cor === "amarelo" ? "text-yellow-400" : "text-blue-300"}>
                          {a.mensagem}
                        </span>
                      </span>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Card: Filtros do que Mostrar no Telão */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  Filtros de Exibição do Telão
                </h2>
                <p className="text-xs text-muted-foreground">
                  Selecione o que a TV da fábrica deve mostrar.
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    salvarConfiguracoes({ statusVisiveis: ETAPAS_TV.map((e) => e.id) })
                  }
                  className="rounded px-2 py-0.5 text-xs text-primary hover:underline font-semibold"
                >
                  Todas
                </button>
                <span className="text-muted-foreground text-xs">•</span>
                <button
                  type="button"
                  onClick={() =>
                    salvarConfiguracoes({
                      statusVisiveis: ["aprovado", "ag_confirmacao", "impressao", "acabamento"],
                    })
                  }
                  className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Só Ativas
                </button>
              </div>
            </div>

            {/* Seletor das 6 Etapas */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-foreground">Etapas / Colunas no Telão:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ETAPAS_TV.map((etapa) => {
                  const ativa = config.statusVisiveis.includes(etapa.id)
                  return (
                    <label
                      key={etapa.id}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all text-xs",
                        ativa ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20 opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn("h-2 w-2 rounded-full shrink-0", etapa.cor)} />
                        <span className={cn("font-medium truncate", ativa ? "text-foreground" : "text-muted-foreground")}>
                          {etapa.label}
                        </span>
                      </div>
                      <Switch
                        checked={ativa}
                        onCheckedChange={(checked) => {
                          let nova: string[]
                          if (checked) {
                            nova = [...config.statusVisiveis, etapa.id]
                          } else {
                            if (config.statusVisiveis.length <= 1) {
                              toast.error("O telão precisa de ao menos uma coluna.")
                              return
                            }
                            nova = config.statusVisiveis.filter((id) => id !== etapa.id)
                          }
                          salvarConfiguracoes({ statusVisiveis: nova })
                        }}
                      />
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Tipos de Pedidos */}
            <div className="flex flex-col gap-2 border-t border-border/50 pt-3">
              <span className="text-xs font-semibold text-foreground">Tipos de Pedidos no Telão:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background cursor-pointer text-xs">
                  <span className="font-medium text-foreground">Gráfica Rápida</span>
                  <Switch
                    checked={config.tiposVisiveis.includes("rapido")}
                    onCheckedChange={(checked) => {
                      if (!checked && !config.tiposVisiveis.includes("orcamento")) {
                        toast.error("Ao menos um tipo deve estar ativo.")
                        return
                      }
                      const nova = checked
                        ? [...config.tiposVisiveis, "rapido" as const]
                        : config.tiposVisiveis.filter((t) => t !== "rapido")
                      salvarConfiguracoes({ tiposVisiveis: nova })
                    }}
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background cursor-pointer text-xs">
                  <span className="font-medium text-foreground">Ordens de Serviço</span>
                  <Switch
                    checked={config.tiposVisiveis.includes("orcamento")}
                    onCheckedChange={(checked) => {
                      if (!checked && !config.tiposVisiveis.includes("rapido")) {
                        toast.error("Ao menos um tipo deve estar ativo.")
                        return
                      }
                      const nova = checked
                        ? [...config.tiposVisiveis, "orcamento" as const]
                        : config.tiposVisiveis.filter((t) => t !== "orcamento")
                      salvarConfiguracoes({ tiposVisiveis: nova })
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Preferências de Alarme, Atrasados e Filtro de Recentes */}
            <div className="flex flex-col gap-2 border-t border-border/50 pt-3">
              <span className="text-xs font-semibold text-foreground">Comportamento do Telão:</span>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background text-xs">
                  <div className="flex items-center gap-2">
                    <Maximize2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <div>
                      <span className="font-medium text-foreground block">Expandir Ativas (Ocultar Vazias)</span>
                      <span className="text-[11px] text-muted-foreground block">
                        Oculta colunas sem pedidos para que as com trabalho ocupem a tela inteira em destaque
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={config.ocultarVazias ?? false}
                    onCheckedChange={(checked) => salvarConfiguracoes({ ocultarVazias: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background text-xs">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-blue-500 shrink-0" />
                    <div>
                      <span className="font-medium text-foreground block">Fonte Grande (Leitura de Longe)</span>
                      <span className="text-[11px] text-muted-foreground block">
                        Aumenta os nomes dos clientes e pedidos para visualização nítida a metros de distância
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={config.tamanhoFonte !== "normal"}
                    onCheckedChange={(checked) =>
                      salvarConfiguracoes({ tamanhoFonte: checked ? "grande" : "normal" })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background text-xs">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                    <div>
                      <span className="font-medium text-foreground block">Apenas 5 Mais Recentes</span>
                      <span className="text-[11px] text-muted-foreground block">
                        Limita a TV aos últimos 5 pedidos que entraram no sistema
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={config.apenasRecentes ?? false}
                    onCheckedChange={(checked) => salvarConfiguracoes({ apenasRecentes: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background text-xs">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-amber-500 shrink-0" />
                    <div>
                      <span className="font-medium text-foreground block">Alarme Sonoro da TV</span>
                      <span className="text-[11px] text-muted-foreground block">
                        Toca bipe se houver aviso com sirene ativa
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={config.somAlarme}
                    onCheckedChange={(checked) => salvarConfiguracoes({ somAlarme: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background text-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    <div>
                      <span className="font-medium text-foreground block">Destacar Pedidos Atrasados</span>
                      <span className="text-[11px] text-muted-foreground block">
                        Prioriza e alerta prazos vencidos no topo
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={config.mostrarAtrasados}
                    onCheckedChange={(checked) => salvarConfiguracoes({ mostrarAtrasados: checked })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
