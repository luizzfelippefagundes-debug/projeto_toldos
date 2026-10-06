"use client"

import { useEffect, useState, useCallback } from "react"

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
  azul:     "text-blue-400",
  verde:    "text-emerald-400",
  amarelo:  "text-yellow-400",
  vermelho: "text-red-400",
  roxo:     "text-violet-400",
  laranja:  "text-orange-400",
  branco:   "text-white",
  rosa:     "text-pink-400",
}

const COLUNAS: { status: StatusPedido; label: string; borda: string; fundo: string }[] = [
  { status: "aguardando", label: "Aguardando", borda: "border-slate-600",  fundo: "bg-slate-800/70" },
  { status: "aprovado",   label: "Aprovado",   borda: "border-blue-600",   fundo: "bg-blue-950/70" },
  { status: "arte",       label: "Arte",        borda: "border-violet-500", fundo: "bg-violet-950/70" },
  { status: "impressao",  label: "Impressão",   borda: "border-amber-500",  fundo: "bg-amber-950/70" },
  { status: "acabamento", label: "Acabamento",  borda: "border-orange-500", fundo: "bg-orange-950/70" },
  { status: "pronto",     label: "Pronto ✓",    borda: "border-emerald-500",fundo: "bg-emerald-950/70" },
]

function estaAtrasado(prazo: string | null) {
  if (!prazo) return false
  return prazo < new Date().toISOString().slice(0, 10)
}

function formatarPrazo(prazo: string | null) {
  if (!prazo) return null
  const [, mes, dia] = prazo.split("-")
  return `${dia}/${mes}`
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
      <div className="mt-0.5 text-sm capitalize text-slate-400 sm:text-base">
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

  // Alarme periódico se houver aviso com som ativado
  useEffect(() => {
    const comSom = avisos.some((a) => a.som)
    if (!comSom) return
    tocarAlarme()
    const t = setInterval(tocarAlarme, 30_000)
    return () => clearInterval(t)
  }, [avisos])

  const totalAtivos = pedidos.length
  const totalAtrasados = pedidos.filter((p) => estaAtrasado(p.prazo_entrega_em)).length

  return (
    <div className="flex h-screen flex-col gap-3 overflow-hidden p-3 sm:gap-4 sm:p-5">

      {/* Header */}
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-sm font-bold sm:h-10 sm:w-10 sm:text-lg">
              T
            </div>
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
              Toldos Print
            </h1>
            <span className="hidden text-slate-500 sm:inline sm:text-lg">— Produção</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400 sm:gap-3 sm:text-sm">
            <span>{totalAtivos} pedido{totalAtivos !== 1 ? "s" : ""}</span>
            {totalAtrasados > 0 && (
              <span className="rounded-full bg-red-900/60 px-2 py-0.5 font-medium text-red-300">
                ⚠ {totalAtrasados} atrasado{totalAtrasados !== 1 ? "s" : ""}
              </span>
            )}
            {ultimaAtualizacao && (
              <span className="text-slate-600">
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
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-xs font-bold sm:px-2">
                  {colPedidos.length}
                </span>
              </div>

              {/* Cards com scroll interno */}
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
                {colPedidos.map((pedido) => {
                  const atrasado = estaAtrasado(pedido.prazo_entrega_em)
                  return (
                    <div
                      key={pedido.id}
                      className={`shrink-0 rounded-xl border p-2.5 sm:p-3 ${
                        atrasado
                          ? "border-red-500 bg-red-950/60"
                          : "border-slate-700 bg-slate-800/80"
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
                          <span className="shrink-0 rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">
                            até {formatarPrazo(pedido.prazo_entrega_em)}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-sm font-bold leading-tight sm:text-base lg:text-lg">
                        {pedido.cliente_nome}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-300 sm:text-sm">
                        {pedido.produto_nome ?? "—"}
                        {pedido.variante_nome ? ` · ${pedido.variante_nome}` : ""}
                      </p>

                      {pedido.acabamento && (
                        <p className="mt-0.5 text-[10px] text-slate-400 sm:text-xs">
                          {pedido.acabamento}
                        </p>
                      )}

                      {pedido.observacao && (
                        <p className="mt-1.5 line-clamp-2 rounded-md bg-slate-900/60 px-2 py-1 text-[10px] italic text-slate-400 sm:text-xs">
                          {pedido.observacao}
                        </p>
                      )}
                    </div>
                  )
                })}

                {colPedidos.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-800 py-6 text-xs text-slate-700">
                    vazio
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {pedidos.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-xl font-semibold text-slate-700 sm:text-2xl">
          Nenhum pedido em andamento no momento
        </div>
      )}

      {/* Ticker de avisos */}
      {avisos.length > 0 && (
        <div className="shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/80 py-2">
          <div
            className="ticker-track"
            style={{ animationDuration: `${Math.max(avisos.length * 10, 20)}s` }}
          >
            {[...avisos, ...avisos].map((aviso, i) => (
              <span
                key={`${aviso.id}-${i}`}
                className={`text-sm font-semibold sm:text-base ${COR_CLASSE[aviso.cor ?? "azul"] ?? "text-blue-400"}`}
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
