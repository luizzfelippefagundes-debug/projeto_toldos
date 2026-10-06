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

const COLUNAS: { status: StatusPedido; label: string; cor: string }[] = [
  { status: "aguardando", label: "Aguardando", cor: "border-slate-600 bg-slate-800" },
  { status: "aprovado",   label: "Aprovado",   cor: "border-blue-600 bg-blue-950" },
  { status: "arte",       label: "Arte",        cor: "border-violet-500 bg-violet-950" },
  { status: "impressao",  label: "Impressão",   cor: "border-amber-500 bg-amber-950" },
  { status: "acabamento", label: "Acabamento",  cor: "border-orange-500 bg-orange-950" },
  { status: "pronto",     label: "Pronto ✓",    cor: "border-emerald-500 bg-emerald-950" },
]

function estaAtrasado(prazo: string | null) {
  if (!prazo) return false
  return prazo < new Date().toISOString().slice(0, 10)
}

function formatarPrazo(prazo: string | null) {
  if (!prazo) return null
  const [ano, mes, dia] = prazo.split("-")
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

  const hora = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  const data = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })

  return (
    <div className="text-right">
      <div className="text-5xl font-bold tabular-nums tracking-tight">{hora}</div>
      <div className="mt-1 text-lg capitalize text-slate-400">{data}</div>
    </div>
  )
}

export default function TvPage() {
  const [pedidos, setPedidos] = useState<PedidoTV[]>([])
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null)

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/tv/pedidos", { cache: "no-store" })
      if (res.ok) {
        setPedidos(await res.json())
        setUltimaAtualizacao(new Date())
      }
    } catch {
      // silently retry on next interval
    }
  }, [])

  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 60_000)
    return () => clearInterval(t)
  }, [carregar])

  const totalAtivos = pedidos.length
  const totalAtrasados = pedidos.filter((p) => estaAtrasado(p.prazo_entrega_em)).length

  return (
    <div className="flex min-h-screen flex-col p-6 gap-6">
      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500 text-lg font-bold">
              T
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Toldos Print</h1>
            <span className="text-slate-500 text-xl">— Painel de Produção</span>
          </div>
          <div className="mt-2 flex items-center gap-4 text-sm text-slate-400">
            <span>{totalAtivos} pedido{totalAtivos !== 1 ? "s" : ""} em andamento</span>
            {totalAtrasados > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-red-900/60 px-3 py-0.5 text-red-300 font-medium">
                ⚠ {totalAtrasados} atrasado{totalAtrasados !== 1 ? "s" : ""}
              </span>
            )}
            {ultimaAtualizacao && (
              <span className="text-slate-600">
                atualizado às {ultimaAtualizacao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>
        <Relogio />
      </header>

      {/* Kanban */}
      <div className="flex flex-1 gap-4 overflow-x-auto pb-2">
        {COLUNAS.map(({ status, label, cor }) => {
          const colPedidos = pedidos.filter((p) => p.status === status)
          return (
            <div key={status} className="flex w-72 shrink-0 flex-col gap-3">
              <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${cor}`}>
                <span className="font-semibold tracking-wide">{label}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-sm font-bold">
                  {colPedidos.length}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {colPedidos.map((pedido) => {
                  const atrasado = estaAtrasado(pedido.prazo_entrega_em)
                  return (
                    <div
                      key={pedido.id}
                      className={`rounded-xl border p-4 transition-colors ${
                        atrasado
                          ? "border-red-500 bg-red-950/60"
                          : "border-slate-700 bg-slate-800/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-slate-500">#{pedido.numero}</span>
                        {atrasado && (
                          <span className="shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                            ATRASADO
                          </span>
                        )}
                        {pedido.prazo_entrega_em && !atrasado && (
                          <span className="shrink-0 rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                            até {formatarPrazo(pedido.prazo_entrega_em)}
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-lg font-bold leading-tight">
                        {pedido.cliente_nome}
                      </p>

                      <p className="mt-1 text-sm text-slate-300">
                        {pedido.produto_nome ?? "—"}
                        {pedido.variante_nome ? ` · ${pedido.variante_nome}` : ""}
                      </p>

                      {pedido.acabamento && (
                        <p className="mt-1 text-xs text-slate-400">
                          Acabamento: {pedido.acabamento}
                        </p>
                      )}

                      {pedido.observacao && (
                        <p className="mt-2 rounded-md bg-slate-900/60 px-2 py-1 text-xs italic text-slate-400 line-clamp-2">
                          {pedido.observacao}
                        </p>
                      )}
                    </div>
                  )
                })}

                {colPedidos.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-800 py-8 text-center text-sm text-slate-700">
                    vazio
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {pedidos.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-2xl font-semibold text-slate-700">
          Nenhum pedido em andamento no momento
        </div>
      )}
    </div>
  )
}
