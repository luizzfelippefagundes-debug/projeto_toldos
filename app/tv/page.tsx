"use client"

import { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { useTheme } from "next-themes"
import { interpretarDataLocal } from "@/lib/date"

type StatusPedido = "aguardando" | "aprovado" | "arte" | "impressao" | "acabamento" | "pronto"

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
  { status: "aguardando", label: "Aguardando", borda: "border-slate-600",  fundo: "bg-slate-200 dark:bg-slate-800/70" },
  { status: "aprovado",   label: "Aprovado",   borda: "border-blue-600",   fundo: "bg-blue-100 dark:bg-blue-950/70" },
  { status: "arte",       label: "Arte",        borda: "border-violet-500", fundo: "bg-violet-100 dark:bg-violet-950/70" },
  { status: "impressao",  label: "Impressão",   borda: "border-amber-500",  fundo: "bg-amber-100 dark:bg-amber-950/70" },
  { status: "acabamento", label: "Acabamento",  borda: "border-orange-500", fundo: "bg-orange-100 dark:bg-orange-950/70" },
  { status: "pronto",     label: "Pronto ✓",    borda: "border-emerald-500",fundo: "bg-emerald-100 dark:bg-emerald-950/70" },
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

function Relogio() {
  const [agora, setAgora] = useState<Date | null>(null)
  useEffect(() => {
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

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/tv/pedidos", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setPedidos(data.pedidos ?? data)
        setAvisos(data.avisos ?? [])
        setUltimaAtualizacao(new Date())
      }
    } catch { /* retry on next interval */ }
  }, [])

  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 60_000)
    return () => clearInterval(t)
  }, [carregar])

  // A TV roda em outro aparelho: segue o tema escolhido no sistema, que fica
  // salvo no servidor. Consulta leve a cada 10 s pra trocar quase na hora.
  const { setTheme } = useTheme()
  useEffect(() => {
    async function sincronizarTema() {
      try {
        const res = await fetch("/api/tv/tema", { cache: "no-store" })
        if (!res.ok) return
        const { tema } = await res.json()
        if (tema === "light" || tema === "dark") setTheme(tema)
      } catch { /* tenta de novo no próximo ciclo */ }
    }
    sincronizarTema()
    const t = setInterval(sincronizarTema, 10_000)
    return () => clearInterval(t)
  }, [setTheme])

  // Alarme periódico se houver aviso com som ativado
  useEffect(() => {
    const comSom = avisos.some((a) => a.som)
    if (!comSom) return
    tocarAlarme()
    const t = setInterval(tocarAlarme, 30_000)
    return () => clearInterval(t)
  }, [avisos])

  const totalAtivos = pedidos.length
  const totalAtrasados = pedidos.filter((p) => estaAtrasado(p)).length

  return (
    <div className="group/tv flex h-screen flex-col gap-3 overflow-hidden p-3 sm:gap-4 sm:p-5">

      {/* Botão voltar — visível só ao passar o mouse */}
      <Link
        href="/dashboard"
        className="fixed top-3 right-3 z-50 rounded-lg bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 opacity-0 shadow-sm backdrop-blur transition-opacity hover:text-slate-900 group-hover/tv:opacity-100 dark:bg-slate-800/80 dark:text-slate-400 dark:shadow-none dark:hover:text-white"
      >
        ← Voltar
      </Link>

      {/* Header */}
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* O logo tem letras brancas: no claro vai sobre o azul da marca. */}
            <div className="shrink-0 rounded-xl bg-[#0060a7] px-3 py-2 dark:bg-transparent dark:p-0">
              <Image
                src="/brand/logo.png"
                alt="Toldos Print"
                width={1200}
                height={394}
                priority
                className="h-auto w-40 sm:w-56 lg:w-72"
              />
            </div>
            <span className="hidden text-slate-500 sm:inline sm:text-lg lg:text-2xl dark:text-slate-400">Produção</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 sm:gap-3 sm:text-sm dark:text-slate-400">
            <span>{totalAtivos} pedido{totalAtivos !== 1 ? "s" : ""}</span>
            {totalAtrasados > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700 dark:bg-red-900/60 dark:text-red-300">
                ⚠ {totalAtrasados} atrasado{totalAtrasados !== 1 ? "s" : ""}
              </span>
            )}
            {ultimaAtualizacao && (
              <span className="text-slate-400 dark:text-slate-600">
                {ultimaAtualizacao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>
        <Relogio />
      </header>

      {/* Kanban grid — auto-fit: encaixa todas as colunas na largura disponível */}
      <div
        className="min-h-0 flex-1 gap-2 sm:gap-3"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))" }}
      >
        {COLUNAS.map(({ status, label, borda, fundo }) => {
          const colPedidos = pedidos.filter((p) => p.status === status)
          return (
            <div key={status} className="flex min-h-0 flex-col gap-2">
              {/* Cabeçalho da coluna */}
              <div className={`flex shrink-0 items-center justify-between rounded-lg border px-2 py-1.5 sm:px-3 sm:py-2 ${borda} ${fundo}`}>
                <span className="text-xs font-semibold tracking-wide sm:text-sm">{label}</span>
                <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-xs font-bold sm:px-2 dark:bg-white/10">
                  {colPedidos.length}
                </span>
              </div>

              {/* Cards com scroll interno */}
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
                {colPedidos.map((pedido) => {
                  const atrasado = estaAtrasado(pedido)
                  return (
                    <div
                      key={pedido.id}
                      className={`shrink-0 rounded-xl border p-2.5 sm:p-3 ${
                        atrasado
                          ? "border-red-500 bg-red-50 dark:bg-red-950/60"
                          : "border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/80 dark:shadow-none"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[10px] font-bold text-slate-500 sm:text-xs">
                          #{pedido.numero}
                        </span>
                        {atrasado ? (
                          <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white sm:text-xs">
                            ATRASADO
                          </span>
                        ) : pedido.prazo_entrega_em ? (
                          <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            até {formatarPrazo(pedido.prazo_entrega_em)}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-sm font-bold leading-tight sm:text-base lg:text-lg">
                        {pedido.cliente_nome}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-600 sm:text-sm dark:text-slate-300">
                        {pedido.produto_nome ?? "—"}
                        {pedido.variante_nome ? ` · ${pedido.variante_nome}` : ""}
                      </p>

                      {pedido.acabamento && (
                        <p className="mt-0.5 text-[10px] text-slate-500 sm:text-xs dark:text-slate-400">
                          {pedido.acabamento}
                        </p>
                      )}

                      {pedido.observacao && (
                        <p className="mt-1.5 line-clamp-2 rounded-md bg-slate-100 px-2 py-1 text-[10px] italic text-slate-600 sm:text-xs dark:bg-slate-900/60 dark:text-slate-400">
                          {pedido.observacao}
                        </p>
                      )}
                    </div>
                  )
                })}

                {colPedidos.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 py-6 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-700">
                    vazio
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {pedidos.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-xl font-semibold text-slate-400 sm:text-2xl dark:text-slate-700">
          Nenhum pedido em andamento no momento
        </div>
      )}

      {/* Ticker de avisos */}
      {avisos.length > 0 && (
        <div className="shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:shadow-none">
          <div
            className="ticker-track"
            style={{ animationDuration: `${Math.max(avisos.length * 10, 20)}s` }}
          >
            {[...avisos, ...avisos].map((aviso, i) => (
              <span
                key={`${aviso.id}-${i}`}
                className={`text-sm font-semibold sm:text-base ${COR_CLASSE[aviso.cor ?? "azul"] ?? COR_CLASSE.azul}`}
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
