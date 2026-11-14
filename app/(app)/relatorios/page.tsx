"use client"

import { useEffect, useMemo, useState } from "react"
import { useData } from "@/context/data-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { quantidadeMaterialConsumida } from "@/lib/calculo"
import { formatarMoeda, formatarData } from "@/lib/format"
import { cn } from "@/lib/utils"
import { resumirFinanceiro } from "@/lib/financeiro"
import type { ItemProduto, Orcamento } from "@/lib/types"
import {
  FileSpreadsheet,
  Printer,
  TrendingUp,
  TrendingDown,
  Clock,
  Package,
  FileText,
  Layers,
  BarChart3,
  Calendar,
  User,
} from "lucide-react"

function atalhosDePeriodo() {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth()

  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const inicioMes = new Date(ano, mes, 1)
  const fimMes = new Date(ano, mes + 1, 0)
  const inicioMesPassado = new Date(ano, mes - 1, 1)
  const fimMesPassado = new Date(ano, mes, 0)
  const inicioAno = new Date(ano, 0, 1)
  const inicioSemana = new Date(hoje)
  inicioSemana.setDate(hoje.getDate() - hoje.getDay())

  return [
    { label: "Esta semana", de: fmt(inicioSemana), ate: fmt(hoje) },
    { label: "Este mês", de: fmt(inicioMes), ate: fmt(fimMes) },
    { label: "Mês passado", de: fmt(inicioMesPassado), ate: fmt(fimMesPassado) },
    { label: "Este ano", de: fmt(inicioAno), ate: fmt(hoje) },
    { label: "Tudo", de: "", ate: "" },
  ]
}

export default function RelatoriosPage() {
  const { orcamentos, materiais, lancamentos, pedidosRapidos, clientes } = useData()
  const [dataDe, setDataDe] = useState("")
  const [dataAte, setDataAte] = useState("")
  const [hoje, setHoje] = useState<Date | null>(null)
  const [exportando, setExportando] = useState(false)
  const [secaoFiltro, setSecaoFiltro] = useState<"todas" | "orcamentos" | "pedidos" | "financeiro" | "materiais">("todas")

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoje(new Date())
    const { de, ate } = atalhosDePeriodo()[1] // este mês por padrão
    setDataDe(de)
    setDataAte(ate)
  }, [])

  const resumo = useMemo(
    () => resumirFinanceiro(lancamentos, hoje ?? new Date(0), dataDe, dataAte),
    [lancamentos, hoje, dataDe, dataAte]
  )

  const orcamentosPeriodo = useMemo(() => {
    return orcamentos.filter((o) => {
      if (o.status !== "fechado" || !o.fechadoEm) return false
      if (dataDe && o.fechadoEm < `${dataDe}T00:00:00`) return false
      if (dataAte && o.fechadoEm > `${dataAte}T23:59:59`) return false
      return true
    }).sort((a, b) => new Date(b.fechadoEm!).getTime() - new Date(a.fechadoEm!).getTime())
  }, [orcamentos, dataDe, dataAte])

  const pedidosPeriodo = useMemo(() => {
    return pedidosRapidos.filter((p) => {
      if (!["pronto", "entregue"].includes(p.status)) return false
      if (dataDe && p.criadoEm < `${dataDe}T00:00:00`) return false
      if (dataAte && p.criadoEm > `${dataAte}T23:59:59`) return false
      return true
    }).sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
  }, [pedidosRapidos, dataDe, dataAte])

  const lancamentosPeriodo = useMemo(() => {
    return lancamentos.filter((l) => {
      const dataRef = l.status === "pago" ? (l.pagoEm ?? l.criadoEm) : l.vencimento
      if (dataDe && dataRef < `${dataDe}T00:00:00`) return false
      if (dataAte && dataRef > `${dataAte}T23:59:59`) return false
      return true
    }).sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  }, [lancamentos, dataDe, dataAte])

  const usoMaterial = useMemo(() => {
    const porMaterial = new Map<string, { nome: string; unidade: string; quantidade: number; custo: number }>()
    for (const o of orcamentosPeriodo) {
      const partes: { item: ItemProduto; snap?: Orcamento["materialFechado"] }[] = [
        { item: o.item, snap: o.materialFechado },
        ...(o.item.itensAdicionais ?? []).map((extra) => ({ item: extra, snap: extra.materialFechado })),
      ]
      for (const { item, snap } of partes) {
        const mat = materiais.find((m) => m.id === item.materialId)
        if (!snap && !mat) continue
        const id = snap?.id ?? mat!.id
        const nome = snap?.nome ?? mat!.nome
        const unidade = snap?.unidade ?? mat!.unidade
        const qtd = snap?.quantidade ?? quantidadeMaterialConsumida(item, mat!)
        const custo = snap?.custo ?? qtd * mat!.precoUnitario
        const atual = porMaterial.get(id)
        if (atual) { atual.quantidade += qtd; atual.custo += custo }
        else porMaterial.set(id, { nome, unidade: unidade === "m2" ? "m²" : "un", quantidade: qtd, custo })
      }
    }
    return Array.from(porMaterial.values()).sort((a, b) => b.custo - a.custo)
  }, [orcamentosPeriodo, materiais])

  const totalOrcamentos = orcamentosPeriodo.reduce((s, o) => s + (o.totalFechado ?? 0), 0)
  const totalPedidos = pedidosPeriodo.reduce((s, p) => s + p.total, 0)
  const saldo = resumo.recebido - resumo.pago
  const totalCustoMateriais = usoMaterial.reduce((s, m) => s + m.custo, 0)

  function nomeCliente(id?: string) {
    return clientes.find((c) => c.id === id)?.nome ?? "—"
  }

  async function exportarExcel() {
    setExportando(true)
    try {
      const { utils, writeFile } = await import("xlsx")
      const periodo = dataDe || dataAte
        ? `${dataDe || "início"} a ${dataAte || "hoje"}`
        : "Todos os períodos"

      const abaResumo = [
        ["Relatório — Toldos Print"],
        ["Período:", periodo],
        ["Gerado em:", new Date().toLocaleString("pt-BR")],
        [],
        ["RESUMO FINANCEIRO", ""],
        ["Recebido no período", resumo.recebido],
        ["Pago no período", resumo.pago],
        ["Saldo (recebido − pago)", saldo],
        ["Em aberto a receber", resumo.aReceber],
        ["Em aberto a pagar", resumo.aPagar],
        ["Vencido a receber", resumo.vencidoAReceber],
        ["Vencido a pagar", resumo.vencidoAPagar],
        [],
        ["ORÇAMENTOS FECHADOS", ""],
        ["Quantidade", orcamentosPeriodo.length],
        ["Valor total", totalOrcamentos],
        [],
        ["PEDIDOS (PRONTOS + ENTREGUES)", ""],
        ["Quantidade", pedidosPeriodo.length],
        ["Valor total", totalPedidos],
      ]

      const abaOrcamentos = [
        ["Nº", "Cliente", "Data Fechamento", "Total (R$)", "Status"],
        ...orcamentosPeriodo.map((o) => [
          `#${o.numero}`,
          nomeCliente(o.clienteId),
          o.fechadoEm ? formatarData(o.fechadoEm) : "",
          o.totalFechado ?? 0,
          "Fechado",
        ]),
      ]

      const abaPedidos = [
        ["Nº", "Cliente", "Produto", "Variante", "Data", "Total (R$)", "Status"],
        ...pedidosPeriodo.map((p) => [
          `#${p.numero}`,
          p.clienteNome || "—",
          p.produtoNome ?? "—",
          p.varianteNome ?? "—",
          formatarData(p.criadoEm),
          p.total,
          p.status === "entregue" ? "Entregue" : "Pronto",
        ]),
      ]

      const abaLancamentos = [
        ["Descrição", "Tipo", "Categoria", "Valor (R$)", "Vencimento", "Status", "Forma Pgto", "Cliente"],
        ...lancamentosPeriodo.map((l) => [
          l.descricao,
          l.tipo === "receita" ? "Receita" : "Despesa",
          l.categoria,
          l.valor,
          formatarData(l.vencimento),
          l.status === "pago" ? "Pago" : "Pendente",
          l.formaPagamento ?? "",
          nomeCliente(l.clienteId),
        ]),
      ]

      const abaMateriais = [
        ["Material", "Quantidade", "Unidade", "Custo (R$)"],
        ...usoMaterial.map((m) => [m.nome, m.quantidade.toFixed(2), m.unidade, m.custo]),
      ]

      const wb = utils.book_new()
      utils.book_append_sheet(wb, utils.aoa_to_sheet(abaResumo), "Resumo")
      utils.book_append_sheet(wb, utils.aoa_to_sheet(abaOrcamentos), "Orçamentos")
      utils.book_append_sheet(wb, utils.aoa_to_sheet(abaPedidos), "Pedidos")
      utils.book_append_sheet(wb, utils.aoa_to_sheet(abaLancamentos), "Lançamentos")
      utils.book_append_sheet(wb, utils.aoa_to_sheet(abaMateriais), "Uso de Material")

      const nome = `relatorio-${dataDe || "inicio"}-${dataAte || "hoje"}.xlsx`
      writeFile(wb, nome)
    } finally {
      setExportando(false)
    }
  }

  const atalhos = atalhosDePeriodo()

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black tracking-tight">Relatórios</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão completa do período — financeiro, orçamentos, pedidos e materiais.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-10 text-xs font-semibold gap-2 border-border/80"
          >
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </Button>
          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={exportando}
            className="h-10 text-xs font-bold gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {exportando ? "Gerando..." : "Exportar Excel"}
          </Button>
        </div>
      </div>

      {/* Filtro de Período */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-2xs print:hidden">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Período do Relatório
        </span>

        {/* Atalhos rápidos de data */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {atalhos.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => { setDataDe(a.de); setDataAte(a.ate) }}
              className={cn(
                "rounded-full px-3 py-1.5 font-medium transition-colors shrink-0",
                dataDe === a.de && dataAte === a.ate
                  ? "bg-primary text-primary-foreground shadow-2xs font-bold"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted"
              )}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Inputs de data customizada */}
        <div className="grid grid-cols-2 sm:flex sm:items-end gap-2.5 pt-1 border-t border-border/50">
          <div className="flex flex-col gap-1.5 flex-1">
            <Label className="text-xs text-muted-foreground font-semibold">Data Inicial</Label>
            <Input
              type="date"
              value={dataDe}
              onChange={(e) => setDataDe(e.target.value)}
              className="h-10 bg-background text-sm rounded-xl"
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <Label className="text-xs text-muted-foreground font-semibold">Data Final</Label>
            <Input
              type="date"
              value={dataAte}
              onChange={(e) => setDataAte(e.target.value)}
              className="h-10 bg-background text-sm rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Período exibido na impressão */}
      <p className="hidden text-sm text-muted-foreground print:block">
        Período: {dataDe ? formatarData(`${dataDe}T00:00:00`) : "início"} até {dataAte ? formatarData(`${dataAte}T00:00:00`) : "hoje"} — gerado em {new Date().toLocaleString("pt-BR")}
      </p>

      {/* CARDS DE MÉTRICAS (Responsivos no celular) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Recebido */}
        <div className="flex flex-col rounded-2xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Recebido</span>
          </div>
          <p className="mt-1 text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {formatarMoeda(resumo.recebido)}
          </p>
          <span className="text-[10px] text-muted-foreground/80 mt-0.5">no período</span>
        </div>

        {/* Pago */}
        <div className="flex flex-col rounded-2xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
            <TrendingDown className="h-3.5 w-3.5 text-destructive" />
            <span>Pago</span>
          </div>
          <p className="mt-1 text-lg sm:text-2xl font-black text-destructive">
            {formatarMoeda(resumo.pago)}
          </p>
          <span className="text-[10px] text-muted-foreground/80 mt-0.5">despesas baixadas</span>
        </div>

        {/* Saldo período */}
        <div className="flex flex-col rounded-2xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>Saldo Período</span>
          </div>
          <p className={cn("mt-1 text-lg sm:text-2xl font-black", saldo < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
            {formatarMoeda(saldo)}
          </p>
          <span className="text-[10px] text-muted-foreground/80 mt-0.5">recebido − pago</span>
        </div>

        {/* Vencido a receber */}
        <div className="flex flex-col rounded-2xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
            <Clock className="h-3.5 w-3.5 text-orange-500" />
            <span>Vencido a Receber</span>
          </div>
          <p className={cn("mt-1 text-lg sm:text-2xl font-black", resumo.vencidoAReceber > 0 ? "text-destructive" : "text-foreground")}>
            {formatarMoeda(resumo.vencidoAReceber)}
          </p>
          <span className="text-[10px] text-muted-foreground/80 mt-0.5">cobranças em atraso</span>
        </div>

        {/* Orçamentos fechados */}
        <div className="flex flex-col rounded-2xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
            <FileText className="h-3.5 w-3.5 text-blue-500" />
            <span>Orçamentos Fechados</span>
          </div>
          <p className="mt-1 text-lg sm:text-2xl font-black text-foreground">
            {orcamentosPeriodo.length}
          </p>
          <p className="text-xs font-semibold text-primary mt-0.5 truncate">
            {formatarMoeda(totalOrcamentos)}
          </p>
        </div>

        {/* Pedidos concluídos */}
        <div className="flex flex-col rounded-2xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
            <Package className="h-3.5 w-3.5 text-violet-500" />
            <span>Pedidos Prontos</span>
          </div>
          <p className="mt-1 text-lg sm:text-2xl font-black text-foreground">
            {pedidosPeriodo.length}
          </p>
          <p className="text-xs font-semibold text-primary mt-0.5 truncate">
            {formatarMoeda(totalPedidos)}
          </p>
        </div>

        {/* A receber */}
        <div className="flex flex-col rounded-2xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span>A Receber Aberto</span>
          </div>
          <p className="mt-1 text-lg sm:text-2xl font-black text-foreground">
            {formatarMoeda(resumo.aReceber)}
          </p>
          <span className="text-[10px] text-muted-foreground/80 mt-0.5">em aberto</span>
        </div>

        {/* Custo materiais */}
        <div className="flex flex-col rounded-2xl border border-border/80 bg-card p-3 sm:p-4 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Custo Materiais</span>
          </div>
          <p className="mt-1 text-lg sm:text-2xl font-black text-foreground">
            {formatarMoeda(totalCustoMateriais)}
          </p>
          <span className="text-[10px] text-muted-foreground/80 mt-0.5">
            {usoMaterial.length} tipos usados
          </span>
        </div>
      </div>

      {/* SELETOR DE SEÇÕES (Abas rápidas para celular) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs border-b border-border/70 print:hidden">
        <button
          type="button"
          onClick={() => setSecaoFiltro("todas")}
          className={cn(
            "px-3.5 py-2 font-bold rounded-xl transition-colors shrink-0",
            secaoFiltro === "todas"
              ? "bg-primary text-primary-foreground shadow-2xs"
              : "bg-muted/70 hover:bg-muted text-muted-foreground"
          )}
        >
          Todas as Seções
        </button>
        <button
          type="button"
          onClick={() => setSecaoFiltro("orcamentos")}
          className={cn(
            "px-3.5 py-2 font-bold rounded-xl transition-colors shrink-0 flex items-center gap-1.5",
            secaoFiltro === "orcamentos"
              ? "bg-primary text-primary-foreground shadow-2xs"
              : "bg-muted/70 hover:bg-muted text-muted-foreground"
          )}
        >
          <FileText className="h-3.5 w-3.5" />
          Orçamentos ({orcamentosPeriodo.length})
        </button>
        <button
          type="button"
          onClick={() => setSecaoFiltro("pedidos")}
          className={cn(
            "px-3.5 py-2 font-bold rounded-xl transition-colors shrink-0 flex items-center gap-1.5",
            secaoFiltro === "pedidos"
              ? "bg-primary text-primary-foreground shadow-2xs"
              : "bg-muted/70 hover:bg-muted text-muted-foreground"
          )}
        >
          <Package className="h-3.5 w-3.5" />
          Pedidos ({pedidosPeriodo.length})
        </button>
        <button
          type="button"
          onClick={() => setSecaoFiltro("financeiro")}
          className={cn(
            "px-3.5 py-2 font-bold rounded-xl transition-colors shrink-0 flex items-center gap-1.5",
            secaoFiltro === "financeiro"
              ? "bg-primary text-primary-foreground shadow-2xs"
              : "bg-muted/70 hover:bg-muted text-muted-foreground"
          )}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Lançamentos ({lancamentosPeriodo.length})
        </button>
        <button
          type="button"
          onClick={() => setSecaoFiltro("materiais")}
          className={cn(
            "px-3.5 py-2 font-bold rounded-xl transition-colors shrink-0 flex items-center gap-1.5",
            secaoFiltro === "materiais"
              ? "bg-primary text-primary-foreground shadow-2xs"
              : "bg-muted/70 hover:bg-muted text-muted-foreground"
          )}
        >
          <Layers className="h-3.5 w-3.5" />
          Materiais ({usoMaterial.length})
        </button>
      </div>

      {/* 1. SEÇÃO: ORÇAMENTOS FECHADOS */}
      {(secaoFiltro === "todas" || secaoFiltro === "orcamentos") && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-bold">
              <FileText className="h-5 w-5 text-blue-500" />
              Orçamentos fechados no período
              <Badge variant="secondary" className="font-bold">{orcamentosPeriodo.length}</Badge>
            </h2>
            <span className="text-sm font-black text-primary">
              Total: {formatarMoeda(totalOrcamentos)}
            </span>
          </div>

          {/* Cards Mobile */}
          <div className="block md:hidden">
            {orcamentosPeriodo.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/80 bg-card/50 p-6 text-center text-sm text-muted-foreground">
                Nenhum orçamento fechado nesse período.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {orcamentosPeriodo.map((o) => (
                  <div
                    key={o.id}
                    className="flex flex-col rounded-2xl border border-border/80 bg-card p-3.5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-black text-primary">#{o.numero}</span>
                        <h3 className="font-bold text-sm text-foreground leading-snug break-words">
                          {nomeCliente(o.clienteId)}
                        </h3>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[10px] font-semibold">
                        Fechado
                      </Badge>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {o.fechadoEm ? formatarData(o.fechadoEm) : "—"}
                      </span>
                      <span className="text-base font-black text-primary">
                        {formatarMoeda(o.totalFechado ?? 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabela Desktop */}
          <div className="hidden md:block rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-bold">Nº</TableHead>
                  <TableHead className="font-bold">Cliente</TableHead>
                  <TableHead className="font-bold">Data fechamento</TableHead>
                  <TableHead className="text-right font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orcamentosPeriodo.map((o) => (
                  <TableRow key={o.id} className="hover:bg-muted/30">
                    <TableCell className="font-bold text-primary">#{o.numero}</TableCell>
                    <TableCell className="font-medium">{nomeCliente(o.clienteId)}</TableCell>
                    <TableCell>{o.fechadoEm ? formatarData(o.fechadoEm) : "—"}</TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {formatarMoeda(o.totalFechado ?? 0)}
                    </TableCell>
                  </TableRow>
                ))}
                {orcamentosPeriodo.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Nenhum orçamento fechado nesse período.
                    </TableCell>
                  </TableRow>
                )}
                {orcamentosPeriodo.length > 0 && (
                  <TableRow className="font-bold bg-muted/20">
                    <TableCell colSpan={3} className="text-right text-muted-foreground">Total</TableCell>
                    <TableCell className="text-right text-primary font-black">{formatarMoeda(totalOrcamentos)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* 2. SEÇÃO: PEDIDOS CONCLUÍDOS */}
      {(secaoFiltro === "todas" || secaoFiltro === "pedidos") && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-bold">
              <Package className="h-5 w-5 text-violet-500" />
              Pedidos (prontos/entregues) no período
              <Badge variant="secondary" className="font-bold">{pedidosPeriodo.length}</Badge>
            </h2>
            <span className="text-sm font-black text-primary">
              Total: {formatarMoeda(totalPedidos)}
            </span>
          </div>

          {/* Cards Mobile */}
          <div className="block md:hidden">
            {pedidosPeriodo.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/80 bg-card/50 p-6 text-center text-sm text-muted-foreground">
                Nenhum pedido concluído nesse período.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {pedidosPeriodo.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col rounded-2xl border border-border/80 bg-card p-3.5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-black text-primary">#{p.numero}</span>
                        <h3 className="font-bold text-sm text-foreground leading-snug break-words">
                          {p.clienteNome || "Cliente Avulso"}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.produtoNome ?? "—"}
                          {p.varianteNome ? ` · ${p.varianteNome}` : ""}
                        </p>
                      </div>
                      <Badge
                        variant={p.status === "entregue" ? "secondary" : "default"}
                        className="shrink-0 text-[10px] font-semibold"
                      >
                        {p.status === "entregue" ? "Entregue" : "Pronto"}
                      </Badge>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{formatarData(p.criadoEm)}</span>
                      <span className="text-base font-black text-primary">
                        {formatarMoeda(p.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabela Desktop */}
          <div className="hidden md:block rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-bold">Nº</TableHead>
                  <TableHead className="font-bold">Cliente</TableHead>
                  <TableHead className="font-bold">Produto</TableHead>
                  <TableHead className="font-bold">Data</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="text-right font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidosPeriodo.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/30">
                    <TableCell className="font-bold text-primary">#{p.numero}</TableCell>
                    <TableCell className="font-medium">{p.clienteNome || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.produtoNome ?? "—"}
                      {p.varianteNome ? ` · ${p.varianteNome}` : ""}
                    </TableCell>
                    <TableCell>{formatarData(p.criadoEm)}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "entregue" ? "secondary" : "default"}>
                        {p.status === "entregue" ? "Entregue" : "Pronto"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {formatarMoeda(p.total)}
                    </TableCell>
                  </TableRow>
                ))}
                {pedidosPeriodo.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhum pedido concluído nesse período.
                    </TableCell>
                  </TableRow>
                )}
                {pedidosPeriodo.length > 0 && (
                  <TableRow className="font-bold bg-muted/20">
                    <TableCell colSpan={5} className="text-right text-muted-foreground">Total</TableCell>
                    <TableCell className="text-right text-primary font-black">{formatarMoeda(totalPedidos)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* 3. SEÇÃO: LANÇAMENTOS FINANCEIROS */}
      {(secaoFiltro === "todas" || secaoFiltro === "financeiro") && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-bold">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Lançamentos financeiros no período
              <Badge variant="secondary" className="font-bold">{lancamentosPeriodo.length}</Badge>
            </h2>
          </div>

          {/* Cards Mobile */}
          <div className="block md:hidden">
            {lancamentosPeriodo.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/80 bg-card/50 p-6 text-center text-sm text-muted-foreground">
                Nenhum lançamento nesse período.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {lancamentosPeriodo.map((l) => (
                  <div
                    key={l.id}
                    className="flex flex-col rounded-2xl border border-border/80 bg-card p-3.5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm text-foreground leading-snug break-words">
                          {l.descricao}
                        </h3>
                        <span className="text-xs text-muted-foreground block mt-0.5">
                          {l.categoria}
                        </span>
                      </div>
                      <Badge
                        variant={l.status === "pago" ? "secondary" : "default"}
                        className={cn(
                          "shrink-0 text-[10px] font-semibold",
                          l.status === "pago" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        )}
                      >
                        {l.status === "pago" ? "Pago" : "Pendente"}
                      </Badge>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Venc: {formatarData(l.vencimento)}
                      </span>
                      <span
                        className={cn(
                          "text-base font-black",
                          l.tipo === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                        )}
                      >
                        {l.tipo === "receita" ? "+" : "−"} {formatarMoeda(l.valor)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabela Desktop */}
          <div className="hidden md:block rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-bold">Descrição</TableHead>
                  <TableHead className="font-bold">Categoria</TableHead>
                  <TableHead className="font-bold">Vencimento</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="text-right font-bold">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lancamentosPeriodo.map((l) => (
                  <TableRow key={l.id} className="hover:bg-muted/30">
                    <TableCell className="font-semibold text-foreground">{l.descricao}</TableCell>
                    <TableCell className="text-muted-foreground">{l.categoria}</TableCell>
                    <TableCell>{formatarData(l.vencimento)}</TableCell>
                    <TableCell>
                      <Badge variant={l.status === "pago" ? "secondary" : "default"}>
                        {l.status === "pago" ? "Pago" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn("text-right font-black", l.tipo === "receita" ? "text-primary" : "text-destructive")}>
                      {l.tipo === "receita" ? "+" : "−"} {formatarMoeda(l.valor)}
                    </TableCell>
                  </TableRow>
                ))}
                {lancamentosPeriodo.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Nenhum lançamento nesse período.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* 4. SEÇÃO: USO DE MATERIAIS */}
      {(secaoFiltro === "todas" || secaoFiltro === "materiais") && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-bold">
              <Layers className="h-5 w-5 text-orange-500" />
              Uso de materiais no período
              <Badge variant="secondary" className="font-bold">{usoMaterial.length}</Badge>
            </h2>
            <span className="text-sm font-black text-foreground">
              Total: {formatarMoeda(totalCustoMateriais)}
            </span>
          </div>

          {/* Cards Mobile */}
          <div className="block md:hidden">
            {usoMaterial.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/80 bg-card/50 p-6 text-center text-sm text-muted-foreground">
                Nenhum uso de material nesse período.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {usoMaterial.map((item) => (
                  <div
                    key={item.nome}
                    className="flex flex-col rounded-2xl border border-border/80 bg-card p-3.5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm text-foreground leading-snug break-words">
                        {item.nome}
                      </h3>
                      <Badge variant="secondary" className="shrink-0 text-[10px] font-semibold">
                        {item.quantidade.toFixed(2)} {item.unidade}
                      </Badge>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Custo calculado:</span>
                      <span className="text-base font-black text-foreground">
                        {formatarMoeda(item.custo)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabela Desktop */}
          <div className="hidden md:block rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-bold">Material</TableHead>
                  <TableHead className="font-bold">Quantidade</TableHead>
                  <TableHead className="text-right font-bold">Custo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usoMaterial.map((item) => (
                  <TableRow key={item.nome} className="hover:bg-muted/30">
                    <TableCell className="font-semibold text-foreground">{item.nome}</TableCell>
                    <TableCell>{item.quantidade.toFixed(2)} {item.unidade}</TableCell>
                    <TableCell className="text-right font-bold text-foreground">{formatarMoeda(item.custo)}</TableCell>
                  </TableRow>
                ))}
                {usoMaterial.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      Nenhum uso de material nesse período.
                    </TableCell>
                  </TableRow>
                )}
                {usoMaterial.length > 0 && (
                  <TableRow className="font-bold bg-muted/20">
                    <TableCell colSpan={2} className="text-right text-muted-foreground">Total</TableCell>
                    <TableCell className="text-right font-black text-foreground">{formatarMoeda(totalCustoMateriais)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  )
}
