"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
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
import type { PedidoRapido, ProdutoRapido, StatusPedidoRapido } from "@/lib/types"
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

const statusValidos = new Set<string>(colunas.map((c) => c.status))

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
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)

  // Distância mínima antes de considerar um arraste: sem isso, um simples
  // clique no card (ex.: pra abrir o Select de status) já dispararia o
  // sensor de arraste e atrapalharia o clique normal.
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
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

  const pedidoArrastando = arrastandoId
    ? pedidosRapidos.find((p) => p.id === arrastandoId)
    : null

  function handleDragStart(event: DragStartEvent) {
    setArrastandoId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setArrastandoId(null)
    const { active, over } = event
    if (!over) return
    const novoStatus = String(over.id)
    if (!statusValidos.has(novoStatus)) return
    const pedido = pedidosRapidos.find((p) => p.id === active.id)
    if (!pedido || pedido.status === novoStatus) return
    moverPedidoRapido(String(active.id), novoStatus as StatusPedidoRapido)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">PCP — Produção</h1>
          <p className="text-sm text-muted-foreground">
            Kanban de produção com os pedidos da Gráfica Rápida. Arraste um
            card pra outra coluna pra mudar o status.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="relative min-w-56 flex-1">
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

      <DndContext
        sensors={sensores}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
          {colunas.map((coluna) => {
            const pedidosDaColuna = pedidosFiltrados.filter(
              (p) => p.status === coluna.status
            )
            return (
              <ColunaDroppable key={coluna.status} status={coluna.status}>
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
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
                  {pedidosDaColuna.map((pedido) => (
                    <PedidoCardArrastavel key={pedido.id} pedido={pedido}>
                      <PedidoCardConteudo
                        pedido={pedido}
                        produto={produtoDoPedido(pedido)}
                        atrasado={estaAtrasado(pedido)}
                        onMudarStatus={(status) =>
                          moverPedidoRapido(pedido.id, status)
                        }
                      />
                    </PedidoCardArrastavel>
                  ))}
                </div>
              </ColunaDroppable>
            )
          })}
        </div>

        <DragOverlay>
          {pedidoArrastando ? (
            <div className="w-64 rotate-2 opacity-90 shadow-lg">
              <PedidoCardConteudo
                pedido={pedidoArrastando}
                produto={produtoDoPedido(pedidoArrastando)}
                atrasado={estaAtrasado(pedidoArrastando)}
                onMudarStatus={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function ColunaDroppable({
  status,
  children,
}: {
  status: StatusPedidoRapido
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-64 shrink-0 flex-col gap-2 rounded-lg p-1 transition-colors",
        isOver && "bg-primary/5 ring-1 ring-primary/30"
      )}
    >
      {children}
    </div>
  )
}

function PedidoCardArrastavel({
  pedido,
  children,
}: {
  pedido: PedidoRapido
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: pedido.id,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab touch-none active:cursor-grabbing",
        isDragging && "opacity-30"
      )}
    >
      {children}
    </div>
  )
}

function PedidoCardConteudo({
  pedido,
  produto,
  atrasado,
  onMudarStatus,
}: {
  pedido: PedidoRapido
  produto: ProdutoRapido | undefined
  atrasado: boolean
  onMudarStatus: (status: StatusPedidoRapido) => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium">#{pedido.numero}</span>
          {atrasado && <Badge variant="destructive">Atrasado</Badge>}
        </div>
        <p className="font-medium">{produto?.nome ?? "Produto removido"}</p>
        <p className="text-xs text-muted-foreground">
          {pedido.clienteNome || "Sem cliente"}
        </p>
        <p className="text-sm font-semibold text-primary">
          {formatarMoeda(pedido.total)}
        </p>
        {/* onPointerDown para de propagar pro sensor de arraste, senão abrir
            o Select (que também responde a pointer down) competiria com o
            gesto de arrastar o card inteiro. */}
        <div onPointerDown={(e) => e.stopPropagation()}>
          <Select
            value={pedido.status}
            onValueChange={(v) =>
              onMudarStatus((v as StatusPedidoRapido) ?? pedido.status)
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
        </div>
      </CardContent>
    </Card>
  )
}
