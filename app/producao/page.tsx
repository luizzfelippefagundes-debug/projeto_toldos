"use client"

import { useEffect, useMemo, useState } from "react"
import { useData } from "@/context/data-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatarMoeda } from "@/lib/format"
import type { PedidoRapido, StatusPedidoRapido } from "@/lib/types"
import { cn } from "@/lib/utils"
import { RefreshCw, Search } from "lucide-react"

const colunas: { status: StatusPedidoRapido; titulo: string }[] = [
  { status: "aguardando", titulo: "Aguardando" },
  { status: "aprovado", titulo: "Aprovado" },
  { status: "arte", titulo: "Arte" },
  { status: "impressao", titulo: "Impressão" },
  { status: "acabamento", titulo: "Acabamento" },
  { status: "pronto", titulo: "Pronto" },
  { status: "entregue", titulo: "Entregue" },
]

const statusLabel: Record<StatusPedidoRapido, string> = Object.fromEntries(
  colunas.map((c) => [c.status, c.titulo])
) as Record<StatusPedidoRapido, string>

const MS_POR_DIA = 1000 * 60 * 60 * 24

export default function ProducaoPage() {
  const { pedidosRapidos, produtosRapidos, moverPedidoRapido } = useData()
  const [busca, setBusca] = useState("")
  const [statusFiltro, setStatusFiltro] = useState<StatusPedidoRapido | "todas">(
    "todas"
  )

  // "Atrasados" depende de "hoje" (new Date()). Assim como no Dashboard,
  // calcular isso direto no render faria essa tela ser pré-renderizada
  // estaticamente com uma data de build congelada. Começa null (mesmo valor
  // no servidor e no primeiro render do cliente) e só calcula após montar.
  const [hoje, setHoje] = useState<Date | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoje(new Date())
  }, [])

  function produtoDoPedido(pedido: PedidoRapido) {
    return produtosRapidos.find((p) => p.id === pedido.produtoId)
  }

  function estaAtrasado(pedido: PedidoRapido) {
    if (!hoje || pedido.status === "entregue") return false
    const produto = produtoDoPedido(pedido)
    if (!produto) return false
    const diasCorridos =
      (hoje.getTime() - new Date(pedido.criadoEm).getTime()) / MS_POR_DIA
    return diasCorridos > produto.prazoDias
  }

  const pedidosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return pedidosRapidos.filter((pedido) => {
      if (statusFiltro !== "todas" && pedido.status !== statusFiltro)
        return false
      if (!termo) return true
      return (
        pedido.clienteNome.toLowerCase().includes(termo) ||
        String(pedido.numero).includes(termo)
      )
    })
  }, [pedidosRapidos, busca, statusFiltro])

  const emProducao = pedidosRapidos.filter((p) =>
    ["aprovado", "arte", "impressao", "acabamento", "pronto"].includes(
      p.status
    )
  ).length
  const atrasados = pedidosRapidos.filter(estaAtrasado).length
  const prontos = pedidosRapidos.filter((p) => p.status === "pronto").length
  const valorTotal = pedidosRapidos
    .filter((p) => p.status !== "entregue")
    .reduce((soma, p) => soma + p.total, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">PCP — Produção</h1>
          <p className="text-sm text-muted-foreground">
            Kanban de produção com os pedidos da Gráfica Rápida.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Em produção
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {emProducao} pedidos
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Atrasados
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {hoje ? atrasados : "—"} pedidos
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Prontos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {prontos} pedidos
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valor total
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {formatarMoeda(valorTotal)}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar pedido, cliente..."
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFiltro("todas")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              statusFiltro === "todas"
                ? "border-primary bg-primary/15 font-medium text-foreground"
                : "border-border text-muted-foreground hover:bg-accent"
            )}
          >
            Todas ({pedidosRapidos.length})
          </button>
          {colunas.map((coluna) => (
            <button
              key={coluna.status}
              onClick={() => setStatusFiltro(coluna.status)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                statusFiltro === coluna.status
                  ? "border-primary bg-primary/15 font-medium text-foreground"
                  : "border-border text-muted-foreground hover:bg-accent"
              )}
            >
              {coluna.titulo} (
              {pedidosRapidos.filter((p) => p.status === coluna.status).length})
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {colunas.map((coluna) => {
          const pedidosDaColuna = pedidosFiltrados.filter(
            (p) => p.status === coluna.status
          )
          return (
            <div key={coluna.status} className="flex min-w-48 flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {coluna.titulo}
                </span>
                <Badge variant="secondary">{pedidosDaColuna.length}</Badge>
              </div>
              <div className="flex flex-col gap-2">
                {pedidosDaColuna.length === 0 && (
                  <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    Vazio
                  </div>
                )}
                {pedidosDaColuna.map((pedido) => {
                  const produto = produtoDoPedido(pedido)
                  const atrasado = estaAtrasado(pedido)
                  return (
                    <Card key={pedido.id}>
                      <CardContent className="flex flex-col gap-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">#{pedido.numero}</span>
                          {atrasado && (
                            <Badge variant="destructive">Atrasado</Badge>
                          )}
                        </div>
                        <p className="font-medium">
                          {produto?.nome ?? "Produto removido"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {pedido.clienteNome || "Sem cliente"}
                        </p>
                        <p className="text-sm font-semibold text-primary">
                          {formatarMoeda(pedido.total)}
                        </p>
                        <Select
                          value={pedido.status}
                          onValueChange={(v) =>
                            moverPedidoRapido(
                              pedido.id,
                              (v as StatusPedidoRapido) ?? pedido.status
                            )
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {colunas.map((c) => (
                              <SelectItem key={c.status} value={c.status}>
                                {statusLabel[c.status]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
