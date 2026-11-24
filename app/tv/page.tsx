"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useUser } from "@clerk/nextjs"
import { Download } from "lucide-react"
import { interpretarDataLocal } from "@/lib/date"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type StatusPedido = "aguardando" | "aprovado" | "ag_confirmacao" | "impressao" | "acabamento" | "pronto"

interface PedidoTV {
  id: string
  numero: number
  cliente_nome: string
  produto_nome: string | null
  variante_nome: string | null
  acabamento: string | null
  observacao: string
  status: StatusPedido
  criado_em: string
  prazo_entrega_em: string | null
  total: number
  tipo?: "rapido" | "orcamento"
  comissao_percent?: number | null
}

interface AvisoTV {
  id: string
  mensagem: string
  cor: string
  icone: string
  som: boolean
}

const COR_CLASSE: Record<string, string> = {
  azul:     "text-blue-600 dark:text-blue-400",
  verde:    "text-emerald-600 dark:text-emerald-400",
  amarelo:  "text-yellow-600 dark:text-yellow-400",
  vermelho: "text-red-600 dark:text-red-400",
  roxo:     "text-violet-600 dark:text-violet-400",
  laranja:  "text-orange-600 dark:text-orange-400",
  branco:   "text-slate-900 dark:text-white",
  rosa:     "text-pink-600 dark:text-pink-400",
}

const COLUNAS: { status: StatusPedido; label: string; borda: string; fundo: string }[] = [
  { status: "aguardando",     label: "Ag. Assinatura", borda: "border-slate-500/80",  fundo: "bg-slate-200/90 dark:bg-slate-900/80" },
  { status: "aprovado",       label: "Produção",       borda: "border-blue-500/80",   fundo: "bg-blue-100/90 dark:bg-blue-950/70" },
  { status: "ag_confirmacao", label: "Arte Enviada",   borda: "border-pink-500/80",   fundo: "bg-pink-100/90 dark:bg-pink-950/70" },
  { status: "impressao",      label: "Impressão",      borda: "border-amber-500/80",  fundo: "bg-amber-100/90 dark:bg-amber-950/70" },
  { status: "acabamento",     label: "Acabamento",     borda: "border-orange-500/80", fundo: "bg-orange-100/90 dark:bg-orange-950/70" },
  { status: "pronto",         label: "Pronto ✓",       borda: "border-emerald-500/80",fundo: "bg-emerald-100/90 dark:bg-emerald-950/70" },
]

function inicioDoDia(data: Date) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime()
}

// O prazo é salvo com data e hora (ISO). Atrasado é quando o dia do prazo já
// passou; pedido pronto já foi produzido, então não conta como atrasado.
function estaAtrasado(pedido: PedidoTV) {
  if (pedido.status === "pronto" || !pedido.prazo_entrega_em) return false
  const prazo = interpretarDataLocal(pedido.prazo_entrega_em)
  if (!Number.isFinite(prazo.getTime())) return false
  return inicioDoDia(prazo) < inicioDoDia(new Date())
}

function formatarPrazo(prazo: string | null) {
  if (!prazo) return null
  const data = interpretarDataLocal(prazo)
  if (!Number.isFinite(data.getTime())) return null
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

function temProblemaReportado(obs?: string | null): boolean {
  if (!obs) return false
  return obs.includes("ALERTA DA FÁBRICA") || obs.includes("PROBLEMA REPORTADO")
}

function PedidoCard({
  pedido,
  tamanhoGrande = true,
  mostrarColunaBadge = false,
}: {
  pedido: PedidoTV
  tamanhoGrande?: boolean
  mostrarColunaBadge?: boolean
}) {
  const atrasado = estaAtrasado(pedido)
  const temProblema = !!(
    pedido.observacao &&
    (pedido.observacao.includes("ALERTA DA FÁBRICA") || pedido.observacao.includes("PROBLEMA REPORTADO"))
  )
  const colunaInfo = COLUNAS.find(
    (c) => c.status === pedido.status || (c.status === "aprovado" && (pedido.status as string) === "arte")
  )

  return (
    <div
      key={pedido.id}
      className={`shrink-0 rounded-2xl border-2 transition-all p-3 sm:p-3.5 lg:p-4 shadow-sm w-full min-w-0 max-w-full overflow-hidden ${
        temProblema
          ? "border-red-600 bg-red-100/95 dark:border-red-500 dark:bg-red-950/85 ring-4 ring-red-500/30 shadow-lg animate-[pulse_3s_ease-in-out_infinite]"
          : atrasado
            ? "border-red-500 bg-red-50/95 shadow-md dark:border-red-600 dark:bg-red-950/80"
            : "border-slate-200/90 bg-white shadow-2xs dark:border-slate-700/80 dark:bg-slate-900/95"
      }`}
    >
      {/* Linha superior: Tag OS / Pedido + Tipo + Prazo/Atrasado + Badge da Etapa */}
      <div className="flex items-center justify-between gap-1.5 leading-none flex-wrap min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="font-black text-xs sm:text-sm lg:text-base text-foreground tracking-tight shrink-0">
            {pedido.tipo === "orcamento" ? `OS #${pedido.numero}` : `#${pedido.numero}`}
          </span>
          {pedido.tipo === "orcamento" ? (
            <span className="rounded-md bg-blue-500/15 border border-blue-500/30 px-1.5 py-0.5 text-[10px] sm:text-xs font-black text-blue-700 dark:text-blue-300 uppercase shrink-0">
              Com. Visual
            </span>
          ) : (
            <span className="rounded-md bg-violet-500/15 border border-violet-500/30 px-1.5 py-0.5 text-[10px] sm:text-xs font-black text-violet-700 dark:text-violet-300 uppercase shrink-0">
              Rápida
            </span>
          )}

          {mostrarColunaBadge && colunaInfo && (
            <span
              className={`rounded-md border px-1.5 py-0.5 text-[10px] sm:text-xs font-black shrink-0 ${colunaInfo.borda} ${colunaInfo.fundo} text-foreground`}
            >
              {colunaInfo.label}
            </span>
          )}
        </div>

        {temProblema ? (
          <span className="shrink-0 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] sm:text-xs font-black text-white uppercase tracking-wider animate-bounce shadow-md flex items-center gap-1">
            🚨 TRAVADO / PROBLEMA
          </span>
        ) : atrasado ? (
          <span className="shrink-0 rounded-lg bg-red-600 px-2 py-0.5 text-[10px] sm:text-xs font-black text-white uppercase tracking-wider animate-pulse shadow-xs">
            Atrasado
          </span>
        ) : pedido.prazo_entrega_em ? (
          <span className="shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2 py-0.5 text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300">
            até {formatarPrazo(pedido.prazo_entrega_em)}
          </span>
        ) : null}
      </div>

      {/* Nome do Cliente em Destaque Grande para ver de longe */}
      <p
        className={`mt-1.5 font-black text-foreground tracking-tight leading-tight break-words whitespace-normal ${
          tamanhoGrande
            ? "text-base sm:text-lg lg:text-xl xl:text-2xl"
            : "text-sm sm:text-base lg:text-lg"
        }`}
        title={pedido.cliente_nome}
      >
        {pedido.cliente_nome}
      </p>

      {/* Bloco: O QUE É PRA FAZER (Destaque total para a fábrica - NUNCA CORTA) */}
      <div className="mt-2 flex flex-col gap-2 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 p-2.5 sm:p-3.5 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs min-w-0 max-w-full overflow-hidden">
        {/* Medidas / Quantidade em destaque com layout 100% responsivo para bater o olho */}
        {pedido.variante_nome && (
          <div className="w-full max-w-full rounded-lg bg-primary/15 border border-primary/30 px-2.5 py-1.5 text-primary box-border">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-black uppercase tracking-wider text-primary shrink-0">
                <span className="text-xs sm:text-sm leading-none">📏</span>
                <span>DIMENSÕES:</span>
              </span>
              <span
                className={`font-black text-primary break-words whitespace-normal min-w-0 ${
                  tamanhoGrande ? "text-xs sm:text-sm lg:text-base" : "text-xs sm:text-sm"
                }`}
              >
                {pedido.variante_nome}
              </span>
            </div>
          </div>
        )}

        {/* Produto / Serviço com quebra de linha natural (NUNCA CORTA) */}
        <div className="min-w-0 max-w-full">
          <span className="text-[10px] sm:text-[11px] text-muted-foreground uppercase font-black tracking-wider block">
            Serviço / Produto:
          </span>
          <p className="font-black text-foreground text-sm sm:text-base lg:text-lg leading-snug break-words whitespace-normal mt-0.5">
            {pedido.produto_nome ?? "Item de Produção"}
          </p>
        </div>

        {/* Acabamento completo com quebra de linha */}
        {pedido.acabamento && (
          <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-700/50 min-w-0 max-w-full">
            <span className="text-[10px] sm:text-[11px] text-muted-foreground uppercase font-black tracking-wider block">
              Acabamento:
            </span>
            <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 break-words whitespace-normal mt-0.5">
              {pedido.acabamento}
            </p>
          </div>
        )}

        {/* Observação / Instrução de Produção ou Alerta da Fábrica */}
        {pedido.observacao && (
          <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/60 min-w-0 max-w-full">
            {temProblema ? (
              <div className="rounded-xl border-2 border-red-600 bg-red-500/20 dark:bg-red-950/50 p-2.5 sm:p-3 text-red-950 dark:text-red-100 shadow-md">
                <span className="text-xs sm:text-sm font-black uppercase tracking-wider block text-red-600 dark:text-red-400 flex items-center gap-1.5 animate-pulse">
                  🚨 ALERTA DA FÁBRICA / PROBLEMA TRAVADO:
                </span>
                <p className="text-xs sm:text-sm lg:text-base font-black break-words whitespace-normal mt-1 leading-snug text-red-700 dark:text-red-200">
                  {pedido.observacao}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2 sm:p-2.5 text-amber-950 dark:text-amber-100 shadow-2xs">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider block text-amber-700 dark:text-amber-400">
                  ⚠️ Instrução de Produção:
                </span>
                <p className="text-xs sm:text-sm lg:text-base font-bold break-words whitespace-normal mt-0.5 leading-snug">
                  {pedido.observacao}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bônus / Comissão do Colaborador (Regra: integral para cada um) */}
        {pedido.comissao_percent != null && pedido.comissao_percent > 0 && (
          <div className="pt-2 border-t border-amber-500/30 min-w-0 max-w-full">
            <div className="rounded-xl border-2 border-amber-500/70 bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 p-2 sm:p-2.5 shadow-sm flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-base sm:text-xl shrink-0 animate-bounce">🪙</span>
                <div className="flex flex-col min-w-0 leading-tight">
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    BÔNUS COLABORADOR: {pedido.comissao_percent}%
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground truncate">
                    Para cada um que produzir (integral)
                  </span>
                </div>
              </div>
              {pedido.total > 0 && (
                <span className="shrink-0 rounded-lg bg-amber-500 text-slate-950 font-black text-xs sm:text-sm px-2.5 py-1 shadow-xs">
                  R$ {((pedido.total * pedido.comissao_percent) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} cada
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TvColuna({
  status,
  label,
  borda,
  fundo,
  pedidos,
  tamanhoGrande = true,
}: {
  status: StatusPedido
  label: string
  borda: string
  fundo: string
  pedidos: PedidoTV[]
  tamanhoGrande?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [temOverflow, setTemOverflow] = useState(false)
  const [estaNoFim, setEstaNoFim] = useState(false)
  const [estaNoTopo, setEstaNoTopo] = useState(true)

  // Detecta se a coluna transborda a altura da tela da TV
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const verificar = () => {
      const transborda = el.scrollHeight > el.clientHeight + 4
      setTemOverflow(transborda)
      setEstaNoTopo(el.scrollTop <= 5)
      setEstaNoFim(el.scrollTop + el.clientHeight >= el.scrollHeight - 5)
    }
    verificar()
    const obs = new ResizeObserver(verificar)
    obs.observe(el)
    window.addEventListener("resize", verificar)
    const t = setTimeout(verificar, 300)
    return () => {
      clearTimeout(t)
      obs.disconnect()
      window.removeEventListener("resize", verificar)
    }
  }, [pedidos.length, tamanhoGrande])

  // Auto-scroll contínuo e cíclico com acumulador de float para compatibilidade com Smart TVs
  // NÃO depende de 'pedidos' para não ser reiniciado a cada ciclo de polling de 3 segundos
  useEffect(() => {
    const el = containerRef.current
    if (!el || !temOverflow) return

    let animId: number
    let timeoutId: NodeJS.Timeout | null = null
    let direcao = 1 // 1: descendo, -1: subindo
    let pausado = true // Começa pausado no topo para leitura inicial
    let scrollPos = el.scrollTop // Acumulador de precisão para evitar truncamento em Smart TVs

    // Inicia a rolagem para baixo após 2.5 segundos de pausa inicial
    timeoutId = setTimeout(() => {
      pausado = false
    }, 2500)

    const rolar = () => {
      if (!el) return
      const maxScroll = el.scrollHeight - el.clientHeight
      if (maxScroll <= 2) {
        animId = requestAnimationFrame(rolar)
        return
      }

      if (!pausado) {
        if (direcao === 1) {
          // Descendo suavemente: 0.85px por frame
          scrollPos += 0.85
          if (scrollPos >= maxScroll) {
            scrollPos = maxScroll
            el.scrollTop = maxScroll
            setEstaNoTopo(false)
            setEstaNoFim(true)
            pausado = true
            // Pausa no final para leitura dos últimos pedidos antes de subir
            timeoutId = setTimeout(() => {
              direcao = -1
              pausado = false
            }, 3500)
          } else {
            el.scrollTop = Math.round(scrollPos)
            setEstaNoTopo(el.scrollTop <= 5)
            setEstaNoFim(el.scrollTop >= maxScroll - 5)
          }
        } else {
          // Subindo suavemente de volta ao topo: 1.2px por frame
          scrollPos -= 1.2
          if (scrollPos <= 0) {
            scrollPos = 0
            el.scrollTop = 0
            setEstaNoTopo(true)
            setEstaNoFim(false)
            pausado = true
            // Pausa no topo antes de descer novamente
            timeoutId = setTimeout(() => {
              direcao = 1
              pausado = false
            }, 3000)
          } else {
            el.scrollTop = Math.round(scrollPos)
            setEstaNoTopo(el.scrollTop <= 5)
            setEstaNoFim(el.scrollTop >= maxScroll - 5)
          }
        }
      }

      animId = requestAnimationFrame(rolar)
    }

    animId = requestAnimationFrame(rolar)

    const sincronizarScroll = () => {
      if (pausado) {
        scrollPos = el.scrollTop
      }
    }
    el.addEventListener("scroll", sincronizarScroll, { passive: true })

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      cancelAnimationFrame(animId)
      el.removeEventListener("scroll", sincronizarScroll)
    }
  }, [temOverflow])

  return (
    <div
      id={`tv-coluna-${status}`}
      className="flex h-full min-h-0 flex-1 flex-col gap-2 min-w-0"
    >
      {/* Cabeçalho da coluna */}
      <div
        className={`flex shrink-0 items-center justify-between rounded-xl border px-3 py-2 shadow-2xs ${borda} ${fundo}`}
      >
        <span className="text-sm sm:text-base lg:text-lg font-black tracking-tight truncate text-foreground">
          {label}
        </span>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs sm:text-sm font-black ${
            pedidos.length > 0
              ? "bg-foreground/20 text-foreground"
              : "bg-black/5 dark:bg-white/5 text-muted-foreground opacity-40"
          }`}
        >
          {pedidos.length}
        </span>
      </div>

      {/* Container de cards com auto-scroll suave infinito */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
        <div
          ref={containerRef}
          className="flex h-full min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pr-0.5"
        >
          {pedidos.map((pedido) => (
            <PedidoCard
              key={pedido.id}
              pedido={pedido}
              tamanhoGrande={tamanhoGrande}
              mostrarColunaBadge={false}
            />
          ))}

          {pedidos.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-border/40 py-8 text-sm text-muted-foreground/40 italic font-semibold">
              Vazio
            </div>
          )}
        </div>

        {/* Indicador suave de rolagem */}
        {temOverflow && !estaNoFim && (
          <div className="pointer-events-none absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-background via-background/80 to-transparent flex items-end justify-center pb-1">
            <span className="text-[10px] font-black text-primary animate-bounce">
              ↓ rolando ({pedidos.length} pedidos)
            </span>
          </div>
        )}
        {temOverflow && !estaNoTopo && (
          <div className="pointer-events-none absolute top-0 inset-x-0 h-5 bg-gradient-to-b from-background to-transparent" />
        )}
      </div>
    </div>
  )
}

function Relogio() {
  const [agora, setAgora] = useState<Date | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAgora(new Date())
    const t = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!agora) return null
  return (
    <div className="shrink-0 text-right">
      <div className="text-xl sm:text-3xl lg:text-5xl font-black tabular-nums tracking-tight text-foreground">
        {agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      <div className="mt-0.5 text-[11px] sm:text-sm lg:text-base capitalize text-muted-foreground leading-tight">
        <span className="sm:hidden">
          {agora.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
        </span>
        <span className="hidden sm:inline">
          {agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </span>
      </div>
    </div>
  )
}

function tocarAlarme() {
  try {
    const ctx = new AudioContext()
    const repeticoes = 4
    const durSom = 0.55
    const durSilencio = 0.18

    for (let i = 0; i < repeticoes; i++) {
      const t0 = ctx.currentTime + i * (durSom + durSilencio)

      // Dois osciladores: fundamental + harmônico para som mais encorpado
      ;[650, 1300].forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = "sawtooth"
        osc.frequency.setValueAtTime(freq, t0)
        const vol = idx === 0 ? 0.5 : 0.15
        gain.gain.setValueAtTime(0, t0)
        gain.gain.linearRampToValueAtTime(vol, t0 + 0.02)
        gain.gain.setValueAtTime(vol, t0 + durSom - 0.08)
        gain.gain.linearRampToValueAtTime(0, t0 + durSom)
        osc.start(t0)
        osc.stop(t0 + durSom)
      })
    }
  } catch { /* AudioContext bloqueado antes de interação do usuário */ }
}

function tocarAlertaNovaDemanda() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {})
    }
    // Campanhiha / chime claro de notificação: notas ascendentes elegantes
    const notas = [523.25, 659.25, 783.99, 1046.50]
    notas.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.09
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.35, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.4)
    })
  } catch { /* AudioContext bloqueado antes de interação do usuário */ }
}

function dispararVibracaoCelular() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator && typeof navigator.vibrate === "function") {
      // Vibração dupla marcante para alertar no bolso: 300ms, pausa 100ms, 300ms, pausa 100ms, 500ms
      navigator.vibrate([300, 100, 300, 100, 500])
    }
  } catch { /* sem suporte */ }
}

export default function TvPage() {
  const { user } = useUser()
  const [paramColaborador, setParamColaborador] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search)
      if (sp.get("colaborador") === "1") {
        setParamColaborador(true)
      }
    }
  }, [])

  const papelUsuario = (user?.publicMetadata?.papel as string) || ""
  const isColaborador = papelUsuario === "operador" || paramColaborador
  const isColaboradorRef = useRef(isColaborador)
  useEffect(() => {
    isColaboradorRef.current = isColaborador
  }, [isColaborador])

  const [pedidos, setPedidos] = useState<PedidoTV[]>([])
  const [avisos, setAvisos] = useState<AvisoTV[]>([])
  const [filtroStatusMobile, setFiltroStatusMobile] = useState<string>("todos")
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null)
  const [alertaRecente, setAlertaRecente] = useState<{ id: string; titulo: string; sub: string } | null>(null)
  const [alertasAtivados, setAlertasAtivados] = useState<boolean>(false)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [modalInstalacaoAberto, setModalInstalacaoAberto] = useState(false)
  const [jaInstalado, setJaInstalado] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true
    ) {
      setJaInstalado(true)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener("beforeinstallprompt", handler)
    const appInstalledHandler = () => {
      setJaInstalado(true)
      setInstallPrompt(null)
    }
    window.addEventListener("appinstalled", appInstalledHandler)
    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
      window.removeEventListener("appinstalled", appInstalledHandler)
    }
  }, [])

  const acionarInstalacao = useCallback(async () => {
    if (installPrompt) {
      try {
        await installPrompt.prompt()
        const choice = await installPrompt.userChoice
        if (choice?.outcome === "accepted") {
          setJaInstalado(true)
          setModalInstalacaoAberto(false)
          return
        }
      } catch (e) {
        console.error("Erro ao solicitar instalação PWA:", e)
      }
    }
    setModalInstalacaoAberto(true)
  }, [installPrompt])
  const pedidosConhecidosRef = useRef<Set<string> | null>(null)
  const [config, setConfig] = useState<{
    statusVisiveis?: string[]
    tiposVisiveis?: string[]
    mostrarAtrasados?: boolean
    somAlarme?: boolean
    apenasRecentes?: boolean
    densidade?: "normal" | "compacto"
    tamanhoFonte?: "normal" | "grande"
    ocultarVazias?: boolean
    mostrarColunaAlertas?: boolean
  } | null>(null)

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/tv/pedidos", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        const novosPedidos: PedidoTV[] = data.pedidos ?? data

        const novosFiltrados = isColaboradorRef.current
          ? novosPedidos.filter((p) => p.status !== "aguardando")
          : novosPedidos

        if (pedidosConhecidosRef.current === null) {
          pedidosConhecidosRef.current = new Set(novosFiltrados.map((p) => p.id))
        } else {
          const novatos = novosFiltrados.filter((p) => !pedidosConhecidosRef.current!.has(p.id))
          if (novatos.length > 0) {
            novatos.forEach((p) => pedidosConhecidosRef.current!.add(p.id))
            // Disparar Som & Vibração no celular
            tocarAlertaNovaDemanda()
            dispararVibracaoCelular()

            const pri = novatos[0]
            const titulo = `🔔 Nova Demanda: ${pri.tipo === "orcamento" ? "OS #" : "#"}${pri.numero}`
            const sub = `${pri.cliente_nome} — ${pri.produto_nome || "Produção"}`
            setAlertaRecente({ id: pri.id, titulo, sub })
            setTimeout(() => setAlertaRecente(null), 8000)

            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              try {
                new Notification(titulo, {
                  body: sub,
                  icon: "/icons/icon-192x192.png",
                  tag: `pedido-${pri.id}`,
                })
              } catch {}
            }
          }
        }

        setPedidos((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(novosPedidos)) return prev
          return novosPedidos
        })
        const novosAvisos = data.avisos ?? []
        setAvisos((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(novosAvisos)) return prev
          return novosAvisos
        })
        if (data.config) {
          setConfig((prev) => {
            if (JSON.stringify(prev) === JSON.stringify(data.config)) return prev
            return data.config
          })
        }
        setUltimaAtualizacao(new Date())
      }
    } catch { /* retry on next interval */ }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
    // Atualiza automaticamente a cada 3 segundos: qualquer mudança na Central da TV aparece na hora na TV!
    const t = setInterval(carregar, 3_000)
    return () => clearInterval(t)
  }, [carregar])

  // A TV roda em outro aparelho: segue o tema escolhido no sistema, que fica
  // salvo no servidor. Consulta leve a cada 10 s pra trocar quase na hora.
  // Só aplica quando o valor do servidor MUDA: se a TV estiver aberta no mesmo
  // navegador do sistema, aplicar a cada consulta desfazia o clique de quem
  // acabou de trocar o tema (o servidor ainda não tinha gravado). O setTheme
  // fica num ref porque muda de identidade a cada troca de tema e reiniciaria
  // o efeito, disparando justamente essa consulta fora de hora.
  const { setTheme } = useTheme()
  const setThemeRef = useRef(setTheme)
  useEffect(() => {
    setThemeRef.current = setTheme
  }, [setTheme])
  useEffect(() => {
    let ultimoDoServidor: string | null = null
    async function sincronizarTema() {
      try {
        const res = await fetch("/api/tv/tema", { cache: "no-store" })
        if (!res.ok) return
        const { tema } = await res.json()
        if ((tema === "light" || tema === "dark") && tema !== ultimoDoServidor) {
          if (ultimoDoServidor !== null) {
            setThemeRef.current(tema)
          }
          ultimoDoServidor = tema
        }
      } catch { /* tenta de novo no próximo ciclo */ }
    }
    sincronizarTema()
    const t = setInterval(sincronizarTema, 10_000)
    return () => clearInterval(t)
  }, [])

  // Alarme periódico se houver aviso com som ativado e somAlarme não desativado
  useEffect(() => {
    if (config && config.somAlarme === false) return
    const comSom = avisos.some((a) => a.som)
    if (!comSom) return
    tocarAlarme()
    const t = setInterval(tocarAlarme, 30_000)
    return () => clearInterval(t)
  }, [avisos, config])

  const pedidosEfetivos = useMemo(() => {
    if (isColaborador) {
      return pedidos.filter((p) => p.status !== "aguardando")
    }
    return pedidos
  }, [pedidos, isColaborador])

  const totalAtivos = pedidosEfetivos.length
  const totalAtrasados = pedidosEfetivos.filter((p) => estaAtrasado(p)).length

  // Se ocultarVazias estiver ativo, expande as colunas com pedidos para ocupar a tela toda
  const colunasFiltradas = useMemo(() => {
    let autorizadas = COLUNAS.filter((c) =>
      (config?.statusVisiveis ?? COLUNAS.map((col) => col.status)).includes(c.status)
    )

    // O colaborador nunca vê a etapa de Aguardando Assinatura
    if (isColaborador) {
      autorizadas = autorizadas.filter((c) => c.status !== "aguardando")
    }

    if (config?.ocultarVazias) {
      const comPedidos = autorizadas.filter((c) => {
        const count = pedidosEfetivos.filter(
          (p) => p.status === c.status || (c.status === "aprovado" && (p.status as string) === "arte")
        ).length
        return count > 0
      })
      return comPedidos.length > 0 ? comPedidos : autorizadas
    }

    return autorizadas
  }, [config?.statusVisiveis, config?.ocultarVazias, pedidosEfetivos, isColaborador])

  const pedidosAlertas = useMemo(() => {
    return pedidosEfetivos.filter(
      (p) => temProblemaReportado(p.observacao) || (p.prazo_entrega_em && new Date(p.prazo_entrega_em).getTime() < Date.now())
    )
  }, [pedidosEfetivos])

  const pedidosMobile = useMemo(() => {
    if (filtroStatusMobile === "urgencias") return pedidosAlertas
    if (filtroStatusMobile === "todos") return pedidosEfetivos
    return pedidosEfetivos.filter(
      (p) => p.status === filtroStatusMobile || (filtroStatusMobile === "aprovado" && (p.status as string) === "arte")
    )
  }, [pedidosEfetivos, filtroStatusMobile, pedidosAlertas])

  return (
    <div className="group/tv flex h-screen max-h-screen w-screen overflow-hidden flex-col gap-2.5 sm:gap-3 p-2.5 sm:p-4 bg-background">

      {/* Barra flutuante de utilitários da TV — visível ao passar o mouse ou interagir */}
      <div className="fixed top-2.5 right-3 z-50 flex items-center gap-2 opacity-0 sm:group-hover/tv:opacity-100 transition-opacity duration-200">
        <button
          type="button"
          onClick={() => {
            const novo = config?.mostrarColunaAlertas === false ? true : false
            setConfig((prev) => (prev ? { ...prev, mostrarColunaAlertas: novo } : prev))
            fetch("/api/tv/config", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...config, mostrarColunaAlertas: novo }),
            }).catch(() => {})
          }}
          className={`rounded-lg px-2.5 py-1 text-xs font-bold shadow-sm border backdrop-blur transition-colors ${
            config?.mostrarColunaAlertas !== false
              ? "bg-red-600 text-white border-red-600"
              : "bg-card/90 text-foreground border-border/80 hover:bg-muted"
          }`}
          title="Exibir ou ocultar coluna de alertas e urgências no Telão"
        >
          {config?.mostrarColunaAlertas !== false ? "🚨 Coluna Alertas: ON" : "🚨 Coluna Alertas: OFF"}
        </button>

        <button
          type="button"
          onClick={() => {
            const novo = !config?.ocultarVazias
            setConfig((prev) => (prev ? { ...prev, ocultarVazias: novo } : prev))
            fetch("/api/tv/config", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...config, ocultarVazias: novo }),
            }).catch(() => {})
          }}
          className={`rounded-lg px-2.5 py-1 text-xs font-bold shadow-sm border backdrop-blur transition-colors ${
            config?.ocultarVazias
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card/90 text-foreground border-border/80 hover:bg-muted"
          }`}
          title="Oculta etapas sem pedidos para dar foco total e espaço gigante para os pedidos ativos"
        >
          {config?.ocultarVazias ? "✓ Expandir Ativas (Ocultar Vazias)" : "Ocultar Vazias"}
        </button>

        <button
          type="button"
          onClick={() => {
            const novo = config?.tamanhoFonte === "normal" ? "grande" : "normal"
            setConfig((prev) => (prev ? { ...prev, tamanhoFonte: novo } : prev))
            fetch("/api/tv/config", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...config, tamanhoFonte: novo }),
            }).catch(() => {})
          }}
          className="rounded-lg bg-card/90 px-2.5 py-1 text-xs font-bold text-foreground shadow-sm border border-border/80 backdrop-blur hover:bg-muted"
        >
          {config?.tamanhoFonte === "normal" ? "Fonte: Normal" : "Fonte: Grande (TV)"}
        </button>

        <button
          type="button"
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(() => {})
            } else {
              document.exitFullscreen().catch(() => {})
            }
          }}
          className="rounded-lg bg-card/90 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm border border-border/80 backdrop-blur hover:bg-muted"
        >
          ⛶ Tela Cheia
        </button>

        <button
          type="button"
          onClick={acionarInstalacao}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm border border-blue-500 backdrop-blur transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          title="Instalar aplicativo na Smart TV"
        >
          <Download className="h-3.5 w-3.5" />
          <span>{jaInstalado ? "✓ App Instalado" : "📲 Instalar na TV"}</span>
        </button>

        <Link
          href={isColaborador ? "/producao" : "/dashboard"}
          className="rounded-lg bg-card/90 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm border border-border/80 backdrop-blur hover:bg-muted"
        >
          {isColaborador ? "← Voltar à Produção" : "← Voltar ao Sistema"}
        </Link>
      </div>

      {/* Header Compacto e Responsivo para TV e Celular */}
      <header className="flex shrink-0 items-center justify-between gap-2 sm:gap-3 border-b border-border/40 pb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="shrink-0 rounded-xl bg-[#0060a7] px-2 py-1 sm:px-2.5 sm:py-1.5 dark:bg-transparent dark:p-0">
              <Image
                src="/brand/logo.png"
                alt="Toldos Print"
                width={1200}
                height={394}
                priority
                className="h-auto w-28 sm:w-44 lg:w-56"
              />
            </div>
            <div className="h-5 sm:h-6 w-px bg-border/60 hidden sm:block" />
            <span className="hidden sm:inline text-base sm:text-xl font-black tracking-tight text-foreground/80">
              Painel de Produção
            </span>
            <Link
              href={isColaborador ? "/producao" : "/dashboard"}
              className="sm:hidden ml-auto rounded-lg bg-card/90 px-2 py-1 text-[11px] font-black text-foreground border border-border/80 shadow-2xs"
            >
              {isColaborador ? "← Produção" : "← Sair"}
            </Link>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-muted-foreground">
            <span className="font-bold text-foreground">
              {totalAtivos} pedido{totalAtivos !== 1 ? "s" : ""} ativo{totalAtivos !== 1 ? "s" : ""}
            </span>
            {config?.apenasRecentes && (
              <span className="rounded-full bg-amber-500/15 px-1.5 sm:px-2 py-0.5 font-bold text-amber-600 dark:text-amber-400 text-[10px] sm:text-xs">
                ⚡ 5 Recentes
              </span>
            )}
            {totalAtrasados > 0 && config?.mostrarAtrasados !== false && (
              <span className="rounded-full bg-red-500/15 px-1.5 sm:px-2 py-0.5 font-bold text-red-600 dark:text-red-400 text-[10px] sm:text-xs animate-pulse">
                ⚠ {totalAtrasados} atrasado{totalAtrasados !== 1 ? "s" : ""}
              </span>
            )}
            {ultimaAtualizacao && (
              <span className="hidden xs:inline text-[10px] sm:text-[11px] text-muted-foreground/70">
                Sync {ultimaAtualizacao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                tocarAlertaNovaDemanda()
                dispararVibracaoCelular()
                setAlertasAtivados(true)
                if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
                  Notification.requestPermission().catch(() => {})
                }
              }}
              className={`rounded-lg px-2 py-0.5 text-[10px] sm:text-xs font-bold transition-all shadow-2xs border inline-flex items-center gap-1 ${
                alertasAtivados
                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25"
              }`}
              title="Toque para testar e ativar som e vibração no celular"
            >
              <span>🔔</span>
              <span>{alertasAtivados ? "Vibração & Som Ativos" : "Ativar Vibração e Alerta"}</span>
            </button>

            {/* Botão de Instalar Atalho na TV / Computador */}
            <button
              type="button"
              onClick={acionarInstalacao}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold transition-all shadow-2xs border border-blue-500/80 inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Clique para baixar ou instalar o atalho do Painel TV na Smart TV ou computador"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{jaInstalado ? "✓ Atalho Instalado" : "📲 Instalar Atalho na TV"}</span>
            </button>
          </div>
        </div>

        <Relogio />
      </header>

      {/* Alerta flutuante quando nova demanda entra na produção */}
      {alertaRecente && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92vw] sm:w-auto bg-primary text-primary-foreground p-3 sm:p-4 rounded-2xl shadow-2xl border-2 border-primary-foreground/20 animate-in fade-in slide-in-from-top-4 duration-300 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-xl shrink-0 animate-bounce">
            🔔
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-black text-xs sm:text-sm leading-tight">
              {alertaRecente.titulo}
            </div>
            <div className="text-[11px] sm:text-xs text-primary-foreground/90 truncate mt-0.5">
              {alertaRecente.sub}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAlertaRecente(null)}
            className="text-xs font-bold bg-white/20 hover:bg-white/30 rounded-lg px-2.5 py-1 shrink-0"
          >
            OK
          </button>
        </div>
      )}

      {/* Visualização MOBILE: SEM formato Kanban! Feed vertical com rolagem fluida e cartões 100% legíveis */}
      <div className="flex-1 min-h-0 flex flex-col md:hidden overflow-hidden">
        {/* Pílulas de Filtro por Etapa no Celular */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 shrink-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setFiltroStatusMobile("todos")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 border transition-all ${
              filtroStatusMobile === "todos"
                ? "bg-primary text-primary-foreground border-primary shadow-xs font-black"
                : "bg-card text-foreground border-border/80 hover:bg-muted"
            }`}
          >
            <span>Todos</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                filtroStatusMobile === "todos" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {pedidosEfetivos.length}
            </span>
          </button>

          {config?.mostrarColunaAlertas !== false && pedidosAlertas.length > 0 && (
            <button
              type="button"
              onClick={() => setFiltroStatusMobile("urgencias")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 border transition-all ${
                filtroStatusMobile === "urgencias"
                  ? "bg-red-600 text-white border-red-600 shadow-xs font-black"
                  : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/20"
              }`}
            >
              <span>🚨 Urgências</span>
              <span className="rounded-full px-1.5 py-0.2 text-[10px] font-black bg-red-600 text-white">
                {pedidosAlertas.length}
              </span>
            </button>
          )}

          {colunasFiltradas.map((coluna) => {
            const count = pedidosEfetivos.filter(
              (p) => p.status === coluna.status || (coluna.status === "aprovado" && (p.status as string) === "arte")
            ).length
            const ativo = filtroStatusMobile === coluna.status
            return (
              <button
                key={`mobile-tab-${coluna.status}`}
                type="button"
                onClick={() => setFiltroStatusMobile(coluna.status)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 border transition-all ${
                  ativo
                    ? "bg-primary text-primary-foreground border-primary shadow-xs font-black"
                    : count > 0
                    ? "bg-card text-foreground border-border/80 hover:bg-muted"
                    : "bg-muted/30 text-muted-foreground border-transparent opacity-50"
                }`}
              >
                <span>{coluna.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                    ativo ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Lista Vertical de Pedidos no Celular */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-0.5 pb-2">
          {pedidosMobile.length > 0 ? (
            pedidosMobile.map((pedido) => (
              <PedidoCard
                key={`mobile-card-${pedido.id}`}
                pedido={pedido}
                tamanhoGrande={config?.tamanhoFonte !== "normal"}
                mostrarColunaBadge={filtroStatusMobile === "todos"}
              />
            ))
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-border/40 py-12 text-sm text-muted-foreground font-semibold">
              Nenhum pedido nesta etapa
            </div>
          )}
        </div>
      </div>

      {/* Visualização DESKTOP / TV: Kanban lado a lado com auto-scroll infinito */}
      <div className="flex-1 min-h-0 hidden md:flex flex-row gap-2 sm:gap-3 w-full overflow-hidden">
        {/* Coluna Opcional de Alertas & Urgências (Configurável para TV) */}
        {config?.mostrarColunaAlertas !== false && pedidosAlertas.length > 0 && (
          <TvColuna
            key="coluna-urgencias-destaque"
            status={"aprovado" as any}
            label={`🚨 Urgências (${pedidosAlertas.length})`}
            borda="border-red-600 ring-2 ring-red-500/60 shadow-lg"
            fundo="bg-red-500/10 dark:bg-red-950/40"
            pedidos={pedidosAlertas}
            tamanhoGrande={config?.tamanhoFonte !== "normal"}
          />
        )}

        {colunasFiltradas.map((coluna) => {
          const colPedidos = pedidosEfetivos.filter(
            (p) => p.status === coluna.status || (coluna.status === "aprovado" && (p.status as string) === "arte")
          )
          return (
            <TvColuna
              key={coluna.status}
              status={coluna.status}
              label={coluna.label}
              borda={coluna.borda}
              fundo={coluna.fundo}
              pedidos={colPedidos}
              tamanhoGrande={config?.tamanhoFonte !== "normal"}
            />
          )
        })}
      </div>

      {pedidosEfetivos.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-muted-foreground/40 sm:text-2xl pointer-events-none">
          Nenhum pedido em andamento no momento
        </div>
      )}

      {/* Ticker de avisos rodapé */}
      {avisos.filter((a) => (a as { ativo?: boolean }).ativo !== false).length > 0 && (
        <div className="shrink-0 overflow-hidden rounded-xl border border-border/80 bg-card py-2 shadow-xs">
          <div
            className="ticker-track"
            style={{ animationDuration: `${Math.max(avisos.length * 10, 20)}s` }}
          >
            {[
              ...avisos.filter((a) => (a as { ativo?: boolean }).ativo !== false),
              ...avisos.filter((a) => (a as { ativo?: boolean }).ativo !== false),
            ].map((aviso, i) => (
              <span
                key={`${aviso.id}-${i}`}
                className={`text-sm font-bold sm:text-base ${COR_CLASSE[aviso.cor ?? "azul"] ?? COR_CLASSE.azul}`}
              >
                {aviso.icone ?? "📢"} {aviso.mensagem}
              </span>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track {
          display: flex;
          gap: 5rem;
          white-space: nowrap;
          width: max-content;
          will-change: transform;
          animation: ticker-scroll linear infinite;
        }
      `}</style>

      {/* Banner Flutuante de Instalação Automática (Igual ao Celular) */}
      {!jaInstalado && installPrompt && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border-2 border-blue-500 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 max-w-md">
          <Image
            src="/icon-192-v2.png"
            alt="Painel TV"
            width={48}
            height={48}
            className="h-12 w-12 rounded-xl shadow shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white leading-tight">Instalar Painel na sua TV TCL</p>
            <p className="text-xs text-slate-300 mt-0.5">Abra direto da tela inicial da TV como um app.</p>
          </div>
          <button
            type="button"
            onClick={acionarInstalacao}
            className="shrink-0 flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Instalar</span>
          </button>
        </div>
      )}

      {/* Modal de Instalação e Criação de Atalho na TV / PC */}
      <Dialog open={modalInstalacaoAberto} onOpenChange={setModalInstalacaoAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 px-2.5 py-1 text-xs font-bold">
                📺 Smart TV TCL
              </span>
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Instalar Aplicativo na TV
            </DialogTitle>
            <DialogDescription className="text-xs">
              Fixe o Painel TV na tela inicial para abrir sempre em tela cheia como um programa.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2 text-xs">
            {installPrompt ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await installPrompt.prompt()
                    const choice = await installPrompt.userChoice
                    if (choice?.outcome === "accepted") {
                      setJaInstalado(true)
                      setModalInstalacaoAberto(false)
                    }
                  } catch (err) {
                    console.error(err)
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all active:scale-[0.98] cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Instalar Agora na TV (1 Clique)</span>
              </button>
            ) : (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 flex flex-col gap-2">
                <p className="font-bold text-emerald-900 dark:text-emerald-300 text-xs">
                  📺 Na sua Smart TV TCL (Google TV / Android TV):
                </p>
                <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                  No controle remoto da TV, clique nos <strong>3 pontinhos (⋮)</strong> no canto do navegador e selecione <strong>&quot;Instalar App&quot;</strong> ou <strong>&quot;Adicionar à tela inicial&quot;</strong>.
                </p>
                <p className="text-slate-500 text-[11px] mt-1">
                  O ícone do Painel TV fica salvo na tela de aplicativos da sua TCL.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(() => {})
                } else {
                  document.exitFullscreen().catch(() => {})
                }
                setModalInstalacaoAberto(false)
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs shadow transition-all cursor-pointer"
            >
              <span>⛶ Deixar em Tela Cheia (Sem barras)</span>
            </button>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalInstalacaoAberto(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
