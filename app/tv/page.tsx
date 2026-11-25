"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useUser } from "@clerk/nextjs"
import { interpretarDataLocal } from "@/lib/date"
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
  criado_em?: string
  ativo?: boolean
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

function formatarHoraAviso(dataIso?: string | null) {
  if (!dataIso) return null
  try {
    const data = new Date(dataIso)
    if (!Number.isFinite(data.getTime())) return null
    return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  } catch {
    return null
  }
}

function AvisoCard({
  aviso,
  tamanhoGrande = true,
}: {
  aviso: AvisoTV
  tamanhoGrande?: boolean
}) {
  const hora = formatarHoraAviso(aviso.criado_em)
  const isVermelho = aviso.cor === "vermelho" || aviso.icone === "🚨" || aviso.icone === "🛑"
  const isAmarelo = aviso.cor === "amarelo" || aviso.cor === "laranja" || aviso.icone === "⚠️"

  return (
    <div
      key={`aviso-card-${aviso.id}`}
      className={`shrink-0 rounded-xl border-2 p-2.5 sm:p-3 shadow-md w-full min-w-0 max-w-full overflow-hidden transition-all ${
        isVermelho
          ? "border-red-600 bg-red-950/90 text-red-100 ring-2 ring-red-500/40"
          : isAmarelo
            ? "border-amber-500 bg-amber-950/80 text-amber-100 ring-1 ring-amber-500/30"
            : "border-blue-500/80 bg-blue-950/80 text-blue-100"
      }`}
    >
      {/* Topo do Card de Aviso: Sempre compacto em 1 linha */}
      <div className="flex items-center justify-between gap-1 leading-none min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-base shrink-0 leading-none">
            {aviso.icone || (isVermelho ? "🚨" : isAmarelo ? "⚠️" : "📢")}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider shrink-0 ${
              isVermelho
                ? "bg-red-600 text-white"
                : isAmarelo
                  ? "bg-amber-500 text-slate-950"
                  : "bg-blue-600 text-white"
            }`}
          >
            {isVermelho ? "Emergência" : isAmarelo ? "Atenção" : "Aviso"}
          </span>
          {aviso.som && (
            <span className="text-[10px] shrink-0" title="Alerta sonoro ativo">
              🔊
            </span>
          )}
        </div>

        {hora && (
          <span className="shrink-0 rounded bg-black/40 border border-white/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
            {hora}
          </span>
        )}
      </div>

      {/* Mensagem da Emergência */}
      <div className="mt-2 min-w-0 max-w-full">
        <p className="font-black text-xs sm:text-sm lg:text-base leading-snug break-words whitespace-normal tracking-tight text-white">
          {aviso.mensagem}
        </p>
      </div>
    </div>
  )
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
      className={`shrink-0 rounded-2xl border-2 transition-all p-2.5 sm:p-3 shadow-sm w-full min-w-0 max-w-full overflow-hidden ${
        temProblema
          ? "border-red-600 bg-red-100/95 dark:border-red-500 dark:bg-red-950/85 ring-4 ring-red-500/30 shadow-lg animate-[pulse_3s_ease-in-out_infinite]"
          : atrasado
            ? "border-red-500 bg-red-50/95 shadow-md dark:border-red-600 dark:bg-red-950/80"
            : "border-slate-200/90 bg-white shadow-2xs dark:border-slate-700/80 dark:bg-slate-900/95"
      }`}
    >
      {/* Linha superior: Tag OS / Pedido + Tipo + Prazo/Atrasado + Badge da Etapa */}
      <div className="flex items-center justify-between gap-1 leading-none flex-wrap min-w-0">
        <div className="flex items-center gap-1 min-w-0 flex-wrap">
          <span className="font-black text-xs sm:text-sm text-foreground tracking-tight shrink-0">
            {pedido.tipo === "orcamento" ? `OS #${pedido.numero}` : `#${pedido.numero}`}
          </span>
          {pedido.tipo === "orcamento" ? (
            <span className="rounded bg-blue-500/15 border border-blue-500/30 px-1 py-0.5 text-[9px] sm:text-[10px] font-black text-blue-700 dark:text-blue-300 uppercase shrink-0">
              Com. Visual
            </span>
          ) : (
            <span className="rounded bg-violet-500/15 border border-violet-500/30 px-1 py-0.5 text-[9px] sm:text-[10px] font-black text-violet-700 dark:text-violet-300 uppercase shrink-0">
              Rápida
            </span>
          )}

          {mostrarColunaBadge && colunaInfo && (
            <span
              className={`rounded border px-1 py-0.5 text-[9px] sm:text-[10px] font-black shrink-0 ${colunaInfo.borda} ${colunaInfo.fundo} text-foreground`}
            >
              {colunaInfo.label}
            </span>
          )}
        </div>

        {temProblema ? (
          <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white uppercase tracking-wider animate-bounce shadow-xs flex items-center gap-1">
            🚨 ALERTA
          </span>
        ) : atrasado ? (
          <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white uppercase tracking-wider animate-pulse shadow-xs">
            Atrasado
          </span>
        ) : pedido.prazo_entrega_em ? (
          <span className="shrink-0 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
            até {formatarPrazo(pedido.prazo_entrega_em)}
          </span>
        ) : null}
      </div>

      {/* Nome do Cliente em Destaque */}
      <p
        className="mt-1 font-black text-foreground tracking-tight leading-tight break-words whitespace-normal text-xs sm:text-sm lg:text-base"
        title={pedido.cliente_nome}
      >
        {pedido.cliente_nome}
      </p>

      {/* Bloco: O QUE É PRA FAZER (Destaque total para a fábrica - NUNCA CORTA) */}
      <div className="mt-1.5 flex flex-col gap-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 p-2 sm:p-2.5 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs min-w-0 max-w-full overflow-hidden">
        {/* Medidas / Quantidade */}
        {pedido.variante_nome && (
          <div className="w-full max-w-full rounded-lg bg-primary/15 border border-primary/30 px-2 py-1 text-primary box-border">
            <div className="flex items-center gap-1 flex-wrap min-w-0">
              <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-primary shrink-0">
                <span>📏</span>
                <span>DIMENSÕES:</span>
              </span>
              <span className="font-black text-primary text-xs sm:text-sm break-words whitespace-normal min-w-0">
                {pedido.variante_nome}
              </span>
            </div>
          </div>
        )}

        {/* Produto / Serviço com quebra de linha natural */}
        <div className="min-w-0 max-w-full">
          <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase font-black tracking-wider block">
            Serviço / Produto:
          </span>
          <p className="font-black text-foreground text-xs sm:text-sm lg:text-base leading-snug break-words whitespace-normal mt-0.5">
            {pedido.produto_nome ?? "Item de Produção"}
          </p>
        </div>

        {/* Acabamento completo com quebra de linha */}
        {pedido.acabamento && (
          <div className="pt-1 border-t border-slate-200/60 dark:border-slate-700/50 min-w-0 max-w-full">
            <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase font-black tracking-wider block">
              Acabamento:
            </span>
            <p className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 break-words whitespace-normal mt-0.5">
              {pedido.acabamento}
            </p>
          </div>
        )}

        {/* Observação / Instrução de Produção ou Alerta da Fábrica */}
        {pedido.observacao && (
          <div className="pt-1.5 border-t border-slate-200/80 dark:border-slate-700/60 min-w-0 max-w-full">
            {temProblema ? (
              <div className="rounded-lg border-2 border-red-600 bg-red-500/20 dark:bg-red-950/50 p-2 text-red-950 dark:text-red-100 shadow-sm">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider block text-red-600 dark:text-red-400 flex items-center gap-1 animate-pulse">
                  🚨 ALERTA DA FÁBRICA / PROBLEMA TRAVADO:
                </span>
                <p className="text-[11px] sm:text-xs font-black break-words whitespace-normal mt-0.5 leading-snug text-red-700 dark:text-red-200">
                  {pedido.observacao}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-amber-950 dark:text-amber-100 shadow-2xs">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider block text-amber-700 dark:text-amber-400">
                  ⚠️ Instrução de Produção:
                </span>
                <p className="text-[11px] sm:text-xs font-bold break-words whitespace-normal mt-0.5 leading-snug">
                  {pedido.observacao}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bônus / Comissão do Colaborador (Regra: integral para cada um) */}
        {pedido.comissao_percent != null && pedido.comissao_percent > 0 && pedido.total > 0 && (
          <div className="pt-1.5 border-t border-amber-500/30 min-w-0 max-w-full">
            <div className="rounded-xl border border-amber-500/60 bg-gradient-to-r from-amber-500/15 via-yellow-500/15 to-amber-500/15 p-2 shadow-2xs flex flex-col items-center justify-center gap-1 text-center">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-xs sm:text-sm leading-none shrink-0">🪙</span>
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  BÔNUS COLABORADOR
                </span>
              </div>
              <span className="rounded-md bg-amber-500 text-slate-950 font-black text-xs sm:text-sm px-2.5 py-0.5 shadow-2xs">
                R$ {((pedido.total * pedido.comissao_percent) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} cada
              </span>
              <span className="text-[9px] font-semibold text-muted-foreground/80 leading-none">
                (integral para cada um que produzir)
              </span>
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
  velocidadeScroll = 12,
}: {
  status: StatusPedido
  label: string
  borda: string
  fundo: string
  pedidos: PedidoTV[]
  tamanhoGrande?: boolean
  velocidadeScroll?: number
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
  // Baseado em delta de tempo para velocidade constante e confortável em qualquer Smart TV (60Hz ou 120Hz)
  useEffect(() => {
    const el = containerRef.current
    if (!el || !temOverflow) return

    let animId: number
    let timeoutId: NodeJS.Timeout | null = null
    let direcao = 1 // 1: descendo, -1: subindo
    let pausado = true // Começa pausado no topo para leitura inicial
    let scrollPos = el.scrollTop // Acumulador de precisão para evitar truncamento em Smart TVs
    let ultimoTempo = performance.now()

    // Inicia a rolagem para baixo após 6 segundos de pausa no topo para leitura confortável
    timeoutId = setTimeout(() => {
      pausado = false
      ultimoTempo = performance.now()
    }, 6000)

    const rolar = (tempoAtual: number) => {
      if (!el) return
      const maxScroll = el.scrollHeight - el.clientHeight
      if (maxScroll <= 2) {
        animId = requestAnimationFrame(rolar)
        return
      }

      const deltaMs = Math.min(tempoAtual - ultimoTempo, 100)
      ultimoTempo = tempoAtual

      if (!pausado) {
        if (direcao === 1) {
          // Descendo suavemente conforme velocidade configurada pelo dono
          const pixelsPorSegundo = velocidadeScroll || 12
          scrollPos += (pixelsPorSegundo * deltaMs) / 1000

          if (scrollPos >= maxScroll) {
            scrollPos = maxScroll
            el.scrollTop = maxScroll
            setEstaNoTopo(false)
            setEstaNoFim(true)
            pausado = true
            // Pausa no final por 6 segundos para leitura dos últimos pedidos antes de subir
            timeoutId = setTimeout(() => {
              direcao = -1
              pausado = false
              ultimoTempo = performance.now()
            }, 6000)
          } else {
            el.scrollTop = Math.round(scrollPos)
            setEstaNoTopo(el.scrollTop <= 5)
            setEstaNoFim(el.scrollTop >= maxScroll - 5)
          }
        } else {
          // Subindo suavemente de volta ao topo
          const pixelsPorSegundo = (velocidadeScroll || 12) * 1.5
          scrollPos -= (pixelsPorSegundo * deltaMs) / 1000

          if (scrollPos <= 0) {
            scrollPos = 0
            el.scrollTop = 0
            setEstaNoTopo(true)
            setEstaNoFim(false)
            pausado = true
            // Pausa no topo por 6 segundos antes de descer novamente
            timeoutId = setTimeout(() => {
              direcao = 1
              pausado = false
              ultimoTempo = performance.now()
            }, 6000)
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
  }, [temOverflow, velocidadeScroll])

  return (
    <div
      id={`tv-coluna-${status}`}
      className="flex h-full min-h-0 flex-1 min-w-[210px] sm:min-w-[230px] 2xl:min-w-0 flex-col gap-2"
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

function TvColunaEmergencias({
  avisos,
  pedidos,
  tamanhoGrande = true,
  velocidadeScroll = 12,
}: {
  avisos: AvisoTV[]
  pedidos: PedidoTV[]
  tamanhoGrande?: boolean
  velocidadeScroll?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [temOverflow, setTemOverflow] = useState(false)
  const [estaNoFim, setEstaNoFim] = useState(false)
  const [estaNoTopo, setEstaNoTopo] = useState(true)

  const totalItens = avisos.length + pedidos.length

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
  }, [totalItens, tamanhoGrande])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !temOverflow) return

    let animId: number
    let timeoutId: NodeJS.Timeout | null = null
    let direcao = 1
    let pausado = true
    let scrollPos = el.scrollTop
    let ultimoTempo = performance.now()

    timeoutId = setTimeout(() => {
      pausado = false
      ultimoTempo = performance.now()
    }, 6000)

    const rolar = (tempoAtual: number) => {
      if (!el) return
      const maxScroll = el.scrollHeight - el.clientHeight
      if (maxScroll <= 2) {
        animId = requestAnimationFrame(rolar)
        return
      }

      const deltaMs = Math.min(tempoAtual - ultimoTempo, 100)
      ultimoTempo = tempoAtual

      if (!pausado) {
        if (direcao === 1) {
          const pixelsPorSegundo = velocidadeScroll || 12
          scrollPos += (pixelsPorSegundo * deltaMs) / 1000

          if (scrollPos >= maxScroll) {
            scrollPos = maxScroll
            el.scrollTop = maxScroll
            setEstaNoTopo(false)
            setEstaNoFim(true)
            pausado = true
            timeoutId = setTimeout(() => {
              direcao = -1
              pausado = false
              ultimoTempo = performance.now()
            }, 6000)
          } else {
            el.scrollTop = Math.round(scrollPos)
            setEstaNoTopo(el.scrollTop <= 5)
            setEstaNoFim(el.scrollTop >= maxScroll - 5)
          }
        } else {
          const pixelsPorSegundo = (velocidadeScroll || 12) * 1.5
          scrollPos -= (pixelsPorSegundo * deltaMs) / 1000

          if (scrollPos <= 0) {
            scrollPos = 0
            el.scrollTop = 0
            setEstaNoTopo(true)
            setEstaNoFim(false)
            pausado = true
            timeoutId = setTimeout(() => {
              direcao = 1
              pausado = false
              ultimoTempo = performance.now()
            }, 6000)
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
      if (pausado) scrollPos = el.scrollTop
    }
    el.addEventListener("scroll", sincronizarScroll, { passive: true })

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      cancelAnimationFrame(animId)
      el.removeEventListener("scroll", sincronizarScroll)
    }
  }, [temOverflow, velocidadeScroll])

  return (
    <div
      id="tv-coluna-emergencias"
      className="flex h-full min-h-0 flex-1 min-w-[210px] sm:min-w-[230px] 2xl:min-w-0 flex-col gap-2"
    >
      {/* Cabeçalho da Coluna de Emergências */}
      <div className="flex shrink-0 items-center justify-between rounded-xl border-2 border-red-600 bg-gradient-to-r from-red-600/20 via-red-500/15 to-red-600/20 dark:bg-red-950/70 px-2.5 sm:px-3 py-2 shadow-lg ring-2 ring-red-500/50">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-base sm:text-lg animate-bounce leading-none shrink-0">🚨</span>
          <span className="text-xs sm:text-sm lg:text-base font-black tracking-tight truncate text-red-700 dark:text-red-300 uppercase">
            Emergências
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-red-600 text-white px-2 py-0.5 text-xs sm:text-sm font-black shadow-xs">
          {totalItens}
        </span>
      </div>

      {/* Container com scroll suave */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
        <div
          ref={containerRef}
          className="flex h-full min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pr-0.5"
        >
          {/* Seção 1: Avisos / Emergências da Fábrica */}
          {avisos.map((aviso) => (
            <AvisoCard
              key={`aviso-col-${aviso.id}`}
              aviso={aviso}
              tamanhoGrande={tamanhoGrande}
            />
          ))}

          {/* Divisor caso haja avisos E pedidos com problema */}
          {avisos.length > 0 && pedidos.length > 0 && (
            <div className="flex items-center gap-2 pt-1 pb-0.5">
              <div className="h-px bg-red-500/30 flex-1" />
              <span className="text-[10px] font-black uppercase text-red-600 dark:text-red-400 tracking-wider">
                Pedidos com Alerta ({pedidos.length})
              </span>
              <div className="h-px bg-red-500/30 flex-1" />
            </div>
          )}

          {/* Seção 2: Pedidos com Alerta / Travados */}
          {pedidos.map((pedido) => (
            <PedidoCard
              key={`pedido-alerta-${pedido.id}`}
              pedido={pedido}
              tamanhoGrande={tamanhoGrande}
              mostrarColunaBadge={true}
            />
          ))}

          {totalItens === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-red-500/30 py-8 text-sm text-red-500/50 italic font-semibold">
              Sem emergências no momento
            </div>
          )}
        </div>

        {temOverflow && !estaNoFim && (
          <div className="pointer-events-none absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-background via-background/80 to-transparent flex items-end justify-center pb-1">
            <span className="text-[10px] font-black text-red-600 dark:text-red-400 animate-bounce">
              ↓ rolando ({totalItens} itens)
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
  const versaoInicialRef = useRef<string | null>(null)
  const ultimoRecarregarTokenRef = useRef<number | null>(null)
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
    velocidadeScroll?: number
    recarregarEm?: number
  } | null>(null)

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/tv/pedidos?_t=${Date.now()}`, { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()

        // 🔄 Atualização automática do Telão sem precisar de F5 físico:
        // 1. Se uma nova versão for publicada em produção
        if (data.versao) {
          if (versaoInicialRef.current === null) {
            versaoInicialRef.current = String(data.versao)
          } else if (versaoInicialRef.current !== String(data.versao)) {
            const url = new URL(window.location.href)
            url.searchParams.set("_v", String(data.versao))
            window.location.replace(url.toString())
            return
          }
        }
        // 2. Se o dono clicou "Atualizar Monitor da TV Agora" na Central do Telão
        if (data.config?.recarregarEm) {
          const token = Number(data.config.recarregarEm)
          if (ultimoRecarregarTokenRef.current === null) {
            ultimoRecarregarTokenRef.current = token
          } else if (token !== ultimoRecarregarTokenRef.current) {
            ultimoRecarregarTokenRef.current = token
            const url = new URL(window.location.href)
            url.searchParams.set("_reload", String(Date.now()))
            window.location.replace(url.toString())
            return
          }
        }

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
    // Garante que a TV nunca fique presa em Service Worker ou cache estático
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((r) => r.unregister().catch(() => {}))
      }).catch(() => {})
    }

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

  const avisosAtivos = useMemo(() => {
    return avisos.filter((a) => (a as { ativo?: boolean }).ativo !== false)
  }, [avisos])

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
          title="Exibir ou ocultar coluna de avisos e emergências no Telão"
        >
          {config?.mostrarColunaAlertas !== false ? "🚨 Coluna Emergências: ON" : "🚨 Coluna Emergências: OFF"}
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

          {config?.mostrarColunaAlertas !== false && (avisosAtivos.length > 0 || pedidosAlertas.length > 0) && (
            <button
              type="button"
              onClick={() => setFiltroStatusMobile("urgencias")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 border transition-all ${
                filtroStatusMobile === "urgencias"
                  ? "bg-red-600 text-white border-red-600 shadow-xs font-black"
                  : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/20"
              }`}
            >
              <span>🚨 Emergências & Avisos</span>
              <span className="rounded-full px-1.5 py-0.2 text-[10px] font-black bg-red-600 text-white">
                {avisosAtivos.length + pedidosAlertas.length}
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
          {filtroStatusMobile === "urgencias" ? (
            <>
              {avisosAtivos.map((aviso) => (
                <AvisoCard
                  key={`mobile-aviso-${aviso.id}`}
                  aviso={aviso}
                  tamanhoGrande={config?.tamanhoFonte !== "normal"}
                />
              ))}
              {pedidosAlertas.map((pedido) => (
                <PedidoCard
                  key={`mobile-card-${pedido.id}`}
                  pedido={pedido}
                  tamanhoGrande={config?.tamanhoFonte !== "normal"}
                  mostrarColunaBadge={true}
                />
              ))}
              {avisosAtivos.length === 0 && pedidosAlertas.length === 0 && (
                <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-border/40 py-12 text-sm text-muted-foreground font-semibold">
                  Nenhuma emergência ativa
                </div>
              )}
            </>
          ) : (
            <>
              {filtroStatusMobile === "todos" && avisosAtivos.length > 0 && (
                <div className="flex flex-col gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="text-sm leading-none animate-bounce">🚨</span>
                    <span className="text-xs font-black uppercase text-red-600 dark:text-red-400 tracking-wider">
                      Emergências da Fábrica ({avisosAtivos.length}):
                    </span>
                  </div>
                  {avisosAtivos.map((aviso) => (
                    <AvisoCard
                      key={`mobile-top-aviso-${aviso.id}`}
                      aviso={aviso}
                      tamanhoGrande={config?.tamanhoFonte !== "normal"}
                    />
                  ))}
                </div>
              )}

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
            </>
          )}
        </div>
      </div>

      {/* Visualização DESKTOP / TV: Kanban lado a lado com auto-scroll infinito */}
      <div className="flex-1 min-h-0 hidden md:flex flex-row gap-2 sm:gap-2.5 w-full overflow-x-auto overflow-y-hidden [scrollbar-width:thin] pb-1">
        {/* Coluna Dedicada de Avisos & Emergências da Fábrica */}
        {config?.mostrarColunaAlertas !== false && (avisosAtivos.length > 0 || pedidosAlertas.length > 0) && (
          <TvColunaEmergencias
            key="coluna-emergencias-destaque"
            avisos={avisosAtivos}
            pedidos={pedidosAlertas}
            tamanhoGrande={config?.tamanhoFonte !== "normal"}
            velocidadeScroll={config?.velocidadeScroll || 12}
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
              velocidadeScroll={config?.velocidadeScroll || 12}
            />
          )
        })}
      </div>

      {pedidosEfetivos.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-muted-foreground/40 sm:text-2xl pointer-events-none">
          Nenhum pedido em andamento no momento
        </div>
      )}

      {/* Ticker de avisos rodapé: só exibe como fallback se a coluna de emergências for desativada */}
      {avisosAtivos.length > 0 && config?.mostrarColunaAlertas === false && (
        <div className="shrink-0 overflow-hidden rounded-xl border border-border/80 bg-card py-2 shadow-xs group/ticker">
          <div
            className="ticker-track hover:[animation-play-state:paused]"
            style={{ animationDuration: `${Math.max(avisosAtivos.length * 40, 80)}s` }}
          >
            {[
              ...avisosAtivos,
              ...avisosAtivos,
            ].map((aviso, i) => (
              <span
                key={`${aviso.id}-${i}`}
                className={`text-sm font-black sm:text-base flex items-center gap-2 ${COR_CLASSE[aviso.cor ?? "azul"] ?? COR_CLASSE.azul}`}
              >
                <span className="text-base sm:text-lg">{aviso.icone ?? "📢"}</span>
                <span>{aviso.mensagem}</span>
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
    </div>
  )
}
