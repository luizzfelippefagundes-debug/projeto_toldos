"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { useTheme } from "next-themes"
import { interpretarDataLocal } from "@/lib/date"

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

function TvColuna({
  label,
  borda,
  fundo,
  pedidos,
  compacto,
}: {
  status: StatusPedido
  label: string
  borda: string
  fundo: string
  pedidos: PedidoTV[]
  compacto: boolean
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
      const transborda = el.scrollHeight > el.clientHeight + 6
      setTemOverflow(transborda)
      setEstaNoTopo(el.scrollTop <= 5)
      setEstaNoFim(el.scrollTop + el.clientHeight >= el.scrollHeight - 5)
    }
    verificar()
    const t = setTimeout(verificar, 300)
    window.addEventListener("resize", verificar)
    return () => {
      clearTimeout(t)
      window.removeEventListener("resize", verificar)
    }
  }, [pedidos, compacto])

  // Auto-scroll suave e contínuo para Smart TVs (onde não há mouse nem toque)
  useEffect(() => {
    const el = containerRef.current
    if (!el || !temOverflow) return

    let animId: number
    let timeoutId: NodeJS.Timeout
    let direcao = 1 // 1: descendo, -1: subindo
    let pausado = false

    const rolar = () => {
      if (pausado) return
      const maxScroll = el.scrollHeight - el.clientHeight
      if (maxScroll <= 0) return

      if (direcao === 1) {
        el.scrollTop += 0.8
        setEstaNoTopo(el.scrollTop <= 5)
        setEstaNoFim(el.scrollTop >= maxScroll - 5)

        if (el.scrollTop >= maxScroll - 1) {
          pausado = true
          timeoutId = setTimeout(() => {
            direcao = -1
            pausado = false
          }, 3500)
        }
      } else {
        el.scrollTop -= 1.2
        setEstaNoTopo(el.scrollTop <= 5)
        setEstaNoFim(el.scrollTop >= maxScroll - 5)

        if (el.scrollTop <= 0) {
          pausado = true
          timeoutId = setTimeout(() => {
            direcao = 1
            pausado = false
          }, 4000)
        }
      }

      animId = requestAnimationFrame(rolar)
    }

    timeoutId = setTimeout(() => {
      animId = requestAnimationFrame(rolar)
    }, 3500)

    return () => {
      clearTimeout(timeoutId)
      cancelAnimationFrame(animId)
    }
  }, [temOverflow, pedidos])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-1.5 sm:gap-2 min-w-0">
      {/* Cabeçalho da coluna */}
      <div
        className={`flex shrink-0 items-center justify-between rounded-lg border px-2 sm:px-2.5 py-1.5 shadow-2xs ${borda} ${fundo}`}
      >
        <span className="text-xs font-bold tracking-tight sm:text-sm truncate">
          {label}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-black ${
            pedidos.length > 0
              ? "bg-foreground/15 text-foreground"
              : "bg-black/5 dark:bg-white/5 text-muted-foreground opacity-50"
          }`}
        >
          {pedidos.length}
        </span>
      </div>

      {/* Container de cards com auto-scroll suave e sem barras de rolagem cortando */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl">
        <div
          ref={containerRef}
          className="flex h-full min-h-0 flex-1 flex-col gap-1.5 sm:gap-2 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pr-0.5"
        >
          {pedidos.map((pedido) => {
            const atrasado = estaAtrasado(pedido)
            return (
              <div
                key={pedido.id}
                className={`shrink-0 rounded-xl border transition-all ${
                  compacto ? "p-2 sm:p-2.5" : "p-2.5 sm:p-3"
                } ${
                  atrasado
                    ? "border-red-500/80 bg-red-50/90 shadow-sm dark:bg-red-950/70"
                    : "border-slate-200/90 bg-white/95 shadow-2xs dark:border-slate-800 dark:bg-slate-900/90"
                }`}
              >
                {/* Linha superior: Tag OS / Pedido + Tipo + Prazo/Atrasado */}
                <div className="flex items-center justify-between gap-1 leading-none">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-extrabold text-[11px] sm:text-xs text-foreground tracking-tight shrink-0">
                      {pedido.tipo === "orcamento" ? `OS #${pedido.numero}` : `#${pedido.numero}`}
                    </span>
                    {pedido.tipo === "orcamento" ? (
                      <span className="rounded bg-blue-500/15 px-1 py-0.5 text-[9px] font-bold text-blue-700 dark:text-blue-300 uppercase shrink-0">
                        Com. Visual
                      </span>
                    ) : (
                      <span className="rounded bg-violet-500/15 px-1 py-0.5 text-[9px] font-bold text-violet-700 dark:text-violet-300 uppercase shrink-0">
                        Rápida
                      </span>
                    )}
                  </div>

                  {atrasado ? (
                    <span className="shrink-0 rounded-md bg-red-600 px-1.5 py-0.5 text-[9px] font-black text-white uppercase tracking-wider animate-pulse">
                      Atrasado
                    </span>
                  ) : pedido.prazo_entrega_em ? (
                    <span className="shrink-0 rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                      até {formatarPrazo(pedido.prazo_entrega_em)}
                    </span>
                  ) : null}
                </div>

                {/* Nome do Cliente em Destaque Forte */}
                <p
                  className={`mt-1 font-extrabold text-foreground leading-snug truncate ${
                    compacto ? "text-xs sm:text-sm" : "text-sm sm:text-base"
                  }`}
                  title={pedido.cliente_nome}
                >
                  {pedido.cliente_nome}
                </p>

                {/* Produto + Medida/Variante */}
                <p
                  className={`mt-0.5 text-muted-foreground truncate leading-tight ${
                    compacto ? "text-[11px] sm:text-xs" : "text-xs sm:text-sm"
                  }`}
                >
                  <span className="font-semibold text-foreground/90">{pedido.produto_nome ?? "Item"}</span>
                  {pedido.variante_nome && (
                    <span className="text-muted-foreground"> · {pedido.variante_nome}</span>
                  )}
                </p>

                {/* Acabamento se houver */}
                {pedido.acabamento && (
                  <p className="mt-0.5 text-[10px] sm:text-[11px] text-muted-foreground/80 truncate">
                    {pedido.acabamento}
                  </p>
                )}

                {/* Observação curta se houver */}
                {pedido.observacao && (
                  <p className="mt-1 line-clamp-1 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] italic text-muted-foreground">
                    {pedido.observacao}
                  </p>
                )}
              </div>
            )
          })}

          {pedidos.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/40 py-6 text-xs text-muted-foreground/40 italic">
              Vazio
            </div>
          )}
        </div>

        {/* Indicador de auto-scroll para a equipe na fábrica */}
        {temOverflow && !estaNoFim && (
          <div className="pointer-events-none absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-background via-background/80 to-transparent flex items-end justify-center pb-0.5">
            <span className="text-[9px] font-bold text-primary/80 animate-bounce">
              ↓ rolando ({pedidos.length} pedidos)
            </span>
          </div>
        )}
        {temOverflow && !estaNoTopo && (
          <div className="pointer-events-none absolute top-0 inset-x-0 h-4 bg-gradient-to-b from-background to-transparent" />
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
      <div className="text-3xl font-bold tabular-nums tracking-tight sm:text-4xl lg:text-5xl">
        {agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      <div className="mt-0.5 text-sm capitalize text-slate-500 sm:text-base dark:text-slate-400">
        {agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
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

export default function TvPage() {
  const [pedidos, setPedidos] = useState<PedidoTV[]>([])
  const [avisos, setAvisos] = useState<AvisoTV[]>([])
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null)
  const [config, setConfig] = useState<{
    statusVisiveis?: string[]
    tiposVisiveis?: string[]
    mostrarAtrasados?: boolean
    somAlarme?: boolean
    apenasRecentes?: boolean
    densidade?: "normal" | "compacto"
  } | null>(null)

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/tv/pedidos", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setPedidos(data.pedidos ?? data)
        setAvisos(data.avisos ?? [])
        if (data.config) setConfig(data.config)
        setUltimaAtualizacao(new Date())
      }
    } catch { /* retry on next interval */ }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
    const t = setInterval(carregar, 60_000)
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
          ultimoDoServidor = tema
          setThemeRef.current(tema)
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

  const totalAtivos = pedidos.length
  const totalAtrasados = pedidos.filter((p) => estaAtrasado(p)).length
  const colunasFiltradas = COLUNAS.filter((c) =>
    (config?.statusVisiveis ?? COLUNAS.map((col) => col.status)).includes(c.status)
  )

  return (
    <div className="group/tv flex h-screen max-h-screen w-screen overflow-hidden flex-col gap-2.5 sm:gap-3 p-2.5 sm:p-4 bg-background">

      {/* Barra flutuante de utilitários da TV — visível ao passar o mouse ou interagir */}
      <div className="fixed top-2.5 right-3 z-50 flex items-center gap-2 opacity-0 group-hover/tv:opacity-100 transition-opacity duration-200">
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
          href="/dashboard"
          className="rounded-lg bg-card/90 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm border border-border/80 backdrop-blur hover:bg-muted"
        >
          ← Voltar ao Sistema
        </Link>
      </div>

      {/* Header Compacto de Alta Legibilidade para TV */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl bg-[#0060a7] px-2.5 py-1.5 dark:bg-transparent dark:p-0">
              <Image
                src="/brand/logo.png"
                alt="Toldos Print"
                width={1200}
                height={394}
                priority
                className="h-auto w-36 sm:w-48 lg:w-56"
              />
            </div>
            <div className="h-6 w-px bg-border/60 hidden sm:block" />
            <span className="hidden sm:inline text-base sm:text-xl font-black tracking-tight text-foreground/80">
              Painel de Produção
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-bold text-foreground">
              {totalAtivos} pedido{totalAtivos !== 1 ? "s" : ""} ativo{totalAtivos !== 1 ? "s" : ""}
            </span>
            {config?.apenasRecentes && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-bold text-amber-600 dark:text-amber-400 text-xs">
                ⚡ 5 Mais Recentes
              </span>
            )}
            {totalAtrasados > 0 && config?.mostrarAtrasados !== false && (
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-bold text-red-600 dark:text-red-400 text-xs animate-pulse">
                ⚠ {totalAtrasados} atrasado{totalAtrasados !== 1 ? "s" : ""}
              </span>
            )}
            {ultimaAtualizacao && (
              <span className="text-[11px] text-muted-foreground/70">
                Sincronizado às {ultimaAtualizacao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>

        <Relogio />
      </header>

      {/* Kanban de Colunas: Garantido em 1 única linha horizontal sem quebrar */}
      <div className="flex-1 min-h-0 flex flex-row gap-2 sm:gap-3 w-full overflow-hidden">
        {colunasFiltradas.map((coluna) => {
          const colPedidos = pedidos.filter(
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
              compacto={config?.densidade !== "normal"}
            />
          )
        })}
      </div>

      {pedidos.length === 0 && (
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
    </div>
  )
}
