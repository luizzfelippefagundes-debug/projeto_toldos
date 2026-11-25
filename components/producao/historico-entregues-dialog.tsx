"use client"

import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  History,
  PackageCheck,
  Calendar,
  ExternalLink,
  MessageCircle,
  FileText,
  Eye,
  CheckCircle2,
  DollarSign,
  ArrowUpDown,
  RotateCcw,
  Sparkles,
  X,
  FileCheck,
} from "lucide-react"
import type { Orcamento, Cliente, PedidoRapido, ProdutoRapido, StatusPedidoRapido } from "@/lib/types"
import { formatarMoeda, formatarData } from "@/lib/format"
import { linkWhatsapp } from "@/lib/whatsapp"
import { cn } from "@/lib/utils"

export interface ItemHistoricoEntregue {
  tipo: "pedido" | "orcamento"
  id: string
  numero: number
  clienteNome: string
  clienteTelefone?: string | null
  produtoNome: string
  descricao: string
  valor: number
  dataCriacao: string
  dataTimestamp: number
  arteUrl?: string | null
  fotoProntoUrl?: string | null
  observacao?: string | null
  contratoAssinado?: boolean
  contratoPdfUrl?: string | null
  pedidoOriginal?: PedidoRapido
  orcamentoOriginal?: Orcamento
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  pedidosRapidos: PedidoRapido[]
  orcamentos: Orcamento[]
  clientes: Cliente[]
  produtosRapidos: ProdutoRapido[]
  assinaturas?: Record<string, { pdfUrl: string | null; assinado: boolean }>
  onAbrirMaisDetalhes: (item: ItemHistoricoEntregue) => void
  onMoverStatus?: (tipo: "pedido" | "orcamento", id: string, novoStatus: StatusPedidoRapido) => void
}

export function HistoricoEntreguesDialog({
  open,
  onOpenChange,
  pedidosRapidos,
  orcamentos,
  clientes,
  produtosRapidos,
  assinaturas = {},
  onAbrirMaisDetalhes,
  onMoverStatus,
}: Props) {
  const [busca, setBusca] = useState("")
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "orcamento" | "pedido">("todos")
  const [ordenacao, setOrdenacao] = useState<"recentes" | "antigos" | "maior_valor">("recentes")

  // Compilar lista unificada de itens entregues
  const todosEntregues = useMemo<ItemHistoricoEntregue[]>(() => {
    const lista: ItemHistoricoEntregue[] = []

    // 1. Pedidos Rápidos Entregues
    const pedidosEntregues = pedidosRapidos.filter((p) => p.status === "entregue")
    for (const p of pedidosEntregues) {
      const prod = produtosRapidos.find((prod) => prod.id === p.produtoId)
      const nomeProd = p.produtoNome || prod?.nome || "Gráfica Rápida"
      const variante = prod?.variantes.find((v) => v.id === p.varianteId)?.nome || p.varianteNome || ""
      const desc = [nomeProd, variante, p.acabamento].filter(Boolean).join(" - ")

      const timestamp = p.criadoEm ? new Date(p.criadoEm).getTime() : 0

      lista.push({
        tipo: "pedido",
        id: p.id,
        numero: p.numero,
        clienteNome: p.clienteNome || "Cliente Balcão",
        clienteTelefone: p.clienteTelefone || null,
        produtoNome: nomeProd,
        descricao: desc,
        valor: p.total || 0,
        dataCriacao: p.criadoEm,
        dataTimestamp: timestamp,
        arteUrl: p.arteUrl,
        fotoProntoUrl: p.fotoProntoUrl,
        observacao: p.observacao,
        pedidoOriginal: p,
      })
    }

    // 2. Orçamentos de Comunicação Visual Entregues
    const orcsEntregues = orcamentos.filter((o) => o.statusProducao === "entregue")
    for (const o of orcsEntregues) {
      const cli = clientes.find((c) => c.id === o.clienteId)
      const nomeProd =
        o.materialFechado?.nome ||
        o.servicoFechado?.nome ||
        (o.item as any)?.nome ||
        "Comunicação Visual"
      const dimensao =
        o.item?.largura && o.item?.altura
          ? `${o.item.largura}m × ${o.item.altura}m`
          : ""
      const desc = [nomeProd, dimensao].filter(Boolean).join(" - ")

      const dataRef = o.osEmitidaEm || o.fechadoEm || o.criadoEm
      const timestamp = dataRef ? new Date(dataRef).getTime() : 0

      const ass = assinaturas[o.id]

      lista.push({
        tipo: "orcamento",
        id: o.id,
        numero: o.numero,
        clienteNome: cli?.nome || "Cliente",
        clienteTelefone: cli?.telefone || null,
        produtoNome: nomeProd,
        descricao: desc,
        valor: o.totalFechado || (o.item as any)?.total || 0,
        dataCriacao: dataRef || o.criadoEm,
        dataTimestamp: timestamp,
        arteUrl: o.arteUrl,
        fotoProntoUrl: o.fotoProntoUrl,
        observacao: o.observacao,
        contratoAssinado: ass?.assinado,
        contratoPdfUrl: ass?.pdfUrl,
        orcamentoOriginal: o,
      })
    }

    return lista
  }, [pedidosRapidos, orcamentos, clientes, produtosRapidos, assinaturas])

  // Filtragem e busca
  const itensFiltrados = useMemo(() => {
    let result = todosEntregues

    // Filtro por tipo
    if (filtroTipo !== "todos") {
      result = result.filter((item) => item.tipo === filtroTipo)
    }

    // Filtro por texto de busca
    const q = busca.trim().toLowerCase()
    if (q) {
      result = result.filter((item) => {
        const numStr = String(item.numero)
        const numComHash = `#${numStr}`
        const telLimpo = (item.clienteTelefone || "").replace(/\D/g, "")
        return (
          numStr.includes(q) ||
          numComHash.includes(q) ||
          item.clienteNome.toLowerCase().includes(q) ||
          item.descricao.toLowerCase().includes(q) ||
          (item.observacao && item.observacao.toLowerCase().includes(q)) ||
          (item.clienteTelefone && item.clienteTelefone.toLowerCase().includes(q)) ||
          telLimpo.includes(q.replace(/\D/g, ""))
        )
      })
    }

    // Ordenação
    return [...result].sort((a, b) => {
      if (ordenacao === "recentes") {
        return b.dataTimestamp - a.dataTimestamp || b.numero - a.numero
      }
      if (ordenacao === "antigos") {
        return a.dataTimestamp - b.dataTimestamp || a.numero - b.numero
      }
      if (ordenacao === "maior_valor") {
        return b.valor - a.valor
      }
      return 0
    })
  }, [todosEntregues, filtroTipo, busca, ordenacao])

  // Métricas
  const totalValor = useMemo(() => {
    return todosEntregues.reduce((acc, item) => acc + (item.valor || 0), 0)
  }, [todosEntregues])

  const totalPedidosQtd = todosEntregues.filter((i) => i.tipo === "pedido").length
  const totalOrcsQtd = todosEntregues.filter((i) => i.tipo === "orcamento").length

  const handleAbrirOsPdf = (orcId: string) => {
    const url = `/api/orcamentos/${orcId}/os/pdf`
    const win = window.open(url, "_blank")
    if (!win) {
      window.location.href = url
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-5 pb-3 border-b border-border/70 bg-gradient-to-r from-teal-500/10 via-background to-emerald-500/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-teal-600/15 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 shadow-xs border border-teal-500/20">
                <PackageCheck className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <span>Histórico Geral de Entregas</span>
                  <Badge variant="secondary" className="bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold border-teal-500/20 text-xs">
                    {todosEntregues.length} {todosEntregues.length === 1 ? "entregue" : "entregues"}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Consulte todos os serviços de Comunicação Visual e Gráfica Rápida já finalizados e entregues.
                </DialogDescription>
              </div>
            </div>

            {/* Resumo Financeiro Entregue */}
            <div className="flex items-center gap-2 self-start sm:self-auto bg-card/80 border border-border/60 rounded-xl px-3 py-1.5 shadow-2xs">
              <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground uppercase font-semibold">Total Faturado Entregue</div>
                <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {formatarMoeda(totalValor)}
                </div>
              </div>
            </div>
          </div>

          {/* Barra de Filtros e Busca */}
          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Input de Busca */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por cliente, nº da OS/Pedido, produto ou WhatsApp..."
                className="pl-9 pr-8 h-9 text-xs"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Chips de Tipo */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setFiltroTipo("todos")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all shrink-0 cursor-pointer",
                  filtroTipo === "todos"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted border-border/60"
                )}
              >
                Todos ({todosEntregues.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo("orcamento")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all shrink-0 cursor-pointer",
                  filtroTipo === "orcamento"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted border-border/60"
                )}
              >
                OS Visual ({totalOrcsQtd})
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo("pedido")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all shrink-0 cursor-pointer",
                  filtroTipo === "pedido"
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted border-border/60"
                )}
              >
                Gráfica Rápida ({totalPedidosQtd})
              </button>
            </div>

            {/* Ordenação */}
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value as any)}
              className="h-9 px-2 text-xs bg-background border border-border rounded-lg text-foreground font-medium shrink-0"
            >
              <option value="recentes">Mais recentes</option>
              <option value="antigos">Mais antigos</option>
              <option value="maior_valor">Maior valor</option>
            </select>
          </div>
        </div>

        {/* Lista com scroll independente */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-3 custom-scrollbar">
          {itensFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <History className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-semibold">Nenhum serviço entregue encontrado</p>
              <p className="text-xs text-muted-foreground/80 mt-1">
                {busca
                  ? "Tente alterar os termos de pesquisa ou remover os filtros."
                  : "Assim que os pedidos forem marcados como entregues, eles aparecerão aqui."}
              </p>
              {busca && (
                <Button variant="outline" size="sm" onClick={() => setBusca("")} className="mt-4 text-xs">
                  Limpar busca
                </Button>
              )}
            </div>
          ) : (
            itensFiltrados.map((item) => {
              const whatsLink = item.clienteTelefone ? linkWhatsapp(item.clienteTelefone, `Olá ${item.clienteNome}!`) : null

              return (
                <div
                  key={`${item.tipo}-${item.id}`}
                  className="rounded-xl border border-border/70 bg-card hover:border-teal-500/40 transition-all p-3.5 sm:p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  {/* Informações Principais */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "font-bold text-[11px] px-2 py-0.5",
                          item.tipo === "orcamento"
                            ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                            : "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20"
                        )}
                      >
                        {item.tipo === "orcamento" ? `OS #${item.numero}` : `Pedido #${item.numero}`}
                      </Badge>

                      <Badge
                        variant="secondary"
                        className="bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/20 font-semibold text-[10px] flex items-center gap-1"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Entregue
                      </Badge>

                      {item.dataCriacao && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatarData(item.dataCriacao)}
                        </span>
                      )}

                      {item.contratoAssinado && (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold"
                        >
                          ✓ Assinado
                        </Badge>
                      )}
                    </div>

                    {/* Cliente e Telefone */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-foreground">{item.clienteNome}</span>
                      {item.clienteTelefone && (
                        <a
                          href={whatsLink || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MessageCircle className="h-3 w-3" />
                          {item.clienteTelefone}
                        </a>
                      )}
                    </div>

                    {/* Descrição do serviço */}
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {item.descricao}
                    </div>

                    {/* Observação rápida se houver */}
                    {item.observacao && (
                      <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-0.5 mt-2 inline-block max-w-full truncate">
                        Obs: {item.observacao}
                      </div>
                    )}
                  </div>

                  {/* Valor e Ações */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50 shrink-0">
                    <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatarMoeda(item.valor)}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Abrir OS PDF se for orçamento */}
                      {item.tipo === "orcamento" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAbrirOsPdf(item.id)}
                          className="h-8 px-2 text-xs font-semibold gap-1 text-blue-700 dark:text-blue-300 border-blue-500/30 hover:bg-blue-500/10"
                          title="Abrir PDF da Ordem de Serviço"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">OS PDF</span>
                        </Button>
                      )}

                      {/* Ver Ficha Completa */}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onAbrirMaisDetalhes(item)}
                        className="h-8 px-2.5 text-xs font-semibold gap-1 cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Ver Ficha</span>
                      </Button>

                      {/* Opção para voltar status se entregou por engano */}
                      {onMoverStatus && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (window.confirm(`Deseja reabrir o serviço #${item.numero} e voltar para "Pronto"?`)) {
                              onMoverStatus(item.tipo, item.id, "pronto")
                            }
                          }}
                          className="h-8 px-2 text-xs text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10"
                          title="Voltar status para 'Pronto' (caso tenha sido entregue por engano)"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Rodapé */}
        <div className="p-3 border-t border-border/70 bg-muted/40 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Mostrando {itensFiltrados.length} de {todosEntregues.length} serviços entregues
          </span>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
