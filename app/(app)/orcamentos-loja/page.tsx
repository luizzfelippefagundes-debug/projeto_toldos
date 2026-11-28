"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useData } from "@/context/data-context"
import { usePapelAtivo } from "@/context/papel-ativo-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { OrcamentoDetalheDialog } from "@/components/orcamentos/orcamento-detalhe-dialog"
import { formatarDataHora } from "@/lib/format"
import { resumirPedidoLoja, somenteDigitos } from "@/lib/loja-orcamento"
import { PAPEIS_ORCAMENTOS_LOJA, contarOrcamentosLojaAbertos } from "@/lib/orcamentos-loja"
import type { StatusOrcamento } from "@/lib/types"
import { ExternalLink, MapPin, MessageCircle, Search, ShoppingBag } from "lucide-react"

const statusLabel: Record<StatusOrcamento, string> = {
  aberto: "Aberto",
  fechado: "Fechado",
  cancelado: "Cancelado",
}

const statusVariant: Record<StatusOrcamento, "default" | "secondary" | "destructive"> = {
  aberto: "default",
  fechado: "secondary",
  cancelado: "destructive",
}

type FiltroStatus = "abertos" | "fechados" | "todos"

/** Link wa.me com o 55 na frente quando o número veio só com DDD. */
function linkWhatsapp(telefone: string) {
  let d = somenteDigitos(telefone)
  if (d.length === 10 || d.length === 11) d = `55${d}`
  return d.length >= 12 ? `https://wa.me/${d}` : null
}

export default function OrcamentosLojaPage() {
  return (
    <Suspense fallback={null}>
      <OrcamentosLoja />
    </Suspense>
  )
}

function OrcamentosLoja() {
  const { orcamentos, clientes } = useData()
  const { papel } = usePapelAtivo()
  const searchParams = useSearchParams()
  const abrir = searchParams.get("abrir")

  const [filtro, setFiltro] = useState<FiltroStatus>("abertos")
  const [busca, setBusca] = useState("")
  const [detalheId, setDetalheId] = useState<string | null>(null)

  // Vindo do link do WhatsApp (?abrir=orc-...): abre o orçamento assim que ele carregar.
  useEffect(() => {
    if (abrir && orcamentos.some((o) => o.id === abrir)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetalheId(abrir)
    }
  }, [abrir, orcamentos])

  const daLoja = useMemo(
    () =>
      orcamentos
        .filter((o) => o.origem === "loja")
        .map((o) => {
          const cliente = clientes.find((c) => c.id === o.clienteId)
          return { orcamento: o, cliente, resumo: resumirPedidoLoja(o.observacao) }
        })
        .sort((a, b) => b.orcamento.criadoEm.localeCompare(a.orcamento.criadoEm)),
    [orcamentos, clientes]
  )

  const abertos = useMemo(() => contarOrcamentosLojaAbertos(orcamentos), [orcamentos])
  const fechados = daLoja.filter((l) => l.orcamento.status === "fechado").length
  const [agora] = useState(() => Date.now())
  const ultimas24h = daLoja.filter(
    (l) => agora - new Date(l.orcamento.criadoEm).getTime() < 24 * 60 * 60 * 1000
  ).length

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const termoDigitos = somenteDigitos(termo)
    return daLoja.filter(({ orcamento, cliente, resumo }) => {
      if (filtro === "abertos" && orcamento.status !== "aberto") return false
      if (filtro === "fechados" && orcamento.status !== "fechado") return false
      if (!termo) return true
      const campos = [
        String(orcamento.numero),
        cliente?.nome ?? "",
        resumo.cidade ?? "",
        resumo.codigo,
        ...resumo.itens,
      ]
        .join(" ")
        .toLowerCase()
      if (campos.includes(termo)) return true
      return termoDigitos.length >= 4 && somenteDigitos(cliente?.telefone ?? "").includes(termoDigitos)
    })
  }, [daLoja, filtro, busca])

  if (papel !== "dono" && !PAPEIS_ORCAMENTOS_LOJA.includes(papel)) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Você não tem acesso aos orçamentos da loja.
      </p>
    )
  }

  const botoesFiltro: { valor: FiltroStatus; label: string; qtd: number }[] = [
    { valor: "abertos", label: "Abertos", qtd: abertos },
    { valor: "fechados", label: "Fechados", qtd: fechados },
    { valor: "todos", label: "Todos", qtd: daLoja.length },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ShoppingBag className="h-6 w-6 text-sky-500" />
            Orçamentos da loja
          </h1>
          <p className="text-sm text-muted-foreground">
            Pedidos de orçamento feitos pelo site. Clique em um para ver os detalhes, editar ou enviar.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-center">
            <p className="text-xl font-semibold text-sky-700 dark:text-sky-400">{abertos}</p>
            <p className="text-[11px] text-muted-foreground">em aberto</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
            <p className="text-xl font-semibold">{ultimas24h}</p>
            <p className="text-[11px] text-muted-foreground">últimas 24h</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nº, cliente, cidade, item..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-9 bg-background pl-9 pr-7 text-sm"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              title="Limpar busca"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {botoesFiltro.map((b) => (
            <Button
              key={b.valor}
              type="button"
              size="sm"
              variant={filtro === b.valor ? "default" : "outline"}
              className="h-8 shrink-0 rounded-lg text-xs"
              onClick={() => setFiltro(b.valor)}
            >
              {b.label} ({b.qtd})
            </Button>
          ))}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-14 text-center">
          <ShoppingBag className="h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">
            {daLoja.length === 0 ? "Nenhum orçamento pelo site ainda" : "Nenhum orçamento para esse filtro"}
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {daLoja.length === 0
              ? "Quando um cliente pedir orçamento pela loja on-line, ele aparece aqui e o aviso chega no WhatsApp."
              : "Tente outro filtro ou limpe a busca."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtrados.map(({ orcamento, cliente, resumo }) => {
            const wa = cliente?.telefone ? linkWhatsapp(cliente.telefone) : null
            return (
              <div
                key={orcamento.id}
                role="button"
                tabIndex={0}
                onClick={() => setDetalheId(orcamento.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setDetalheId(orcamento.id)
                  }
                }}
                className="flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent/50 md:flex-row md:items-start md:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">#{orcamento.numero}</span>
                    <Badge variant={statusVariant[orcamento.status]}>{statusLabel[orcamento.status]}</Badge>
                    <span className="text-xs text-muted-foreground">{formatarDataHora(orcamento.criadoEm)}</span>
                    {resumo.codigo && <span className="text-xs text-muted-foreground">· {resumo.codigo}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-medium">{cliente?.nome ?? "Cliente removido"}</span>
                    {cliente?.telefone && <span className="text-muted-foreground">{cliente.telefone}</span>}
                    {resumo.cidade && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {resumo.cidade}
                      </span>
                    )}
                  </div>
                  {resumo.itens.length > 0 && (
                    <ul className="space-y-0.5 text-xs text-muted-foreground">
                      {resumo.itens.slice(0, 3).map((item, i) => (
                        <li key={i} className="truncate">
                          • {item}
                        </li>
                      ))}
                      {resumo.itens.length > 3 && <li>• … e mais {resumo.itens.length - 3}</li>}
                    </ul>
                  )}
                  {resumo.observacaoCliente && (
                    <p className="line-clamp-2 text-xs italic text-muted-foreground">
                      “{resumo.observacaoCliente}”
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2" onClick={(e) => e.stopPropagation()}>
                  {wa && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-xs"
                      render={<a href={wa} target="_blank" rel="noopener noreferrer" />}
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                      WhatsApp
                    </Button>
                  )}
                  <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => setDetalheId(orcamento.id)}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir orçamento
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <OrcamentoDetalheDialog orcamentoId={detalheId} onOpenChange={(open) => !open && setDetalheId(null)} />
    </div>
  )
}
