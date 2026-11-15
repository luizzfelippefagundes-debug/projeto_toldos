"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatarData, formatarMoeda } from "@/lib/format"
import { usePapelAtivo } from "@/context/papel-ativo-context"
import type { Orcamento, Cliente, PedidoRapido, ProdutoRapido, StatusPedidoRapido } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  obterPrazoEntregaPedido,
  pedidoRapidoEstaAtrasado,
} from "@/lib/pedidos-rapidos"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  RefreshCw,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Package,
  UserRound,
  MessageCircle,
  FileCheck,
  Image as ImageIcon,
  Upload,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  SlidersHorizontal,
  Filter,
  Sparkles,
  EyeOff,
  FileText,
  Pencil,
  Plus,
  Printer,
} from "lucide-react"
import { linkWhatsapp } from "@/lib/whatsapp"
import { toast } from "sonner"

const STATUS_COM_NOTIFICACAO = new Set<StatusPedidoRapido>(["ag_confirmacao", "pronto", "entregue"])

function normalizarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, "")
  if (digits.startsWith("55") && digits.length >= 12) return digits
  if (digits.length === 11 || digits.length === 10) return `55${digits}`
  return digits
}

function mensagemProducao(clienteNome: string, status: StatusPedidoRapido, idItem?: string): string {
  const nome = clienteNome.split(" ")[0] ?? ""
  if (status === "ag_confirmacao") {
    const link = idItem && typeof window !== "undefined"
      ? `${window.location.origin}/arte/${idItem}`
      : ""
    return `Olá${nome ? `, ${nome}` : ""}! 🎨 Sua arte está pronta para aprovação!\n\n${link ? `Você pode conferir e aprovar diretamente pelo link:\n${link}\n\n` : ""}Por favor, *confirme se está tudo certo* para darmos início à produção. Se precisar de algum ajuste, é só me falar. 😊`
  }
  if (status === "pronto") {
    return `Olá${nome ? `, ${nome}` : ""}! 🎉 Seu pedido está *pronto* para retirada/entrega!\n\nQualquer dúvida é só chamar. 😊`
  }
  if (status === "entregue") {
    return `Olá${nome ? `, ${nome}` : ""}! ✅ Confirmamos a entrega do seu pedido.\n\nObrigado pela preferência! Se precisar de algo mais, estamos à disposição. 😊`
  }
  return ""
}

const colunas: {
  status: StatusPedidoRapido
  titulo: string
  cor: string
  corFundo: string
  corBorda: string
  corTexto: string
  badgeFundo: string
}[] = [
  {
    status: "aguardando",
    titulo: "Ag. Assinatura",
    cor: "bg-slate-600",
    corFundo: "bg-slate-100/90 dark:bg-slate-800/40",
    corBorda: "border-slate-300 dark:border-slate-700/60",
    corTexto: "text-slate-800 dark:text-slate-200",
    badgeFundo: "bg-slate-200/90 dark:bg-slate-700/60",
  },
  {
    status: "aprovado",
    titulo: "Produção",
    cor: "bg-blue-600",
    corFundo: "bg-blue-50/90 dark:bg-blue-950/40",
    corBorda: "border-blue-200 dark:border-blue-800/60",
    corTexto: "text-blue-900 dark:text-blue-200",
    badgeFundo: "bg-blue-100 dark:bg-blue-900/60",
  },
  {
    status: "ag_confirmacao",
    titulo: "Arte Enviada",
    cor: "bg-pink-600",
    corFundo: "bg-pink-50/90 dark:bg-pink-950/40",
    corBorda: "border-pink-200 dark:border-pink-800/60",
    corTexto: "text-pink-900 dark:text-pink-200",
    badgeFundo: "bg-pink-100 dark:bg-pink-900/60",
  },
  {
    status: "impressao",
    titulo: "Impressão",
    cor: "bg-orange-600",
    corFundo: "bg-orange-50/90 dark:bg-orange-950/40",
    corBorda: "border-orange-200 dark:border-orange-800/60",
    corTexto: "text-orange-950 dark:text-orange-200",
    badgeFundo: "bg-orange-100 dark:bg-orange-900/60",
  },
  {
    status: "acabamento",
    titulo: "Acabamento",
    cor: "bg-amber-500",
    corFundo: "bg-amber-50/90 dark:bg-amber-950/40",
    corBorda: "border-amber-200 dark:border-amber-800/60",
    corTexto: "text-amber-950 dark:text-amber-200",
    badgeFundo: "bg-amber-100 dark:bg-amber-900/60",
  },
  {
    status: "pronto",
    titulo: "Pronto",
    cor: "bg-emerald-600",
    corFundo: "bg-emerald-50/90 dark:bg-emerald-950/40",
    corBorda: "border-emerald-200 dark:border-emerald-800/60",
    corTexto: "text-emerald-950 dark:text-emerald-200",
    badgeFundo: "bg-emerald-100 dark:bg-emerald-900/60",
  },
  {
    status: "entregue",
    titulo: "Entregue",
    cor: "bg-teal-600",
    corFundo: "bg-teal-50/90 dark:bg-teal-950/40",
    corBorda: "border-teal-200 dark:border-teal-800/60",
    corTexto: "text-teal-950 dark:text-teal-200",
    badgeFundo: "bg-teal-100 dark:bg-teal-900/60",
  },
]

const colunaMap = Object.fromEntries(colunas.map((c) => [c.status, c])) as Record<
  StatusPedidoRapido,
  (typeof colunas)[number]
>
if (!colunaMap.arte) {
  colunaMap.arte = colunaMap.aprovado
}

const PROXIMO_STATUS: Partial<Record<StatusPedidoRapido, StatusPedidoRapido>> = {
  aguardando: "aprovado",
  aprovado: "ag_confirmacao",
  arte: "ag_confirmacao",
  ag_confirmacao: "impressao",
  impressao: "acabamento",
  acabamento: "pronto",
  pronto: "entregue",
}

const statusValidos = new Set<string>(colunas.map((c) => c.status))

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter((p) => /[a-zA-ZÀ-ú]/.test(p[0]))
  if (partes.length === 0) return null
  return partes.slice(0, 2).map((p) => p[0]).join("").toUpperCase()
}

export default function ProducaoPage() {
  const {
    pedidosRapidos,
    produtosRapidos,
    moverPedidoRapido,
    orcamentos,
    clientes,
    moverOrcamentoProducao,
    salvarArteOrcamento,
    salvarArtePedidoRapido,
    salvarObservacaoOrcamento,
    salvarObservacaoPedidoRapido,
  } = useData()
  const [busca, setBusca] = useState("")
  const [colunaAtiva, setColunaAtiva] = useState<StatusPedidoRapido | "todas">("todas")
  const [ocultarEntregues, setOcultarEntregues] = useState(false)
  const [colunasVisiveis, setColunasVisiveis] = useState<string[]>(() => colunas.map((c) => c.status))
  const [filtroPreset, setFiltroPreset] = useState<"todos" | "recentes_5" | "os" | "rapida" | "atrasados">("todos")
  const [ocultarVazias, setOcultarVazias] = useState(false)
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<{
    clienteNome: string
    clienteTelefone: string | null
    novoStatus: StatusPedidoRapido
    mensagem: string
    enviando: boolean
    executar: () => void
  } | null>(null)
  const [assinaturas, setAssinaturas] = useState<Record<string, { pdfUrl: string | null; assinado: boolean }>>({})

  useEffect(() => {
    const orcsComOs = orcamentos.filter((o) => o.statusProducao)
    if (orcsComOs.length === 0) return
    Promise.all(
      orcsComOs.map((o) =>
        fetch(`/api/assinar/por-orcamento/${o.id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d: { pdfUrl: string | null; assinado: boolean } | null) =>
            d ? { id: o.id, pdfUrl: d.pdfUrl, assinado: d.assinado } : null
          )
          .catch(() => null)
      )
    ).then((resultados) => {
      const mapa: Record<string, { pdfUrl: string | null; assinado: boolean }> = {}
      for (const r of resultados) {
        if (r) mapa[r.id] = { pdfUrl: r.pdfUrl, assinado: r.assinado }
      }
      setAssinaturas(mapa)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orcamentos.length])

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

  // Lista unificada ordenada decrescente para cálculo de recentes
  const idsUltimos5Recentes = useMemo(() => {
    const lista: { id: string; tipo: "pedido" | "orcamento"; dataTs: number }[] = []
    for (const p of pedidosRapidos) {
      const ts = p.criadoEm ? new Date(p.criadoEm).getTime() : 0
      lista.push({ id: p.id, tipo: "pedido", dataTs: ts })
    }
    for (const o of orcamentos) {
      if (!o.statusProducao) continue
      const dataStr = o.fechadoEm || o.criadoEm || ""
      const ts = dataStr ? new Date(dataStr).getTime() : 0
      lista.push({ id: o.id, tipo: "orcamento", dataTs: ts })
    }
    lista.sort((a, b) => b.dataTs - a.dataTs)
    return new Set(lista.slice(0, 5).map((item) => (item.tipo === "pedido" ? item.id : `orc-${item.id}`)))
  }, [pedidosRapidos, orcamentos])

  const pedidosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return pedidosRapidos.filter((pedido) => {
      if (filtroPreset === "os") return false
      if (filtroPreset === "atrasados" && !estaAtrasado(pedido)) return false
      if (filtroPreset === "recentes_5" && !idsUltimos5Recentes.has(pedido.id)) return false

      if (!termo) return true
      return (
        pedido.clienteNome.toLowerCase().includes(termo) ||
        String(pedido.numero).includes(termo)
      )
    })
  }, [pedidosRapidos, busca, filtroPreset, idsUltimos5Recentes, hoje, produtosRapidos])

  const orcamentosEmProducao = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return orcamentos.filter((o) => {
      if (!o.statusProducao) return false
      if (filtroPreset === "rapida") return false
      if (filtroPreset === "atrasados") return false
      if (filtroPreset === "recentes_5" && !idsUltimos5Recentes.has(`orc-${o.id}`)) return false

      if (!termo) return true
      const cliente = clientes.find((c) => c.id === o.clienteId)
      return (
        (cliente?.nome ?? "").toLowerCase().includes(termo) ||
        String(o.numero).includes(termo)
      )
    })
  }, [orcamentos, clientes, busca, filtroPreset, idsUltimos5Recentes])

  const colunasRenderizadas = useMemo(() => {
    return colunas.filter((col) => {
      if (!colunasVisiveis.includes(col.status)) return false
      if (ocultarEntregues && col.status === "entregue") return false
      if (ocultarVazias) {
        const pCount = pedidosFiltrados.filter(
          (p) => p.status === col.status || (col.status === "aprovado" && p.status === "arte")
        ).length
        const oCount = orcamentosEmProducao.filter(
          (o) => o.statusProducao === col.status || (col.status === "aprovado" && o.statusProducao === "arte")
        ).length
        if (pCount + oCount === 0) return false
      }
      return true
    })
  }, [colunasVisiveis, ocultarEntregues, ocultarVazias, pedidosFiltrados, orcamentosEmProducao])

  const emProducao =
    pedidosRapidos.filter((p) =>
      ["aprovado", "arte", "ag_confirmacao", "impressao", "acabamento", "pronto"].includes(p.status)
    ).length +
    orcamentosEmProducao.filter((o) =>
      o.statusProducao &&
      ["aprovado", "arte", "ag_confirmacao", "impressao", "acabamento", "pronto"].includes(o.statusProducao)
    ).length
  const atrasados = pedidosRapidos.filter(estaAtrasado).length
  const prontos =
    pedidosRapidos.filter((p) => p.status === "pronto").length +
    orcamentosEmProducao.filter((o) => o.statusProducao === "pronto").length
  const totalEntregues =
    pedidosFiltrados.filter((p) => p.status === "entregue").length +
    orcamentosEmProducao.filter((o) => o.statusProducao === "entregue").length

  const pedidoArrastando = arrastandoId && !arrastandoId.startsWith("orc-")
    ? pedidosRapidos.find((p) => p.id === arrastandoId)
    : null
  const orcamentoArrastando = arrastandoId?.startsWith("orc-")
    ? orcamentos.find((o) => o.id === arrastandoId.slice(4))
    : null

  function solicitarConfirmacao(
    clienteNome: string,
    clienteTelefone: string | null,
    novoStatus: StatusPedidoRapido,
    executar: () => void,
    idItem?: string
  ) {
    if (STATUS_COM_NOTIFICACAO.has(novoStatus) && clienteTelefone) {
      setConfirmando({
        clienteNome,
        clienteTelefone,
        novoStatus,
        mensagem: mensagemProducao(clienteNome, novoStatus, idItem),
        enviando: false,
        executar,
      })
    } else {
      executar()
    }
  }

  async function confirmarMudanca(enviarWhatsApp: boolean) {
    if (!confirmando) return
    setConfirmando((c) => c ? { ...c, enviando: true } : null)
    confirmando.executar()
    if (enviarWhatsApp && confirmando.clienteTelefone) {
      await fetch("/api/whatsapp/enviar-notificacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefone: normalizarTelefone(confirmando.clienteTelefone),
          mensagem: confirmando.mensagem,
          clienteNome: confirmando.clienteNome,
        }),
      })
    }
    setConfirmando(null)
  }

  function handleDragStart(event: DragStartEvent) {
    setArrastandoId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setArrastandoId(null)
    const { active, over } = event
    if (!over) return
    const novoStatus = String(over.id)
    if (!statusValidos.has(novoStatus)) return
    const activeId = String(active.id)
    if (activeId.startsWith("orc-")) {
      const orcId = activeId.slice(4)
      const orc = orcamentos.find((o) => o.id === orcId)
      if (!orc || orc.statusProducao === novoStatus) return
      const cli = clientes.find((c) => c.id === orc.clienteId)
      solicitarConfirmacao(
        cli?.nome ?? "Cliente",
        cli?.telefone ?? null,
        novoStatus as StatusPedidoRapido,
        () => moverOrcamentoProducao(orcId, novoStatus as StatusPedidoRapido),
        orcId
      )
    } else {
      const pedido = pedidosRapidos.find((p) => p.id === activeId)
      if (!pedido || pedido.status === novoStatus) return
      solicitarConfirmacao(
        pedido.clienteNome,
        pedido.clienteTelefone,
        novoStatus as StatusPedidoRapido,
        () => moverPedidoRapido(activeId, novoStatus as StatusPedidoRapido),
        activeId
      )
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Produção</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe o fluxo de pedidos e ordens de serviço.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Métricas compactas */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-border bg-card px-2.5 sm:px-4 py-2 sm:py-3">
          <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
            <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Em produção</p>
            <p className="text-base sm:text-xl font-bold leading-tight">{emProducao}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-border bg-card px-2.5 sm:px-4 py-2 sm:py-3">
          <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-red-500/15">
            <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Atrasados</p>
            <p className={cn("text-base sm:text-xl font-bold leading-tight", atrasados > 0 && "text-destructive")}>
              {hoje ? atrasados : "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-border bg-card px-2.5 sm:px-4 py-2 sm:py-3">
          <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-green-500/15">
            <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Prontos</p>
            <p className={cn("text-base sm:text-xl font-bold leading-tight", prontos > 0 && "text-green-600")}>
              {prontos}
            </p>
          </div>
        </div>
      </div>

      {/* Busca e Barra de Ferramentas com Filtros */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Campo de Busca */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou número..."
              className="pl-9 pr-7 h-9 text-sm bg-background"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
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

          {/* Seletor de Colunas Visíveis */}
          <Popover>
            <PopoverTrigger
              className={cn(
                "inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 h-9 text-xs font-medium gap-1.5 shrink-0 transition-colors hover:bg-muted cursor-pointer",
                colunasVisiveis.length < colunas.length && "border-primary text-primary font-semibold bg-primary/5"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Colunas ({colunasVisiveis.length}/{colunas.length})</span>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-xs font-bold text-foreground">Colunas Visíveis</span>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setColunasVisiveis(colunas.map((c) => c.status))}
                    className="text-primary hover:underline font-medium"
                  >
                    Todas
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => {
                      const colunasComCards = colunas
                        .filter((c) => {
                          const count =
                            pedidosRapidos.filter((p) => p.status === c.status || (c.status === "aprovado" && p.status === "arte")).length +
                            orcamentos.filter((o) => o.statusProducao === c.status || (c.status === "aprovado" && o.statusProducao === "arte")).length
                          return count > 0
                        })
                        .map((c) => c.status)
                      setColunasVisiveis(colunasComCards.length > 0 ? colunasComCards : colunas.map((c) => c.status))
                    }}
                    className="text-muted-foreground hover:text-foreground font-medium"
                  >
                    Só com cards
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                {colunas.map((c) => {
                  const marcada = colunasVisiveis.includes(c.status)
                  const totalCards =
                    pedidosRapidos.filter((p) => p.status === c.status || (c.status === "aprovado" && p.status === "arte")).length +
                    orcamentos.filter((o) => o.statusProducao === c.status || (c.status === "aprovado" && o.statusProducao === "arte")).length

                  return (
                    <label
                      key={c.status}
                      className="flex items-center justify-between p-1.5 rounded-md hover:bg-muted/50 cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={marcada}
                          onChange={() => {
                            setColunasVisiveis((atuais) => {
                              if (atuais.includes(c.status)) {
                                if (atuais.length === 1) return atuais
                                return atuais.filter((s) => s !== c.status)
                              } else {
                                return [...atuais, c.status]
                              }
                            })
                          }}
                          className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className={cn("h-2 w-2 rounded-full", c.cor)} />
                          <span className={marcada ? "font-medium text-foreground" : "text-muted-foreground"}>
                            {c.titulo}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-semibold px-1 rounded bg-muted">
                        {totalCards}
                      </span>
                    </label>
                  )
                })}
              </div>
            </PopoverContent>
          </Popover>

          {/* Botão Ocultar Entregues */}
          <button
            type="button"
            onClick={() => setOcultarEntregues((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 h-9 text-xs font-medium transition-all shrink-0",
              ocultarEntregues
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
            title="Ocultar coluna de pedidos já entregues"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{ocultarEntregues ? "Entregues Ocultos" : "Ocultar Entregues"}</span>
            <span className="rounded-full bg-muted/80 px-1.5 py-0.2 text-[10px]">
              {totalEntregues}
            </span>
          </button>
        </div>

        {/* Linha de Pílulas Rápidas de Filtro */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Filtros:
          </span>

          <button
            type="button"
            onClick={() => setFiltroPreset("todos")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs",
              filtroPreset === "todos"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/70 text-muted-foreground hover:text-foreground"
            )}
          >
            Todos ({pedidosRapidos.length + orcamentos.filter((o) => o.statusProducao).length})
          </button>

          <button
            type="button"
            onClick={() => setFiltroPreset(filtroPreset === "recentes_5" ? "todos" : "recentes_5")}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs",
              filtroPreset === "recentes_5"
                ? "bg-amber-600 text-white"
                : "bg-muted/70 text-muted-foreground hover:text-foreground"
            )}
            title="Ver os 5 cards mais recentes que chegaram"
          >
            <Sparkles className="h-3 w-3" />
            <span>Últimos 5 recentes</span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroPreset(filtroPreset === "os" ? "todos" : "os")}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs",
              filtroPreset === "os"
                ? "bg-violet-600 text-white"
                : "bg-muted/70 text-muted-foreground hover:text-foreground"
            )}
          >
            <FileCheck className="h-3 w-3" />
            <span>Só OS / Orçamento</span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroPreset(filtroPreset === "rapida" ? "todos" : "rapida")}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs",
              filtroPreset === "rapida"
                ? "bg-blue-600 text-white"
                : "bg-muted/70 text-muted-foreground hover:text-foreground"
            )}
          >
            <Package className="h-3 w-3" />
            <span>Só Gráfica Rápida</span>
          </button>

          {atrasados > 0 && (
            <button
              type="button"
              onClick={() => setFiltroPreset(filtroPreset === "atrasados" ? "todos" : "atrasados")}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs",
                filtroPreset === "atrasados"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-destructive/10 text-destructive hover:bg-destructive/20"
              )}
            >
              <AlertTriangle className="h-3 w-3" />
              <span>Atrasados ({atrasados})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setOcultarVazias((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs border",
              ocultarVazias
                ? "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
            title="Ocultar colunas sem nenhum card"
          >
            <EyeOff className="h-3 w-3" />
            <span>{ocultarVazias ? "Colunas vazias ocultas" : "Ocultar vazias"}</span>
          </button>

          {/* Botão Limpar / Ver tudo */}
          {(filtroPreset !== "todos" || busca || colunasVisiveis.length < colunas.length || ocultarVazias || ocultarEntregues) && (
            <button
              type="button"
              onClick={() => {
                setFiltroPreset("todos")
                setBusca("")
                setColunasVisiveis(colunas.map((c) => c.status))
                setOcultarVazias(false)
                setOcultarEntregues(false)
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-bold text-foreground hover:bg-muted transition-all shadow-2xs"
            >
              ✕ Ver tudo (Limpar)
            </button>
          )}
        </div>
      </div>

      {/* Mobile: Navegação fixa por abas de estágio */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-background/95 backdrop-blur-md border-b border-border/60 flex items-center gap-1.5 overflow-x-auto md:hidden">
        <button
          onClick={() => setColunaAtiva("todas")}
          className={cn(
            "shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
            colunaAtiva === "todas"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-muted/70 text-muted-foreground hover:text-foreground"
          )}
        >
          Todas ({pedidosFiltrados.length + orcamentosEmProducao.length})
        </button>
        {colunasRenderizadas.map((col) => {
          const qtd =
            pedidosFiltrados.filter((p) => p.status === col.status || (col.status === "aprovado" && p.status === "arte")).length +
            orcamentosEmProducao.filter((o) => o.statusProducao === col.status || (col.status === "aprovado" && o.statusProducao === "arte")).length
          return (
            <button
              key={col.status}
              onClick={() => setColunaAtiva(col.status)}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                colunaAtiva === col.status
                  ? `${col.cor} text-white shadow-xs`
                  : "bg-muted/70 text-muted-foreground hover:text-foreground"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", colunaAtiva === col.status ? "bg-white" : col.cor)} />
              <span>{col.titulo}</span>
              <span className="opacity-80 text-[11px]">({qtd})</span>
            </button>
          )
        })}
      </div>

      {/* Mobile: lista de cards em coluna única */}
      <div className="flex flex-col gap-4 md:hidden">
        {colunasRenderizadas
          .filter((col) => {
            if (colunaAtiva !== "todas") return col.status === colunaAtiva
            return true
          })
          .map((col) => {
            const pedidosDaColuna = pedidosFiltrados.filter(
              (p) => p.status === col.status || (col.status === "aprovado" && p.status === "arte")
            )
            const orcsDaColuna = orcamentosEmProducao.filter(
              (o) => o.statusProducao === col.status || (col.status === "aprovado" && o.statusProducao === "arte")
            )
            const totalColuna = pedidosDaColuna.length + orcsDaColuna.length
            if (colunaAtiva === "todas" && totalColuna === 0) return null
            return (
              <div key={col.status} className="flex flex-col gap-2.5">
                <div className={cn("flex items-center justify-between rounded-lg px-3 py-1.5 border", col.corFundo, col.corBorda)}>
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs", col.cor)} />
                    <span className={cn("text-xs font-bold uppercase tracking-wide", col.corTexto)}>
                      {col.titulo}
                    </span>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold shadow-2xs", col.badgeFundo, col.corTexto)}>
                    {totalColuna}
                  </span>
                </div>
                {pedidosDaColuna.map((pedido) => (
                  <PedidoCardConteudo
                    key={pedido.id}
                    pedido={pedido}
                    produto={produtoDoPedido(pedido)}
                    atrasado={estaAtrasado(pedido)}
                    coluna={colunaMap[pedido.status]}
                    onSalvarArte={(url) => salvarArtePedidoRapido(pedido.id, url)}
                    onSalvarObservacao={(obs) => salvarObservacaoPedidoRapido(pedido.id, obs)}
                    onMudarStatus={(status) =>
                      solicitarConfirmacao(
                        pedido.clienteNome,
                        pedido.clienteTelefone,
                        status,
                        () => moverPedidoRapido(pedido.id, status),
                        pedido.id
                      )
                    }
                  />
                ))}
                {orcsDaColuna.map((orc) => {
                  const cli = clientes.find((c) => c.id === orc.clienteId)
                  return (
                    <OrcamentoCardConteudo
                      key={`orc-${orc.id}`}
                      orcamento={orc}
                      cliente={cli}
                      coluna={col}
                      assinatura={assinaturas[orc.id]}
                      onSalvarArte={(url) => salvarArteOrcamento(orc.id, url)}
                      onSalvarObservacao={(obs) => salvarObservacaoOrcamento(orc.id, obs)}
                      onMudarStatus={(status) =>
                        solicitarConfirmacao(
                          cli?.nome ?? "Cliente",
                          cli?.telefone ?? null,
                          status,
                          () => moverOrcamentoProducao(orc.id, status),
                          orc.id
                        )
                      }
                    />
                  )
                })}
                {totalColuna === 0 && colunaAtiva !== "todas" && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum pedido ou orçamento em {col.titulo}.
                  </p>
                )}
              </div>
            )
          })}
        {colunasRenderizadas.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma coluna selecionada nos filtros.
          </p>
        )}
        {colunasRenderizadas.length > 0 && pedidosFiltrados.length === 0 && orcamentosEmProducao.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum pedido ou orçamento encontrado com os filtros atuais.
          </p>
        )}
      </div>

      {/* Modal de confirmação ao mover para ag_confirmacao/pronto/entregue */}
      <Dialog open={!!confirmando} onOpenChange={(open) => { if (!open && !confirmando?.enviando) setConfirmando(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmando?.novoStatus === "ag_confirmacao" ? "Enviar arte para aprovação?" : confirmando?.novoStatus === "pronto" ? "Marcar como Pronto?" : "Marcar como Entregue?"}
            </DialogTitle>
            <DialogDescription>
              {confirmando?.novoStatus === "ag_confirmacao"
                ? "Deseja enviar uma mensagem ao cliente pedindo aprovação da arte antes de iniciar a produção?"
                : confirmando?.novoStatus === "pronto"
                  ? "Deseja avisar o cliente que o pedido está pronto para retirada/entrega?"
                  : "Deseja enviar uma confirmação de entrega pelo WhatsApp?"}
            </DialogDescription>
          </DialogHeader>

          {confirmando?.clienteTelefone && (
            <div className="flex flex-col gap-2">
              <Label>Mensagem para {confirmando.clienteNome.split(" ")[0]}</Label>
              <Textarea
                rows={4}
                className="resize-none text-sm"
                value={confirmando.mensagem}
                onChange={(e) => setConfirmando((c) => c ? { ...c, mensagem: e.target.value } : null)}
                disabled={confirmando.enviando}
              />
            </div>
          )}

          {!confirmando?.clienteTelefone && (
            <p className="text-sm text-muted-foreground">
              Este cliente não tem telefone cadastrado — não será possível enviar WhatsApp.
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmando(null)} disabled={confirmando?.enviando}>
              Cancelar
            </Button>
            {confirmando?.clienteTelefone && (
              <Button variant="outline" onClick={() => confirmarMudanca(false)} disabled={confirmando?.enviando}>
                Só mover
              </Button>
            )}
            <Button
              onClick={() => confirmarMudanca(!!confirmando?.clienteTelefone)}
              disabled={confirmando?.enviando}
              className={confirmando?.novoStatus === "pronto" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}
            >
              {confirmando?.enviando
                ? "Enviando…"
                : confirmando?.clienteTelefone
                  ? <><MessageCircle className="mr-1.5 h-4 w-4" />Confirmar e enviar WhatsApp</>
                  : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Desktop: Caixa fixa do Kanban com rolagem interna bi-direcional */}
      <div className="hidden md:flex flex-col rounded-2xl border border-border/80 bg-muted/20 dark:bg-card/30 shadow-xs overflow-hidden">
        {/* Barra superior de status/info da caixa do Kanban */}
        <div className="flex items-center justify-between border-b border-border/60 bg-card/60 px-4 py-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">Quadro de Produção</span>
            <span>•</span>
            <span>
              {pedidosFiltrados.length + orcamentosEmProducao.length}{" "}
              {pedidosFiltrados.length + orcamentosEmProducao.length === 1 ? "item" : "itens"} visíveis
            </span>
            {filtroPreset === "recentes_5" && (
              <span className="rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 font-semibold px-2 py-0.5 text-[11px] flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> 5 mais recentes
              </span>
            )}
            {colunasVisiveis.length < colunas.length && (
              <span className="rounded bg-blue-500/15 text-blue-800 dark:text-blue-300 font-semibold px-2 py-0.5 text-[11px]">
                {colunasRenderizadas.length}/{colunas.length} colunas
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span>Arraste os cards para mover de coluna</span>
          </div>
        </div>

        {/* Área interna de rolagem horizontal e vertical */}
        <div className="h-[calc(100vh-290px)] min-h-[500px] max-h-[740px] w-full overflow-auto p-4 custom-scrollbar">
          <DndContext
            sensors={sensores}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {colunasRenderizadas.length === 0 ? (
              <div className="flex flex-col items-center justify-center w-full h-full p-12 text-center text-muted-foreground gap-3">
                <Filter className="h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">Nenhuma coluna visível com os filtros atuais.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setColunasVisiveis(colunas.map((c) => c.status))
                    setOcultarVazias(false)
                    setOcultarEntregues(false)
                    setFiltroPreset("todos")
                    setBusca("")
                  }}
                >
                  Restaurar todas as colunas
                </Button>
              </div>
            ) : (
              <div className="flex gap-3.5 h-full min-w-max items-start">
                {colunasRenderizadas.map((col) => {
                  const pedidosDaColuna = pedidosFiltrados.filter(
                    (p) => p.status === col.status || (col.status === "aprovado" && p.status === "arte")
                  )
                  const orcsDaColuna = orcamentosEmProducao.filter(
                    (o) => o.statusProducao === col.status || (col.status === "aprovado" && o.statusProducao === "arte")
                  )
                  const total = pedidosDaColuna.length + orcsDaColuna.length
                  return (
                    <ColunaDroppable key={col.status} status={col.status} coluna={col}>
                      {/* Header fixo da coluna */}
                      <div
                        className={cn(
                          "shrink-0 flex items-center justify-between px-3 py-2.5 border-b",
                          col.corFundo,
                          col.corBorda
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs", col.cor)} />
                          <span className={cn("text-xs font-bold uppercase tracking-wide", col.corTexto)}>
                            {col.titulo}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-bold shadow-2xs",
                            col.badgeFundo,
                            col.corTexto
                          )}
                        >
                          {total}
                        </span>
                      </div>

                      {/* Lista de cartões com rolagem independente */}
                      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2.5 min-h-0 custom-scrollbar">
                        {total === 0 && (
                          <div className="rounded-lg border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
                            Vazio
                          </div>
                        )}
                        {pedidosDaColuna.map((pedido) => (
                          <PedidoCardArrastavel key={pedido.id} id={pedido.id}>
                            <PedidoCardConteudo
                              pedido={pedido}
                              produto={produtoDoPedido(pedido)}
                              atrasado={estaAtrasado(pedido)}
                              coluna={colunaMap[pedido.status]}
                              onSalvarArte={(url) => salvarArtePedidoRapido(pedido.id, url)}
                              onSalvarObservacao={(obs) => salvarObservacaoPedidoRapido(pedido.id, obs)}
                              onMudarStatus={(status) =>
                                solicitarConfirmacao(
                                  pedido.clienteNome,
                                  pedido.clienteTelefone,
                                  status,
                                  () => moverPedidoRapido(pedido.id, status),
                                  pedido.id
                                )
                              }
                            />
                          </PedidoCardArrastavel>
                        ))}
                        {orcsDaColuna.map((orc) => {
                          const cli = clientes.find((c) => c.id === orc.clienteId)
                          return (
                            <PedidoCardArrastavel key={`orc-${orc.id}`} id={`orc-${orc.id}`}>
                              <OrcamentoCardConteudo
                                orcamento={orc}
                                cliente={cli}
                                coluna={col}
                                assinatura={assinaturas[orc.id]}
                                onSalvarArte={(url) => salvarArteOrcamento(orc.id, url)}
                                onSalvarObservacao={(obs) => salvarObservacaoOrcamento(orc.id, obs)}
                                onMudarStatus={(status) =>
                                  solicitarConfirmacao(
                                    cli?.nome ?? "Cliente",
                                    cli?.telefone ?? null,
                                    status,
                                    () => moverOrcamentoProducao(orc.id, status),
                                    orc.id
                                  )
                                }
                              />
                            </PedidoCardArrastavel>
                          )
                        })}
                      </div>
                    </ColunaDroppable>
                  )
                })}
              </div>
            )}

            <DragOverlay>
              {pedidoArrastando ? (
                <div className="w-64 rotate-2 opacity-95 shadow-2xl">
                  <PedidoCardConteudo
                    pedido={pedidoArrastando}
                    produto={produtoDoPedido(pedidoArrastando)}
                    atrasado={estaAtrasado(pedidoArrastando)}
                    coluna={colunaMap[pedidoArrastando.status]}
                    onMudarStatus={() => {}}
                    onSalvarArte={async () => {}}
                  />
                </div>
              ) : orcamentoArrastando ? (
                <div className="w-64 rotate-2 opacity-95 shadow-2xl">
                  <OrcamentoCardConteudo
                    orcamento={orcamentoArrastando}
                    cliente={clientes.find((c) => c.id === orcamentoArrastando.clienteId)}
                    coluna={colunaMap[orcamentoArrastando.statusProducao!]}
                    assinatura={assinaturas[orcamentoArrastando.id]}
                    onMudarStatus={() => {}}
                    onSalvarArte={async () => {}}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
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
        "flex w-64 xl:w-72 shrink-0 flex-col h-full rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden transition-colors",
        isOver && `${coluna.corFundo} ring-2 ring-inset ${coluna.corBorda}`
      )}
    >
      {children}
    </div>
  )
}

function PedidoCardArrastavel({
  id,
  children,
}: {
  id: string
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
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

function ArteCardWidget({
  id,
  arteUrl,
  arteAprovadaEm,
  status,
  clienteNome,
  clienteTelefone,
  onSalvarArte,
}: {
  id: string
  arteUrl?: string
  arteAprovadaEm?: string
  status: StatusPedidoRapido
  clienteNome: string
  clienteTelefone?: string | null
  onSalvarArte: (url: string | null) => Promise<void>
}) {
  const [enviando, setEnviando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEnviando(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: form })
      const data = await res.json()
      if (data.url) {
        await onSalvarArte(data.url)
      }
    } catch (err) {
      console.error("Erro ao enviar arte:", err)
    } finally {
      setEnviando(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function handleCopiarLink() {
    if (typeof window === "undefined") return
    const link = `${window.location.origin}/arte/${id}`
    navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const linkWhatsappAprovacao = clienteTelefone
    ? linkWhatsapp(
        clienteTelefone,
        mensagemProducao(clienteNome, "ag_confirmacao", id)
      )
    : null

  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-2 text-xs"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1 font-semibold text-muted-foreground text-[11px]">
          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
          Arte
        </span>
        {arteAprovadaEm ? (
          <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Aprovada
          </span>
        ) : status === "ag_confirmacao" ? (
          <span className="flex items-center gap-1 rounded bg-pink-500/15 px-1.5 py-0.5 text-[10px] font-bold text-pink-500">
            <Clock className="h-3 w-3" /> Ag. Aprovação
          </span>
        ) : null}
      </div>

      {arteUrl ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="group relative h-9 w-9 shrink-0 overflow-hidden rounded border bg-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={arteUrl} alt="Arte" className="h-full w-full object-cover" />
              <a
                href={arteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white"
                title="Abrir imagem"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-medium text-foreground truncate">Arte anexada</span>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <button
                  type="button"
                  onClick={handleCopiarLink}
                  className="hover:text-foreground underline underline-offset-2 flex items-center gap-0.5"
                >
                  {copiado ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <Copy className="h-2.5 w-2.5" />}
                  {copiado ? "Copiado" : "Link"}
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={enviando}
                  className="hover:text-foreground underline underline-offset-2"
                  title="Trocar imagem"
                >
                  Trocar
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => onSalvarArte(null)}
                  disabled={enviando}
                  className="text-destructive/80 hover:text-destructive"
                  title="Remover arte"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
          {linkWhatsappAprovacao && (
            <a
              href={linkWhatsappAprovacao}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-emerald-700 transition-colors shrink-0"
              title="Enviar para aprovação no WhatsApp"
            >
              <MessageCircle className="h-3 w-3" />
              WhatsApp
            </a>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            disabled={enviando}
            onChange={handleUpload}
          />
        </div>
      ) : (
        <div>
          <label className="flex items-center justify-center gap-1.5 rounded border border-dashed border-border hover:border-violet-500 bg-background/50 hover:bg-violet-500/5 py-1 px-2 text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400 text-[11px] font-medium cursor-pointer transition-colors">
            {enviando ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <Upload className="h-3 w-3" />
                <span>Anexar Arte</span>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              disabled={enviando}
              onChange={handleUpload}
            />
          </label>
        </div>
      )}
    </div>
  )
}

function ObservacaoProducaoWidget({
  observacaoInicial,
  onSalvar,
}: {
  observacaoInicial?: string
  onSalvar: (texto: string) => Promise<void>
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(observacaoInicial || "")
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setTexto(observacaoInicial || "")
  }, [observacaoInicial])

  async function handleSalvar() {
    setSalvando(true)
    try {
      await onSalvar(texto)
      setEditando(false)
      toast.success("Instrução de produção salva!")
    } catch {
      toast.error("Erro ao salvar instrução")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      className="flex flex-col text-xs"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {editando ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-amber-500/50 bg-amber-500/10 dark:bg-amber-950/30 p-2 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Instrução pra Fábrica / TV:
            </span>
          </div>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex: favor fazer estrutura metálica para pintar na cor preta..."
            rows={2}
            className="w-full rounded-lg border border-border/80 bg-background p-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500"
            autoFocus
          />
          <div className="flex items-center justify-end gap-1.5 pt-0.5">
            <button
              type="button"
              disabled={salvando}
              onClick={() => {
                setTexto(observacaoInicial || "")
                setEditando(false)
              }}
              className="px-2 py-0.5 rounded text-[11px] font-medium text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={salvando}
              onClick={handleSalvar}
              className="px-2.5 py-0.5 rounded bg-amber-600 text-white hover:bg-amber-700 text-[11px] font-bold shadow-2xs transition-colors"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      ) : observacaoInicial ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 dark:bg-amber-950/20 p-2 text-xs flex flex-col gap-1 shadow-2xs group">
          <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3 shrink-0" />
              <span>Instrução / Obs Fábrica:</span>
            </span>
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="opacity-70 group-hover:opacity-100 hover:text-amber-900 dark:hover:text-amber-200 transition-opacity p-0.5"
              title="Editar instrução"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
          <p className="text-foreground/90 font-medium break-words whitespace-pre-wrap leading-tight text-xs">
            {observacaoInicial}
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg border border-dashed border-border/80 hover:border-amber-500/60 bg-muted/20 hover:bg-amber-500/5 text-[11px] font-medium text-muted-foreground hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
        >
          <Plus className="h-3 w-3 shrink-0" />
          <span>+ Obs / Instrução pra Fábrica</span>
        </button>
      )}
    </div>
  )
}

function PedidoCardConteudo({
  pedido,
  produto,
  atrasado,
  coluna,
  onMudarStatus,
  onSalvarArte,
  onSalvarObservacao,
}: {
  pedido: PedidoRapido
  produto: ProdutoRapido | undefined
  atrasado: boolean
  coluna: (typeof colunas)[number]
  onMudarStatus: (status: StatusPedidoRapido) => void
  onSalvarArte: (url: string | null) => Promise<void>
  onSalvarObservacao?: (obs: string) => Promise<void>
}) {
  // Funcionário (papel "Produção e TV") vê o pedido, mas não o valor em reais.
  const { papel } = usePapelAtivo()
  const prazo = obterPrazoEntregaPedido(pedido, produto?.prazoDias)
  const nome = pedido.clienteNome?.trim() || ""
  const ini = nome ? iniciais(nome) : null
  const proximoStatus = PROXIMO_STATUS[pedido.status]
  const proximo = proximoStatus ? colunaMap[proximoStatus] : null

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border bg-card p-3 text-sm shadow-2xs transition-shadow hover:shadow-md",
        atrasado ? "border-destructive/60 ring-1 ring-destructive/30" : "border-border/80"
      )}
    >
      {/* Topo: avatar + número + preço */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
              coluna.cor
            )}
          >
            {ini ?? <UserRound className="h-3.5 w-3.5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground">
                #{pedido.numero}
              </span>
              <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground">
                Rápida
              </span>
              {atrasado && (
                <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                  Atrasado
                </Badge>
              )}
            </div>
          </div>
        </div>

        {papel !== "operador" && (
          <span className={cn("text-xs font-bold shrink-0", coluna.corTexto)}>
            {formatarMoeda(pedido.total)}
          </span>
        )}
      </div>

      {/* Cliente */}
      <p className="font-semibold text-foreground truncate text-xs leading-tight">
        {nome || <span className="italic text-muted-foreground font-normal">Sem cliente</span>}
      </p>

      {/* Produto + Prazo */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium truncate max-w-[150px]", coluna.corFundo, coluna.corTexto)}>
          {pedido.produtoNome ?? produto?.nome ?? "Produto"}
        </span>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
          <Clock className="h-3 w-3" />
          <span>{prazo ? formatarData(prazo.toISOString()) : "Sem prazo"}</span>
        </div>
      </div>

      {/* Widget de Arte */}
      <ArteCardWidget
        id={pedido.id}
        arteUrl={pedido.arteUrl}
        arteAprovadaEm={pedido.arteAprovadaEm}
        status={pedido.status}
        clienteNome={pedido.clienteNome}
        clienteTelefone={pedido.clienteTelefone}
        onSalvarArte={onSalvarArte}
      />

      {/* Widget de Observação / Instrução para Fábrica e TV */}
      {onSalvarObservacao && (
        <ObservacaoProducaoWidget
          observacaoInicial={pedido.observacao}
          onSalvar={onSalvarObservacao}
        />
      )}

      {/* Status Bar: Dropdown + Avançar */}
      <div
        className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-border/60 text-xs"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Select
          value={pedido.status}
          onValueChange={(val) => onMudarStatus(val as StatusPedidoRapido)}
        >
          <SelectTrigger className="h-7 text-xs font-medium px-2 py-0 w-auto min-w-[125px] border-border/80 bg-background/80">
            <div className="flex items-center gap-1.5 truncate">
              <span className={cn("h-2 w-2 rounded-full shrink-0", coluna.cor)} />
              <span className="truncate">{coluna.titulo}</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {colunas.map((c) => (
              <SelectItem key={c.status} value={c.status} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full shrink-0", c.cor)} />
                  <span>{c.titulo}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {proximo && (
          <button
            type="button"
            onClick={() => onMudarStatus(proximo.status)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white shadow-2xs transition-all shrink-0 hover:opacity-90 active:scale-95",
              proximo.cor
            )}
            title={`Avançar para ${proximo.titulo}`}
          >
            <span>Avançar</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}

function OrcamentoCardConteudo({
  orcamento,
  cliente,
  coluna,
  assinatura,
  onMudarStatus,
  onSalvarArte,
  onSalvarObservacao,
}: {
  orcamento: Orcamento
  cliente: Cliente | undefined
  coluna: (typeof colunas)[number]
  assinatura?: { pdfUrl: string | null; assinado: boolean }
  onMudarStatus: (status: StatusPedidoRapido) => void
  onSalvarArte: (url: string | null) => Promise<void>
  onSalvarObservacao?: (obs: string) => Promise<void>
}) {
  const { papel } = usePapelAtivo()
  const nome = cliente?.nome?.trim() || ""
  const ini = nome ? iniciais(nome) : null
  const statusAtual = (orcamento.statusProducao as StatusPedidoRapido) || "aprovado"
  const proximoStatus = PROXIMO_STATUS[statusAtual]
  const proximo = proximoStatus ? colunaMap[proximoStatus] : null

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border bg-card p-3 text-sm shadow-2xs transition-shadow hover:shadow-md",
        "border-border/80 ring-1 ring-inset ring-violet-500/20"
      )}
    >
      {/* Topo: avatar + número + preço */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
              coluna.cor
            )}
          >
            {ini ?? <UserRound className="h-3.5 w-3.5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground">
                ORC #{String(orcamento.numero).padStart(4, "0")}
              </span>
              <span className="rounded bg-violet-500/15 text-violet-700 dark:text-violet-300 px-1.5 py-0.2 text-[10px] font-semibold">
                OS
              </span>
            </div>
          </div>
        </div>

        {papel !== "operador" && orcamento.totalFechado != null && (
          <span className={cn("text-xs font-bold shrink-0", coluna.corTexto)}>
            {formatarMoeda(orcamento.totalFechado)}
          </span>
        )}
      </div>

      {/* Cliente */}
      <p className="font-semibold text-foreground truncate text-xs leading-tight">
        {nome || <span className="italic text-muted-foreground font-normal">Sem cliente</span>}
      </p>

      {/* Descrição + Data + Assinatura */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium truncate max-w-[150px]", coluna.corFundo, coluna.corTexto)}>
          {orcamento.item.servicoId && orcamento.item.servicoId !== "nenhum"
            ? "Serviço + material"
            : "Orçamento de serviço"}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {assinatura && (
            <div onPointerDown={(e) => e.stopPropagation()}>
              {assinatura.assinado ? (
                <Link
                  href={`/orcamentos/${orcamento.id}/contrato`}
                  className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 hover:bg-emerald-500/25"
                  title="Contrato e OS Assinados - Ver Documento"
                >
                  <FileCheck className="h-3 w-3" />
                  Assinada
                </Link>
              ) : (
                <Link
                  href={`/orcamentos/${orcamento.id}/contrato`}
                  className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 hover:bg-amber-500/20"
                  title="Aguardando Assinatura - Ver Contrato"
                >
                  <FileCheck className="h-3 w-3" />
                  Ag. Assinatura
                </Link>
              )}
            </div>
          )}
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{orcamento.fechadoEm ? formatarData(orcamento.fechadoEm) : "—"}</span>
          </div>
        </div>
      </div>

      {/* Widget de Arte */}
      <ArteCardWidget
        id={orcamento.id}
        arteUrl={orcamento.arteUrl}
        arteAprovadaEm={orcamento.arteAprovadaEm}
        status={statusAtual}
        clienteNome={cliente?.nome || "Cliente"}
        clienteTelefone={cliente?.telefone}
        onSalvarArte={onSalvarArte}
      />

      {/* Widget de Observação / Instrução para Fábrica e TV */}
      {onSalvarObservacao && (
        <ObservacaoProducaoWidget
          observacaoInicial={orcamento.observacao}
          onSalvar={onSalvarObservacao}
        />
      )}

      {/* Botões de Acesso Rápido ao Contrato e OS */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-border/40" onPointerDown={(e) => e.stopPropagation()}>
        <Link
          href={`/orcamentos/${orcamento.id}/contrato`}
          className="flex-1 py-1 px-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold transition-colors flex items-center justify-center gap-1 border border-emerald-500/20 shadow-2xs"
          title="Abrir Contrato de Prestação de Serviços"
        >
          <FileText className="h-3 w-3" />
          Ver Contrato
        </Link>
        <Link
          href={`/orcamentos/${orcamento.id}/os`}
          className="py-1 px-2.5 rounded-lg bg-muted/60 hover:bg-muted text-foreground text-[11px] font-medium transition-colors flex items-center justify-center gap-1 border border-border/60"
          title="Ver Ordem de Serviço (PDF)"
        >
          <Printer className="h-3 w-3" />
          OS
        </Link>
      </div>

      {/* Status Bar: Dropdown + Avançar */}
      <div
        className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-border/60 text-xs"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Select
          value={statusAtual}
          onValueChange={(val) => onMudarStatus(val as StatusPedidoRapido)}
        >
          <SelectTrigger className="h-7 text-xs font-medium px-2 py-0 w-auto min-w-[125px] border-border/80 bg-background/80">
            <div className="flex items-center gap-1.5 truncate">
              <span className={cn("h-2 w-2 rounded-full shrink-0", coluna.cor)} />
              <span className="truncate">{coluna.titulo}</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {colunas.map((c) => (
              <SelectItem key={c.status} value={c.status} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full shrink-0", c.cor)} />
                  <span>{c.titulo}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {proximo && (
          <button
            type="button"
            onClick={() => onMudarStatus(proximo.status)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white shadow-2xs transition-all shrink-0 hover:opacity-90 active:scale-95",
              proximo.cor
            )}
            title={`Avançar para ${proximo.titulo}`}
          >
            <span>Avançar</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}
