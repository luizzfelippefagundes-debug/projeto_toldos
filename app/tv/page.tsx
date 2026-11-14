"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
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
    const t = setTimeout(verificar, 350)
    window.addEventListener("resize", verificar)
    return () => {
      clearTimeout(t)
      window.removeEventListener("resize", verificar)
    }
  }, [pedidos, tamanhoGrande])

  // Auto-scroll contínuo e cíclico (Desce suavemente -> pausa -> sobe suavemente -> pausa -> repete)
  useEffect(() => {
    const el = containerRef.current
    if (!el || !temOverflow) return

    let animId: number
    let timeoutId: NodeJS.Timeout | null = null
    let direcao = 1 // 1: descendo, -1: subindo
    let pausado = true // Começa pausado no topo para leitura inicial

    // Inicia a rolagem para baixo após 3.5 segundos de pausa no topo
    timeoutId = setTimeout(() => {
      pausado = false
    }, 3500)

    const rolar = () => {
      if (!el) return
      const maxScroll = el.scrollHeight - el.clientHeight
      if (maxScroll <= 0) return

      if (!pausado) {
        if (direcao === 1) {
          // Descendo suavemente
          el.scrollTop += 0.85
          setEstaNoTopo(el.scrollTop <= 5)
          setEstaNoFim(el.scrollTop >= maxScroll - 5)

          if (el.scrollTop >= maxScroll - 1) {
            pausado = true
            // Pausa no final para leitura dos últimos pedidos
            timeoutId = setTimeout(() => {
              direcao = -1
              pausado = false
            }, 3500)
          }
        } else {
          // Subindo suavemente de volta ao topo
          el.scrollTop -= 1.3
          setEstaNoTopo(el.scrollTop <= 5)
          setEstaNoFim(el.scrollTop >= maxScroll - 5)

          if (el.scrollTop <= 1) {
            el.scrollTop = 0
            pausado = true
            // Pausa no topo para nova leitura antes de descer de novo
            timeoutId = setTimeout(() => {
              direcao = 1
              pausado = false
            }, 4000)
          }
        }
      }

      // IMPORTANTE: Mantém o loop de animação vivo a cada frame sem morrer
      animId = requestAnimationFrame(rolar)
    }

    animId = requestAnimationFrame(rolar)

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      cancelAnimationFrame(animId)
    }
  }, [temOverflow, pedidos])

  return (
    <div
      id={`tv-coluna-${status}`}
      className="flex h-full min-h-0 flex-col gap-2 w-[85vw] max-w-[340px] shrink-0 snap-center md:w-auto md:max-w-none md:flex-1 md:min-w-0 md:shrink"
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
          {pedidos.map((pedido) => {
            const atrasado = estaAtrasado(pedido)
            return (
              <div
                key={pedido.id}
                className={`shrink-0 rounded-2xl border-2 transition-all p-3 sm:p-3.5 lg:p-4 shadow-sm ${
                  atrasado
                    ? "border-red-500 bg-red-50/95 shadow-md dark:border-red-600 dark:bg-red-950/80"
                    : "border-slate-200/90 bg-white shadow-2xs dark:border-slate-700/80 dark:bg-slate-900/95"
                }`}
              >
                {/* Linha superior: Tag OS / Pedido + Tipo + Prazo/Atrasado */}
                <div className="flex items-center justify-between gap-1.5 leading-none">
                  <div className="flex items-center gap-1.5 min-w-0">
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
                  </div>

                  {atrasado ? (
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
                <div className="mt-2 flex flex-col gap-2 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 p-2.5 sm:p-3.5 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
                  {/* Medidas / Quantidade em destaque com badge próprio para bater o olho */}
                  {pedido.variante_nome && (
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/15 border border-primary/30 px-2.5 py-1 text-xs sm:text-sm font-black text-primary">
                        <span>📏</span>
                        <span>DIMENSÕES: {pedido.variante_nome}</span>
                      </span>
                    </div>
                  )}

                  {/* Produto / Serviço com quebra de linha natural (NUNCA CORTA) */}
                  <div>
                    <span className="text-[10px] sm:text-[11px] text-muted-foreground uppercase font-black tracking-wider block">
                      Serviço / Produto:
                    </span>
                    <p className="font-black text-foreground text-sm sm:text-base lg:text-lg leading-snug break-words whitespace-normal mt-0.5">
                      {pedido.produto_nome ?? "Item de Produção"}
                    </p>
                  </div>

                  {/* Acabamento completo com quebra de linha */}
                  {pedido.acabamento && (
                    <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-700/50">
                      <span className="text-[10px] sm:text-[11px] text-muted-foreground uppercase font-black tracking-wider block">
                        Acabamento:
                      </span>
                      <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 break-words whitespace-normal mt-0.5">
                        {pedido.acabamento}
                      </p>
                    </div>
                  )}

                  {/* Observação da OS / Pedido completa */}
                  {pedido.observacao && (
                    <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-700/50">
                      <span className="text-[10px] sm:text-[11px] text-muted-foreground uppercase font-black tracking-wider block">
                        Obs:
                      </span>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 italic break-words whitespace-normal mt-0.5">
                        {pedido.observacao}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

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
    tamanhoFonte?: "normal" | "grande"
    ocultarVazias?: boolean
  } | null>(null)

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/tv/pedidos", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setPedidos(data.pedidos ?? data)
        setAvisos(data.avisos ?? [])
        if (data.config) {
          setConfig(data.config)
          if (data.config.tema && (data.config.tema === "light" || data.config.tema === "dark")) {
            setThemeRef.current(data.config.tema)
          }
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

  // Se ocultarVazias estiver ativo, expande as colunas com pedidos para ocupar a tela toda
  const colunasFiltradas = useMemo(() => {
    const autorizadas = COLUNAS.filter((c) =>
      (config?.statusVisiveis ?? COLUNAS.map((col) => col.status)).includes(c.status)
    )

    if (config?.ocultarVazias) {
      const comPedidos = autorizadas.filter((c) => {
        const count = pedidos.filter(
          (p) => p.status === c.status || (c.status === "aprovado" && (p.status as string) === "arte")
        ).length
        return count > 0
      })
      return comPedidos.length > 0 ? comPedidos : autorizadas
    }

    return autorizadas
  }, [config?.statusVisiveis, config?.ocultarVazias, pedidos])

  return (
    <div className="group/tv flex h-screen max-h-screen w-screen overflow-hidden flex-col gap-2.5 sm:gap-3 p-2.5 sm:p-4 bg-background">

      {/* Barra flutuante de utilitários da TV — visível ao passar o mouse ou interagir */}
      <div className="fixed top-2.5 right-3 z-50 flex items-center gap-2 opacity-0 sm:group-hover/tv:opacity-100 transition-opacity duration-200">
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
          href="/dashboard"
          className="rounded-lg bg-card/90 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm border border-border/80 backdrop-blur hover:bg-muted"
        >
          ← Voltar ao Sistema
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
              href="/dashboard"
              className="sm:hidden ml-auto rounded-lg bg-card/90 px-2 py-1 text-[11px] font-black text-foreground border border-border/80 shadow-2xs"
            >
              ← Sair
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
          </div>
        </div>

        <Relogio />
      </header>

      {/* Barra de Navegação Rápida entre Etapas (apenas Mobile para deslizar com 1 toque) */}
      <div className="flex md:hidden gap-1.5 overflow-x-auto pb-0.5 shrink-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {colunasFiltradas.map((coluna) => {
          const colPedidos = pedidos.filter(
            (p) => p.status === coluna.status || (coluna.status === "aprovado" && (p.status as string) === "arte")
          )
          return (
            <button
              key={`nav-${coluna.status}`}
              type="button"
              onClick={() => {
                const el = document.getElementById(`tv-coluna-${coluna.status}`)
                el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shrink-0 border transition-all active:scale-95 ${
                colPedidos.length > 0
                  ? "border-primary/50 bg-primary/10 text-primary font-black shadow-2xs"
                  : "border-border/60 bg-muted/40 text-muted-foreground opacity-60"
              }`}
            >
              <span>{coluna.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                  colPedidos.length > 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {colPedidos.length}
              </span>
            </button>
          )
        })}
      </div>

      {/* Kanban de Colunas: Em TV/desktop distribui em 1 linha 100% visível; no celular carrossel horizontal suave com snap */}
      <div className="flex-1 min-h-0 flex flex-row gap-2.5 sm:gap-3 w-full overflow-x-auto md:overflow-hidden snap-x snap-mandatory md:snap-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-0.5 md:px-0">
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
              tamanhoGrande={config?.tamanhoFonte !== "normal"}
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
