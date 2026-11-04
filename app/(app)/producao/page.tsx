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
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatarData, formatarMoeda } from "@/lib/format"
import { usePapelAtivo } from "@/context/papel-ativo-context"
import type {
  Cliente,
  Material,
  Orcamento,
  PedidoRapido,
  ProdutoRapido,
  StatusPedidoRapido,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  obterPrazoEntregaPedido,
  pedidoRapidoEstaAtrasado,
} from "@/lib/pedidos-rapidos"
import { RefreshCw, Search, Clock, AlertTriangle, CheckCircle2, Package, UserRound } from "lucide-react"

const colunas: {
  status: StatusPedidoRapido
  titulo: string
  cor: string
  corFundo: string
  corBorda: string
  corTexto: string
}[] = [
  {
    status: "aguardando",
    titulo: "Aguardando",
    cor: "bg-slate-500",
    corFundo: "bg-slate-500/10",
    corBorda: "border-slate-500/40",
    corTexto: "text-slate-500",
  },
  {
    status: "aprovado",
    titulo: "Aprovado",
    cor: "bg-blue-500",
    corFundo: "bg-blue-500/10",
    corBorda: "border-blue-500/40",
    corTexto: "text-blue-500",
  },
  {
    status: "arte",
    titulo: "Arte",
    cor: "bg-violet-500",
    corFundo: "bg-violet-500/10",
    corBorda: "border-violet-500/40",
    corTexto: "text-violet-500",
  },
  {
    status: "impressao",
    titulo: "Impressão",
    cor: "bg-orange-500",
    corFundo: "bg-orange-500/10",
    corBorda: "border-orange-500/40",
    corTexto: "text-orange-500",
  },
  {
    status: "acabamento",
    titulo: "Acabamento",
    cor: "bg-yellow-500",
    corFundo: "bg-yellow-500/10",
    corBorda: "border-yellow-500/40",
    corTexto: "text-yellow-600",
  },
  {
    status: "pronto",
    titulo: "Pronto",
    cor: "bg-green-500",
    corFundo: "bg-green-500/10",
    corBorda: "border-green-500/40",
    corTexto: "text-green-600",
  },
  {
    status: "entregue",
    titulo: "Entregue",
    cor: "bg-emerald-600",
    corFundo: "bg-emerald-600/10",
    corBorda: "border-emerald-600/40",
    corTexto: "text-emerald-600",
  },
]

const colunaMap = Object.fromEntries(colunas.map((c) => [c.status, c])) as Record<
  StatusPedidoRapido,
  (typeof colunas)[number]
>

const statusValidos = new Set<string>(colunas.map((c) => c.status))

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter((p) => /[a-zA-ZÀ-ú]/.test(p[0]))
  if (partes.length === 0) return null
  return partes.slice(0, 2).map((p) => p[0]).join("").toUpperCase()
}

// O quadro mistura dois tipos de trabalho — pedidos da Gráfica Rápida e
// orçamentos de toldo que já tiveram a OS emitida —, então cada card usa essa
// forma só com o que o quadro precisa mostrar, sem se importar com a origem.
interface ItemProducao {
  tipo: "pedido" | "orcamento"
  id: string
  numero: number
  numeroRotulo: string
  clienteNome: string
  status: StatusPedidoRapido
  atrasado: boolean
  dataRotulo: string
  data: Date | null
  valor: number
  tituloProduto: string
  subtituloProduto: string | null
}

function pedidoParaItem(
  pedido: PedidoRapido,
  produto: ProdutoRapido | undefined,
  atrasado: boolean
): ItemProducao {
  return {
    tipo: "pedido",
    id: pedido.id,
    numero: pedido.numero,
    numeroRotulo: `#${pedido.numero}`,
    clienteNome: pedido.clienteNome?.trim() || "",
    status: pedido.status,
    atrasado,
    dataRotulo: "Prazo",
    data: obterPrazoEntregaPedido(pedido, produto?.prazoDias),
    valor: pedido.total,
    tituloProduto: pedido.produtoNome ?? produto?.nome ?? "Produto removido",
    subtituloProduto: pedido.varianteNome ?? null,
  }
}

// Só entra no quadro depois de emitida a OS (orcamento.statusProducao
// definido — ver o botão "Emitir OS e enviar pra produção" na tela da OS).
function orcamentoParaItem(
  orcamento: Orcamento,
  clientes: Cliente[],
  materiais: Material[]
): ItemProducao | null {
  if (!orcamento.statusProducao) return null
  const cliente = clientes.find((c) => c.id === orcamento.clienteId)
  const material = materiais.find((m) => m.id === orcamento.item.materialId)
  const unidade = orcamento.materialFechado?.unidade ?? material?.unidade
  const medida =
    unidade === "m2" && orcamento.item.largura > 0 && orcamento.item.altura > 0
      ? `${orcamento.item.largura} × ${orcamento.item.altura} m`
      : orcamento.item.quantidadeUnidades > 1
        ? `${orcamento.item.quantidadeUnidades} un`
        : null
  const itensExtras = orcamento.item.itensAdicionais?.length ?? 0
  return {
    tipo: "orcamento",
    id: orcamento.id,
    numero: orcamento.numero,
    numeroRotulo: `OS #${orcamento.numero}`,
    clienteNome: cliente?.nome?.trim() || "",
    status: orcamento.statusProducao,
    // Orçamento de toldo ainda não tem prazo de produção configurável; sem
    // prazo não dá pra calcular atraso (fica pro dono acompanhar pela etapa).
    atrasado: false,
    dataRotulo: "Emitida em",
    data: orcamento.osEmitidaEm ? new Date(orcamento.osEmitidaEm) : null,
    valor: orcamento.totalFechado ?? 0,
    tituloProduto: orcamento.materialFechado?.nome ?? material?.nome ?? "Material removido",
    subtituloProduto:
      [medida, itensExtras > 0 ? `+${itensExtras} ${itensExtras === 1 ? "item" : "itens"}` : null]
        .filter(Boolean)
        .join(" · ") || null,
  }
}

export default function ProducaoPage() {
  const {
    pedidosRapidos,
    produtosRapidos,
    moverPedidoRapido,
    orcamentos,
    clientes,
    materiais,
    moverStatusProducaoOrcamento,
  } = useData()
  const [busca, setBusca] = useState("")
  const [colunaAtiva, setColunaAtiva] = useState<StatusPedidoRapido | "todas">("todas")
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const [hoje, setHoje] = useState<Date | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoje(new Date())
  }, [])

  function produtoDoPedido(pedido: PedidoRapido) {
    return produtosRapidos.find((p) => p.id === pedido.produtoId)
  }

  function estaAtrasado(pedido: PedidoRapido) {
    if (!hoje) return false
    const produto = produtoDoPedido(pedido)
    return pedidoRapidoEstaAtrasado(pedido, produto?.prazoDias, hoje)
  }

  // Pedidos da Gráfica Rápida + orçamentos de toldo com OS emitida, juntos
  // num quadro só.
  const itens = useMemo<ItemProducao[]>(() => {
    const dosPedidos = pedidosRapidos.map((pedido) =>
      pedidoParaItem(pedido, produtoDoPedido(pedido), estaAtrasado(pedido))
    )
    const dosOrcamentos = orcamentos
      .map((o) => orcamentoParaItem(o, clientes, materiais))
      .filter((item): item is ItemProducao => item !== null)
    return [...dosPedidos, ...dosOrcamentos]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidosRapidos, produtosRapidos, orcamentos, clientes, materiais, hoje])

  function moverStatus(item: ItemProducao, status: StatusPedidoRapido) {
    if (item.tipo === "pedido") moverPedidoRapido(item.id, status)
    else moverStatusProducaoOrcamento(item.id, status)
  }

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return itens.filter((item) => {
      if (!termo) return true
      return (
        item.clienteNome.toLowerCase().includes(termo) ||
        String(item.numero).includes(termo)
      )
    })
  }, [itens, busca])

  const emProducao = itens.filter((i) =>
    ["aprovado", "arte", "impressao", "acabamento", "pronto"].includes(i.status)
  ).length
  const atrasados = itens.filter((i) => i.atrasado).length
  const prontos = itens.filter((i) => i.status === "pronto").length

  const itemArrastando = arrastandoId
    ? (itens.find((i) => i.id === arrastandoId) ?? null)
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
    const item = itens.find((i) => i.id === active.id)
    if (!item || item.status === novoStatus) return
    moverStatus(item, novoStatus as StatusPedidoRapido)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">PCP — Produção</h1>
          <p className="text-sm text-muted-foreground">
            Arraste os cards entre colunas para mover o status.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
            <Package className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Em produção</p>
            <p className="text-xl font-bold">{emProducao}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/15">
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Atrasados</p>
            <p className={cn("text-xl font-bold", atrasados > 0 && "text-destructive")}>
              {hoje ? atrasados : "—"}
            </p>
          </div>
        </div>
        <div className="col-span-2 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:col-span-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500/15">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Prontos p/ entrega</p>
            <p className={cn("text-xl font-bold", prontos > 0 && "text-green-600")}>
              {prontos}
            </p>
          </div>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente ou número..."
          className="pl-9"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {/* Filtro de coluna — visível só no mobile */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden">
        <button
          onClick={() => setColunaAtiva("todas")}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            colunaAtiva === "todas"
              ? "border-primary bg-primary/15 text-foreground"
              : "border-border text-muted-foreground"
          )}
        >
          Todas ({itensFiltrados.length})
        </button>
        {colunas.map((col) => {
          const qtd = itensFiltrados.filter((i) => i.status === col.status).length
          return (
            <button
              key={col.status}
              onClick={() => setColunaAtiva(col.status)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                colunaAtiva === col.status
                  ? `${col.cor} border-transparent text-white`
                  : "border-border text-muted-foreground"
              )}
            >
              {col.titulo} ({qtd})
            </button>
          )
        })}
      </div>

      {/* Mobile: lista de cards em coluna única */}
      <div className="flex flex-col gap-3 md:hidden">
        {colunas
          .filter((col) => colunaAtiva === "todas" || col.status === colunaAtiva)
          .map((col) => {
            const itensDaColuna = itensFiltrados.filter((i) => i.status === col.status)
            if (colunaAtiva === "todas" && itensDaColuna.length === 0) return null
            return (
              <div key={col.status} className="flex flex-col gap-2">
                {colunaAtiva === "todas" && (
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 rounded-full", col.cor)} />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {col.titulo}
                    </span>
                    <span className={cn("text-xs font-bold", col.corTexto)}>
                      {itensDaColuna.length}
                    </span>
                  </div>
                )}
                {itensDaColuna.map((item) => (
                  <CardProducao
                    key={item.id}
                    item={item}
                    coluna={colunaMap[item.status]}
                    onMudarStatus={(status) => moverStatus(item, status)}
                  />
                ))}
                {itensDaColuna.length === 0 && colunaAtiva !== "todas" && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum pedido em {col.titulo}.
                  </p>
                )}
              </div>
            )
          })}
        {itensFiltrados.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum pedido encontrado.
          </p>
        )}
      </div>

      {/* Desktop: kanban com drag-and-drop */}
      <div className="hidden md:block">
        <DndContext
          sensors={sensores}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-4">
            {colunas.map((col) => {
              const itensDaColuna = itensFiltrados.filter((i) => i.status === col.status)
              return (
                <ColunaDroppable key={col.status} status={col.status} coluna={col}>
                  <div className={cn(
                    "flex items-center justify-between rounded-t-lg px-3 py-2",
                    col.corFundo
                  )}>
                    <div className="flex items-center gap-2">
                      <div className={cn("h-2 w-2 rounded-full", col.cor)} />
                      <span className={cn("text-xs font-bold uppercase tracking-wide", col.corTexto)}>
                        {col.titulo}
                      </span>
                    </div>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-bold",
                      col.corFundo, col.corTexto
                    )}>
                      {itensDaColuna.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 p-2">
                    {itensDaColuna.length === 0 && (
                      <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                        Vazio
                      </div>
                    )}
                    {itensDaColuna.map((item) => (
                      <CardArrastavel key={item.id} id={item.id}>
                        <CardProducao
                          item={item}
                          coluna={colunaMap[item.status]}
                          onMudarStatus={(status) => moverStatus(item, status)}
                        />
                      </CardArrastavel>
                    ))}
                  </div>
                </ColunaDroppable>
              )
            })}
          </div>

          <DragOverlay>
            {itemArrastando ? (
              <div className="w-56 rotate-2 opacity-90 shadow-xl">
                <CardProducao
                  item={itemArrastando}
                  coluna={colunaMap[itemArrastando.status]}
                  onMudarStatus={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}

function ColunaDroppable({
  status,
  coluna,
  children,
}: {
  status: StatusPedidoRapido
  coluna: (typeof colunas)[number]
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-56 shrink-0 flex-col rounded-lg border border-border bg-muted/30 transition-colors",
        isOver && `${coluna.corFundo} ring-2 ring-inset ${coluna.corBorda}`
      )}
    >
      {children}
    </div>
  )
}

function CardArrastavel({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })

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

function CardProducao({
  item,
  coluna,
  onMudarStatus,
}: {
  item: ItemProducao
  coluna: (typeof colunas)[number]
  onMudarStatus: (status: StatusPedidoRapido) => void
}) {
  // Funcionário (papel "Produção e TV") vê o card, mas não o valor em reais.
  const { papel } = usePapelAtivo()
  const ini = item.clienteNome ? iniciais(item.clienteNome) : null

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-3 text-sm shadow-sm",
        item.atrasado ? "border-destructive/50" : "border-border"
      )}
    >
      {/* Topo: avatar + número + badge atrasado */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
            coluna.cor
          )}
        >
          {ini ?? <UserRound className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-muted-foreground">
              {item.numeroRotulo}
            </span>
            {item.atrasado && (
              <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                Atrasado
              </Badge>
            )}
          </div>
          <p className="truncate font-medium leading-tight">
            {item.clienteNome || <span className="italic text-muted-foreground">Sem cliente</span>}
          </p>
        </div>
      </div>

      {/* Produto */}
      <div className={cn("rounded-md px-2 py-1.5 text-xs", coluna.corFundo)}>
        <p className={cn("font-semibold", coluna.corTexto)}>{item.tituloProduto}</p>
        {item.subtituloProduto && (
          <p className="mt-0.5 text-muted-foreground">{item.subtituloProduto}</p>
        )}
      </div>

      {/* Data + valor */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span>
            {item.data ? `${item.dataRotulo} ${formatarData(item.data.toISOString())}` : "Sem prazo"}
          </span>
        </div>
        {papel !== "operador" && (
          <span className={cn("text-sm font-bold", coluna.corTexto)}>
            {formatarMoeda(item.valor)}
          </span>
        )}
      </div>

      {/* Select de status — para mobile e como ação rápida no desktop */}
      <div onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap gap-1">
          {colunas.map((c) => (
            <button
              key={c.status}
              onClick={() => onMudarStatus(c.status)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                item.status === c.status
                  ? `${c.cor} border-transparent text-white`
                  : "border-border text-muted-foreground hover:bg-accent"
              )}
            >
              {c.titulo}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
