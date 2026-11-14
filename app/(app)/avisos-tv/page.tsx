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
  Eye,
  EyeOff,
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
}

const DEFAULT_TV_CONFIG: TvConfig = {
  statusVisiveis: ["aguardando", "aprovado", "ag_confirmacao", "impressao", "acabamento", "pronto"],
  tiposVisiveis: ["rapido", "orcamento"],
  mostrarAtrasados: true,
  somAlarme: true,
  tema: "dark",
}

const TIPOS = [
  {
    tipo: "aviso",
    label: "Aviso",
    icone: "📢",
    cor: "azul",
    classe: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    ativo: "border-blue-600 bg-blue-600 text-white shadow-xs",
    corTexto: "text-blue-600 dark:text-blue-400",
  },
  {
    tipo: "atencao",
    label: "Atenção",
    icone: "⚠️",
    cor: "amarelo",
    classe: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    ativo: "border-amber-600 bg-amber-600 text-white shadow-xs",
    corTexto: "text-amber-600 dark:text-amber-400",
  },
  {
    tipo: "alerta",
    label: "Alerta",
    icone: "🚨",
    cor: "vermelho",
    classe: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
    ativo: "border-red-600 bg-red-600 text-white shadow-xs",
    corTexto: "text-red-600 dark:text-red-400",
  },
  {
    tipo: "ok",
    label: "Concluído / OK",
    icone: "✅",
    cor: "verde",
    classe: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    ativo: "border-emerald-600 bg-emerald-600 text-white shadow-xs",
    corTexto: "text-emerald-600 dark:text-emerald-400",
  },
]

const ETAPAS_TV = [
  { id: "aguardando", label: "Ag. Assinatura", cor: "bg-slate-500", desc: "Pedidos esperando confirmação" },
  { id: "aprovado", label: "Produção", cor: "bg-blue-600", desc: "Fila de produção aprovada" },
  { id: "ag_confirmacao", label: "Arte Enviada", cor: "bg-pink-600", desc: "Aguardando aprovação de arte" },
  { id: "impressao", label: "Impressão", cor: "bg-orange-600", desc: "Imprimindo na máquina" },
  { id: "acabamento", label: "Acabamento", cor: "bg-amber-500", desc: "Corte, solda e montagem" },
  { id: "pronto", label: "Pronto", cor: "bg-emerald-600", desc: "Pronto para entrega ou retirada" },
]

function gerarId() {
  return `aviso-${Math.random().toString(36).slice(2, 10)}`
}

export default function CentralTvPage() {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [config, setConfig] = useState<TvConfig>(DEFAULT_TV_CONFIG)
  const [pedidosTvCount, setPedidosTvCount] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [salvandoConfig, setSalvandoConfig] = useState(false)

  // Formulário de novo aviso
  const [mensagem, setMensagem] = useState("")
  const [tipoIdx, setTipoIdx] = useState(0)
  const [som, setSom] = useState(false)
  const [salvandoAviso, setSalvandoAviso] = useState(false)

  // Filtros de avisos na central
  const [buscaAvisos, setBuscaAvisos] = useState("")
  const [filtroTipo, setFiltroTipo] = useState<string>("todos")
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativos" | "pausados">("todos")

  // Aba ativa na central
  const [abaAtiva, setAbaAtiva] = useState<"avisos" | "filtros" | "preview">("avisos")

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
    setSalvandoConfig(true)
    try {
      const res = await fetch("/api/tv/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(atualizada),
      })
      if (!res.ok) throw new Error()
      toast.success("Configuração do telão salva com sucesso!")
      // Atualiza a contagem de pedidos na TV
      const resTv = await fetch("/api/tv/pedidos")
      if (resTv.ok) {
        const dadosTv = await resTv.json()
        setPedidosTvCount(Array.isArray(dadosTv.pedidos) ? dadosTv.pedidos.length : 0)
      }
    } catch {
      toast.error("Erro ao salvar configurações do telão")
    } finally {
      setSalvandoConfig(false)
    }
  }

  // Avisos filtrados para a listagem
  const avisosFiltrados = useMemo(() => {
    return avisos.filter((a) => {
      if (filtroTipo !== "todos" && a.cor !== filtroTipo) return false
      if (filtroStatus === "ativos" && a.ativo === false) return false
      if (filtroStatus === "pausados" && a.ativo !== false) return false
      if (buscaAvisos) {
        const termo = buscaAvisos.toLowerCase()
        if (!a.mensagem.toLowerCase().includes(termo)) return false
      }
      return true
    })
  }, [avisos, filtroTipo, filtroStatus, buscaAvisos])

  const totalAtivos = avisos.filter((a) => a.ativo !== false).length

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Cabeçalho da Central */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Tv2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Central do Painel TV</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Telão Online
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Gerencie em tempo real o que é exibido no telão da fábrica: letreiro de avisos, filtros de etapas e pedidos.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={carregando}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", carregando && "animate-spin")} />
            <span>Atualizar</span>
          </Button>

          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/tv" target="_blank" />}
            className="h-9 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Abrir Telão (/tv)</span>
          </Button>
        </div>
      </div>

      {/* Cards de Métricas da Central */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
            <Radio className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">Pedidos no Telão</p>
            <p className="text-xl font-bold text-foreground leading-tight">{pedidosTvCount}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <Layers className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">Etapas Exibidas</p>
            <p className="text-xl font-bold text-foreground leading-tight">
              {config.statusVisiveis.length} de {ETAPAS_TV.length}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">Avisos no Ticker</p>
            <p className="text-xl font-bold text-foreground leading-tight">
              {totalAtivos}{" "}
              <span className="text-xs font-normal text-muted-foreground">({avisos.length} total)</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
              {config.tema === "light" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">Tema do Telão</p>
              <p className="text-sm font-bold text-foreground capitalize leading-tight">
                {config.tema === "light" ? "Modo Claro" : "Modo Escuro"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => salvarConfiguracoes({ tema: config.tema === "light" ? "dark" : "light" })}
            className="h-8 px-2 text-xs"
            title="Alternar tema da TV"
          >
            Trocar
          </Button>
        </div>
      </div>

      {/* Mini Simulador / Live Preview do Telão */}
      <div className="rounded-2xl border border-border bg-slate-950 text-white p-4 shadow-md overflow-hidden relative">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold tracking-wider text-slate-300 uppercase text-[10px]">
              Simulador da TV em Tempo Real
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <span>{pedidosTvCount} pedidos transmitidos</span>
            <span>•</span>
            <span>{config.tiposVisiveis.join(" + ")}</span>
          </div>
        </div>

        {/* Colunas ativas simuladas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 my-3">
          {ETAPAS_TV.map((etapa) => {
            const ativa = config.statusVisiveis.includes(etapa.id)
            return (
              <div
                key={etapa.id}
                className={cn(
                  "rounded-lg p-2 text-center text-xs transition-opacity flex flex-col gap-1 border",
                  ativa
                    ? "bg-slate-900 border-slate-700 text-slate-200"
                    : "bg-slate-950/60 border-slate-900 text-slate-600 opacity-40 line-through"
                )}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", etapa.cor)} />
                  <span className="font-bold truncate">{etapa.label}</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {ativa ? "Exibindo na TV" : "Oculta"}
                </span>
              </div>
            )
          })}
        </div>

        {/* Barra de Letreiro (Ticker) Simulada */}
        <div className="mt-2 rounded-lg bg-slate-900/90 border border-slate-800 p-2.5 flex items-center gap-2 overflow-hidden">
          <span className="shrink-0 rounded bg-primary/20 text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 uppercase tracking-wide">
            Letreiro TV
          </span>
          {totalAtivos === 0 ? (
            <span className="text-xs text-slate-500 italic">Nenhum aviso ativo no letreiro da TV.</span>
          ) : (
            <div className="flex items-center gap-6 overflow-x-auto text-xs whitespace-nowrap text-slate-300 font-medium">
              {avisos
                .filter((a) => a.ativo !== false)
                .map((a) => (
                  <span key={a.id} className="flex items-center gap-1.5">
                    <span>{a.icone}</span>
                    <span className={a.cor === "vermelho" ? "text-red-400 font-bold" : a.cor === "amarelo" ? "text-yellow-400" : "text-blue-300"}>
                      {a.mensagem}
                    </span>
                    {a.som && <Volume2 className="h-3 w-3 text-amber-400 inline" />}
                  </span>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Abas de Navegação da Central */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setAbaAtiva("avisos")}
          className={cn(
            "pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 px-1",
            abaAtiva === "avisos"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Sparkles className="h-4 w-4" />
          <span>Letreiro de Avisos</span>
          <span className="rounded-full bg-muted px-2 py-0.2 text-[11px] font-bold">
            {avisos.length}
          </span>
        </button>

        <button
          onClick={() => setAbaAtiva("filtros")}
          className={cn(
            "pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 px-1",
            abaAtiva === "filtros"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Filtros do que Mostrar na TV</span>
          <span className="rounded-full bg-muted px-2 py-0.2 text-[11px] font-bold">
            {config.statusVisiveis.length}/{ETAPAS_TV.length}
          </span>
        </button>
      </div>

      {/* CONTEÚDO DA ABA 1: LETREIRO DE AVISOS */}
      {abaAtiva === "avisos" && (
        <div className="flex flex-col gap-6">
          {/* Formulário de Criação de Aviso */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-sm text-foreground flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Criar Novo Aviso para o Letreiro do Telão
              </span>
              <span className="text-xs text-muted-foreground">
                {140 - mensagem.length} caracteres restantes
              </span>
            </div>

            {/* Seletor de Tipo */}
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t, i) => (
                <button
                  key={t.tipo}
                  type="button"
                  onClick={() => setTipoIdx(i)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                    tipoIdx === i ? t.ativo : t.classe
                  )}
                >
                  <span>{t.icone}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Input + Alarme Sonoro + Botão */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Input
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && adicionarAviso()}
                  placeholder="Escreva a mensagem que vai passar no rodapé da TV..."
                  maxLength={140}
                  className="h-10 text-sm bg-background pr-8"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSom((v) => !v)}
                  title={som ? "Alarme sonoro ligado ao exibir" : "Sem alarme sonoro"}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 h-10 text-xs font-medium transition-colors cursor-pointer",
                    som
                      ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold"
                      : "border-border text-muted-foreground hover:text-foreground bg-background"
                  )}
                >
                  {som ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  <span>{som ? "Com Bip/Som" : "Sem Bip"}</span>
                </button>

                <Button
                  onClick={adicionarAviso}
                  disabled={!mensagem.trim() || salvandoAviso}
                  className="h-10 px-4 gap-1.5 font-bold"
                >
                  <Plus className="h-4 w-4" />
                  <span>Publicar no Telão</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Filtros da Lista de Avisos */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar avisos..."
                value={buscaAvisos}
                onChange={(e) => setBuscaAvisos(e.target.value)}
                className="pl-9 h-9 text-xs bg-background"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setFiltroStatus("todos")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
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
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
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
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                  filtroStatus === "pausados"
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                Pausados ({avisos.length - totalAtivos})
              </button>
            </div>
          </div>

          {/* Lista de Avisos */}
          {avisosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2 rounded-2xl border border-dashed border-border p-8 bg-card/40">
              <Tv2 className="h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">Nenhum aviso encontrado com os filtros atuais.</p>
              <p className="text-xs text-muted-foreground">
                Crie um aviso acima para que ele comece a passar no letreiro da fábrica.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {avisosFiltrados.map((aviso) => {
                const tipo = TIPOS.find((t) => t.cor === aviso.cor) ?? TIPOS[0]
                const ativo = aviso.ativo !== false

                return (
                  <div
                    key={aviso.id}
                    className={cn(
                      "flex flex-col justify-between gap-3 rounded-xl border p-4 transition-all bg-card shadow-2xs",
                      ativo ? "border-border/80" : "border-border/40 opacity-70 bg-muted/20"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl shrink-0">{aviso.icone ?? "📢"}</span>
                        <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold", tipo.classe)}>
                          {tipo.label}
                        </span>
                        {aviso.som && (
                          <span className="rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 text-[10px] font-bold flex items-center gap-1">
                            <Volume2 className="h-3 w-3" /> Bip ativo
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className={cn("text-[11px] font-semibold", ativo ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
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
                          className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Excluir aviso"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <p className={cn("text-sm font-medium leading-snug", tipo.corTexto)}>
                      {aviso.mensagem}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50 pt-2">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {new Date(aviso.criado_em).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono opacity-60">ID: {aviso.id}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: FILTROS DO QUE MOSTRAR NA TV */}
      {abaAtiva === "filtros" && (
        <div className="flex flex-col gap-6">
          {/* Bloco 1: Seleção de Etapas / Colunas no Telão */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Quais Etapas da Produção devem aparecer no Telão da TV?
                </h2>
                <p className="text-xs text-muted-foreground">
                  Desmarque as colunas que você NÃO quer que apareçam na TV da oficina (ex: Ocultar Ag. Assinatura ou Pronto).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    salvarConfiguracoes({ statusVisiveis: ETAPAS_TV.map((e) => e.id) })
                  }
                  className="h-8 text-xs font-semibold"
                >
                  Marcar Todas
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    salvarConfiguracoes({
                      statusVisiveis: ["aprovado", "ag_confirmacao", "impressao", "acabamento"],
                    })
                  }
                  className="h-8 text-xs"
                >
                  Só Produção Ativa
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ETAPAS_TV.map((etapa) => {
                const visivel = config.statusVisiveis.includes(etapa.id)

                return (
                  <label
                    key={etapa.id}
                    className={cn(
                      "flex items-start justify-between gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
                      visivel
                        ? "border-primary/50 bg-primary/5 shadow-2xs"
                        : "border-border bg-muted/20 opacity-60 hover:opacity-100"
                    )}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={cn("h-3 w-3 rounded-full shrink-0 mt-0.5", etapa.cor)} />
                      <div className="min-w-0">
                        <p className={cn("text-xs font-bold leading-tight", visivel ? "text-foreground" : "text-muted-foreground")}>
                          {etapa.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {etapa.desc}
                        </p>
                      </div>
                    </div>

                    <Switch
                      checked={visivel}
                      onCheckedChange={(checked) => {
                        let novaLista: string[]
                        if (checked) {
                          novaLista = [...config.statusVisiveis, etapa.id]
                        } else {
                          if (config.statusVisiveis.length <= 1) {
                            toast.error("O telão precisa de pelo menos uma coluna visível.")
                            return
                          }
                          novaLista = config.statusVisiveis.filter((id) => id !== etapa.id)
                        }
                        salvarConfiguracoes({ statusVisiveis: novaLista })
                      }}
                    />
                  </label>
                )
              })}
            </div>
          </div>

          {/* Bloco 2: Tipos de Pedidos Exibidos */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col gap-4">
            <div className="border-b border-border/60 pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary" />
                Quais Tipos de Pedidos devem subir para a TV?
              </h2>
              <p className="text-xs text-muted-foreground">
                Escolha se o telão mostra pedidos de balcão (gráfica rápida), ordens de serviço (comunicação visual), ou ambos.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all",
                  config.tiposVisiveis.includes("rapido")
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-muted/20 opacity-60"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                    Rápida
                  </span>
                  <div>
                    <p className="text-xs font-bold text-foreground">Pedidos de Gráfica Rápida</p>
                    <p className="text-[11px] text-muted-foreground">Adesivos, lonas e impressões diretas de balcão</p>
                  </div>
                </div>

                <Switch
                  checked={config.tiposVisiveis.includes("rapido")}
                  onCheckedChange={(checked) => {
                    if (!checked && !config.tiposVisiveis.includes("orcamento")) {
                      toast.error("Ao menos um tipo precisa estar ativo na TV.")
                      return
                    }
                    const nova = checked
                      ? [...config.tiposVisiveis, "rapido" as const]
                      : config.tiposVisiveis.filter((t) => t !== "rapido")
                    salvarConfiguracoes({ tiposVisiveis: nova })
                  }}
                />
              </label>

              <label
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all",
                  config.tiposVisiveis.includes("orcamento")
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-muted/20 opacity-60"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-xs font-bold">
                    OS
                  </span>
                  <div>
                    <p className="text-xs font-bold text-foreground">Ordens de Serviço (Orçamentos)</p>
                    <p className="text-[11px] text-muted-foreground">Projetos fechados de comunicação visual e toldos</p>
                  </div>
                </div>

                <Switch
                  checked={config.tiposVisiveis.includes("orcamento")}
                  onCheckedChange={(checked) => {
                    if (!checked && !config.tiposVisiveis.includes("rapido")) {
                      toast.error("Ao menos um tipo precisa estar ativo na TV.")
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

          {/* Bloco 3: Preferências de Som e Destaque */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col gap-4">
            <div className="border-b border-border/60 pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Preferências Gerais do Telão
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Alarme Sonoro Geral */}
              <div className="p-3.5 rounded-xl border border-border bg-background flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Volume2 className="h-4 w-4 text-amber-500" />
                    Alarme Sonoro da TV
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {config.somAlarme ? "Som e bips ativados na TV" : "TV totalmente silenciosa"}
                  </p>
                </div>
                <Switch
                  checked={config.somAlarme}
                  onCheckedChange={(checked) => salvarConfiguracoes({ somAlarme: checked })}
                />
              </div>

              {/* Destaque de Atrasados */}
              <div className="p-3.5 rounded-xl border border-border bg-background flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Destacar Atrasados
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {config.mostrarAtrasados ? "Cards atrasados em vermelho no topo" : "Sem badge de atraso"}
                  </p>
                </div>
                <Switch
                  checked={config.mostrarAtrasados}
                  onCheckedChange={(checked) => salvarConfiguracoes({ mostrarAtrasados: checked })}
                />
              </div>

              {/* Tema Visual da TV */}
              <div className="p-3.5 rounded-xl border border-border bg-background flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    {config.tema === "light" ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-violet-400" />}
                    Tema do Telão
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                    {config.tema === "light" ? "Modo Claro" : "Modo Escuro"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => salvarConfiguracoes({ tema: config.tema === "light" ? "dark" : "light" })}
                  className="h-8 text-xs font-semibold"
                >
                  Alternar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
