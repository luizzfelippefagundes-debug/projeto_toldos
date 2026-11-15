"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"

const MESES = [
  { index: 0, nome: "Janeiro", sigla: "Jan" },
  { index: 1, nome: "Fevereiro", sigla: "Fev" },
  { index: 2, nome: "Março", sigla: "Mar" },
  { index: 3, nome: "Abril", sigla: "Abr" },
  { index: 4, nome: "Maio", sigla: "Mai" },
  { index: 5, nome: "Junho", sigla: "Jun" },
  { index: 6, nome: "Julho", sigla: "Jul" },
  { index: 7, nome: "Agosto", sigla: "Ago" },
  { index: 8, nome: "Setembro", sigla: "Set" },
  { index: 9, nome: "Outubro", sigla: "Out" },
  { index: 10, nome: "Novembro", sigla: "Nov" },
  { index: 11, nome: "Dezembro", sigla: "Dez" },
]

export default function RelatoriosPage() {
  const { orcamentos, materiais, lancamentos, pedidosRapidos, clientes } = useData()
  const [dataDe, setDataDe] = useState("")
  const [dataAte, setDataAte] = useState("")
  const [hoje, setHoje] = useState<Date | null>(null)
  const [exportando, setExportando] = useState(false)
  const [secaoFiltro, setSecaoFiltro] = useState<"todas" | "orcamentos" | "pedidos" | "financeiro" | "materiais">("todas")

  // Filtro de Mês e Ano
  const [anoSelecionado, setAnoSelecionado] = useState<number>(new Date().getFullYear())
  const [mesSelecionado, setMesSelecionado] = useState<number | "todos" | "custom">(new Date().getMonth())

  // Filtro de Status (Todos, Apenas Pagos, Apenas Pendentes)
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "pagos" | "pendentes">("todos")
  const [mostrarDatasCustom, setMostrarDatasCustom] = useState(false)

  // Inicializa com o mês atual
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoje(new Date())
    const agora = new Date()
    const ano = agora.getFullYear()
    const mes = agora.getMonth()
    selecionarMes(ano, mes)
  }, [])

  function selecionarMes(ano: number, mesIndex: number) {
    const inicio = new Date(ano, mesIndex, 1)
    const fim = new Date(ano, mesIndex + 1, 0)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    setDataDe(fmt(inicio))
    setDataAte(fmt(fim))
    setMesSelecionado(mesIndex)
    setAnoSelecionado(ano)
  }

  function selecionarAnoTodo(ano: number) {
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    setDataDe(fmt(new Date(ano, 0, 1)))
    setDataAte(fmt(new Date(ano, 11, 31)))
    setMesSelecionado("todos")
    setAnoSelecionado(ano)
  }

  function selecionarHistoricoCompleto() {
    setDataDe("")
    setDataAte("")
    setMesSelecionado("custom")
  }

  function mesAnterior() {
    let novoMes = typeof mesSelecionado === "number" ? mesSelecionado - 1 : new Date().getMonth() - 1
    let novoAno = anoSelecionado
    if (novoMes < 0) {
      novoMes = 11
      novoAno -= 1
    }
    selecionarMes(novoAno, novoMes)
  }

  function mesProximo() {
    let novoMes = typeof mesSelecionado === "number" ? mesSelecionado + 1 : new Date().getMonth() + 1
    let novoAno = anoSelecionado
    if (novoMes > 11) {
      novoMes = 0
      novoAno += 1
    }
    selecionarMes(novoAno, novoMes)
  }

  const resumo = useMemo(
    () => resumirFinanceiro(lancamentos, hoje ?? new Date(0), dataDe, dataAte),
    [lancamentos, hoje, dataDe, dataAte]
  )

  const orcamentosPeriodo = useMemo(() => {
    return orcamentos
      .filter((o) => {
        if (o.status !== "fechado" || !o.fechadoEm) return false
        if (dataDe && o.fechadoEm < `${dataDe}T00:00:00`) return false
        if (dataAte && o.fechadoEm > `${dataAte}T23:59:59`) return false

        // Filtro de status pago vs pendente (baseado nos lançamentos vinculados ao orçamento)
        if (filtroStatus !== "todos") {
          const lances = lancamentos.filter((l) => l.origem === "orcamento" && l.origemId === o.id)
          if (lances.length > 0) {
            const todosPagos = lances.every((l) => l.status === "pago")
            if (filtroStatus === "pagos" && !todosPagos) return false
            if (filtroStatus === "pendentes" && todosPagos) return false
          }
        }

        return true
      })
      .sort((a, b) => new Date(b.fechadoEm!).getTime() - new Date(a.fechadoEm!).getTime())
  }, [orcamentos, dataDe, dataAte, filtroStatus, lancamentos])

  const pedidosPeriodo = useMemo(() => {
    return pedidosRapidos
      .filter((p) => {
        if (dataDe && p.criadoEm < `${dataDe}T00:00:00`) return false
        if (dataAte && p.criadoEm > `${dataAte}T23:59:59`) return false

        if (filtroStatus === "pagos") {
          return p.status === "entregue"
        }
        if (filtroStatus === "pendentes") {
          return p.status !== "entregue"
        }
        return ["pronto", "entregue"].includes(p.status)
      })
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
  }, [pedidosRapidos, dataDe, dataAte, filtroStatus])

  const lancamentosPeriodo = useMemo(() => {
    return lancamentos
      .filter((l) => {
        const dataRef = l.status === "pago" ? (l.pagoEm ?? l.criadoEm) : l.vencimento
        if (dataDe && dataRef < `${dataDe}T00:00:00`) return false
        if (dataAte && dataRef > `${dataAte}T23:59:59`) return false

        if (filtroStatus === "pagos" && l.status !== "pago") return false
        if (filtroStatus === "pendentes" && l.status !== "pendente") return false

        return true
      })
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  }, [lancamentos, dataDe, dataAte, filtroStatus])

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
        if (atual) {
          atual.quantidade += qtd
          atual.custo += custo
        } else {
          porMaterial.set(id, { nome, unidade: unidade === "m2" ? "m²" : "un", quantidade: qtd, custo })
        }
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

  // Nome do período formatado para o usuário
  const tituloPeriodo = useMemo(() => {
    if (typeof mesSelecionado === "number") {
      return `${MESES[mesSelecionado].nome} de ${anoSelecionado}`
    }
    if (mesSelecionado === "todos") {
      return `Ano Inteiro de ${anoSelecionado}`
    }
    if (dataDe || dataAte) {
      return `${dataDe ? formatarData(`${dataDe}T00:00:00`) : "Início"} até ${dataAte ? formatarData(`${dataAte}T00:00:00`) : "Hoje"}`
    }
    return "Todo o Histórico"
  }, [mesSelecionado, anoSelecionado, dataDe, dataAte])

  // EXPORTAÇÃO EXCEL PROFISSIONAL (Com larguras calculadas, formatação monetária e sem textos cortados)
  async function exportarExcel() {
    setExportando(true)
    try {
      const { utils, writeFile } = await import("xlsx")

      // Função para ajustar larguras de colunas automaticamente evitando textos cortados no Excel
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function ajustarLarguras(ws: any, dados: (string | number | null | undefined)[][]) {
        const colWidths: number[] = []
        for (const row of dados) {
          row.forEach((val, colIdx) => {
            const len = val != null ? String(val).length : 0
            colWidths[colIdx] = Math.max(colWidths[colIdx] || 12, len + 3)
          })
        }
        ws["!cols"] = colWidths.map((w) => ({ wch: Math.min(65, Math.max(14, w)) }))
      }

      // 1. Aba Resumo
      const abaResumo = [
        ["TOLDOS PRINT & COMUNICAÇÃO VISUAL — DEMONSTRATIVO GERENCIAL", "", ""],
        ["Período:", tituloPeriodo, ""],
        ["Data de Geração:", new Date().toLocaleString("pt-BR"), ""],
        ["Filtro de Liquidação:", filtroStatus === "pagos" ? "Apenas Pagos" : filtroStatus === "pendentes" ? "Apenas Pendentes" : "Todos", ""],
        [],
        ["INDICADOR GERENCIAL", "VALOR FORMATADO", "VALOR NUMÉRICO (R$)"],
        ["Total Recebido no Período", formatarMoeda(resumo.recebido), resumo.recebido],
        ["Total Pago no Período", formatarMoeda(resumo.pago), resumo.pago],
        ["Saldo Líquido (Recebido − Pago)", formatarMoeda(saldo), saldo],
        ["A Receber em Aberto", formatarMoeda(resumo.aReceber), resumo.aReceber],
        ["A Pagar em Aberto (Total)", formatarMoeda(resumo.aPagar), resumo.aPagar],
        ["Vencido a Receber (Em atraso)", formatarMoeda(resumo.vencidoAReceber), resumo.vencidoAReceber],
        ["Vencido a Pagar (Em atraso)", formatarMoeda(resumo.vencidoAPagar), resumo.vencidoAPagar],
        [],
        ["PRODUÇÃO & PEDIDOS", "", ""],
        ["Orçamentos Fechados", `${orcamentosPeriodo.length} orçamentos`, totalOrcamentos],
        ["Pedidos Concluídos", `${pedidosPeriodo.length} pedidos`, totalPedidos],
        ["Custo Total de Materiais Consumidos", formatarMoeda(totalCustoMateriais), totalCustoMateriais],
      ]

      // 2. Aba Orçamentos
      const abaOrcamentos = [
        ["Nº DA OS", "CLIENTE", "DATA FECHAMENTO", "VALOR TOTAL (R$)", "SITUAÇÃO"],
        ...orcamentosPeriodo.map((o) => [
          `#${o.numero}`,
          nomeCliente(o.clienteId),
          o.fechadoEm ? formatarData(o.fechadoEm) : "",
          formatarMoeda(o.totalFechado ?? 0),
          "Fechado",
        ]),
        [],
        ["TOTAL ACUMULADO", "", "", formatarMoeda(totalOrcamentos), `${orcamentosPeriodo.length} itens`],
      ]

      // 3. Aba Pedidos
      const abaPedidos = [
        ["Nº PEDIDO", "CLIENTE", "PRODUTO", "VARIANTE / TAMANHO", "DATA", "VALOR TOTAL (R$)", "STATUS"],
        ...pedidosPeriodo.map((p) => [
          `#${p.numero}`,
          p.clienteNome || "—",
          p.produtoNome ?? "—",
          p.varianteNome ?? "—",
          formatarData(p.criadoEm),
          formatarMoeda(p.total),
          p.status === "entregue" ? "Entregue" : "Pronto",
        ]),
        [],
        ["TOTAL ACUMULADO", "", "", "", "", formatarMoeda(totalPedidos), `${pedidosPeriodo.length} itens`],
      ]

      // 4. Aba Lançamentos
      const abaLancamentos = [
        ["DATA REF.", "TIPO", "CATEGORIA", "DESCRIÇÃO", "CLIENTE", "VALOR (R$)", "STATUS", "FORMA PAGAMENTO"],
        ...lancamentosPeriodo.map((l) => [
          formatarData(l.status === "pago" && l.pagoEm ? l.pagoEm : l.vencimento),
          l.tipo === "receita" ? "Receita (+)" : "Despesa (−)",
          l.categoria,
          l.descricao,
          nomeCliente(l.clienteId),
          formatarMoeda(l.valor),
          l.status === "pago" ? "Pago" : "Pendente",
          l.formaPagamento ?? "Não informada",
        ]),
      ]

      // 5. Aba Materiais
      const abaMateriais = [
        ["MATERIAL", "QUANTIDADE CONSUMIDA", "UNIDADE", "CUSTO TOTAL (R$)"],
        ...usoMaterial.map((m) => [m.nome, m.quantidade.toFixed(2), m.unidade, formatarMoeda(m.custo)]),
        [],
        ["TOTAL CUSTO MATERIAIS", "", "", formatarMoeda(totalCustoMateriais)],
      ]

      const wb = utils.book_new()

      const wsResumo = utils.aoa_to_sheet(abaResumo)
      ajustarLarguras(wsResumo, abaResumo)
      utils.book_append_sheet(wb, wsResumo, "Resumo Executivo")

      const wsOrc = utils.aoa_to_sheet(abaOrcamentos)
      ajustarLarguras(wsOrc, abaOrcamentos)
      utils.book_append_sheet(wb, wsOrc, "Orçamentos Fechados")

      const wsPed = utils.aoa_to_sheet(abaPedidos)
      ajustarLarguras(wsPed, abaPedidos)
      utils.book_append_sheet(wb, wsPed, "Pedidos Rápidos")

      const wsLanc = utils.aoa_to_sheet(abaLancamentos)
      ajustarLarguras(wsLanc, abaLancamentos)
      utils.book_append_sheet(wb, wsLanc, "Lançamentos Financeiros")

      const wsMat = utils.aoa_to_sheet(abaMateriais)
      ajustarLarguras(wsMat, abaMateriais)
      utils.book_append_sheet(wb, wsMat, "Uso de Materiais")

      const nomeArquivo = `relatorio-toldos-print-${dataDe || "inicio"}-${dataAte || "hoje"}.xlsx`
      writeFile(wb, nomeArquivo)
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-8 pb-16 sm:pb-8">
      {/* ========================================================= */}
      {/* CABEÇALHO EXECUTIVO PROFISSIONAL EXCLUSIVO PARA IMPRESSÃO / PDF */}
      {/* ========================================================= */}
      <div className="hidden print:flex flex-col gap-3 pb-4 mb-4 border-b-2 border-slate-900">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-950 uppercase tracking-tight">
              TOLDOS PRINT & COMUNICAÇÃO VISUAL
            </h1>
            <p className="text-xs font-bold text-slate-700">
              Relatório Executivo & Demonstrativo Financeiro
            </p>
            <p className="text-[11px] text-slate-600 font-medium">
              Período selecionado: <strong className="text-slate-900">{tituloPeriodo}</strong>
            </p>
          </div>
          <div className="text-right text-[11px] text-slate-600">
            <p className="font-bold text-slate-900">
              Emitido em: {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR")}
            </p>
            <p className="font-semibold text-slate-800">
              Filtro: {filtroStatus === "pagos" ? "Apenas Pagos" : filtroStatus === "pendentes" ? "Apenas Pendentes" : "Todos os Registros"}
            </p>
          </div>
        </div>

        {/* Quadro Resumo em Linha Compacta para Impressão */}
        <div className="grid grid-cols-5 gap-2 pt-2 border-t border-slate-300 text-xs">
          <div className="p-2 bg-slate-100 rounded border border-slate-300">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Total Recebido</span>
            <span className="text-sm font-black text-emerald-800">{formatarMoeda(resumo.recebido)}</span>
          </div>
          <div className="p-2 bg-slate-100 rounded border border-slate-300">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Total Pago</span>
            <span className="text-sm font-black text-red-800">{formatarMoeda(resumo.pago)}</span>
          </div>
          <div className="p-2 bg-slate-100 rounded border border-slate-300">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Saldo Período</span>
            <span className={cn("text-sm font-black", saldo < 0 ? "text-red-800" : "text-emerald-800")}>
              {formatarMoeda(saldo)}
            </span>
          </div>
          <div className="p-2 bg-slate-100 rounded border border-slate-300">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">A Receber Aberto</span>
            <span className="text-sm font-black text-slate-900">{formatarMoeda(resumo.aReceber)}</span>
          </div>
          <div className="p-2 bg-slate-100 rounded border border-slate-300">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Orçamentos Fechados</span>
            <span className="text-sm font-black text-slate-900">
              {orcamentosPeriodo.length} ({formatarMoeda(totalOrcamentos)})
            </span>
          </div>
        </div>
      </div>

      {/* Header em Tela (Oculto na Impressão) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/60 pb-3 print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-foreground leading-tight">
                Relatórios
              </h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                Demonstrativo gerencial, fluxo financeiro e fechamento de produção
              </p>
            </div>
          </div>

          {/* Botões Compactos no Mobile (ao lado do título para poupar tela) */}
          <div className="flex items-center gap-1.5 sm:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-8 px-2.5 text-xs font-semibold gap-1 border-border/80 shadow-2xs hover:bg-muted"
              title="Imprimir / Salvar em PDF"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>PDF</span>
            </Button>
            <Button
              size="sm"
              onClick={exportarExcel}
              disabled={exportando}
              className="h-8 px-2.5 text-xs font-bold gap-1 shadow-2xs"
              title="Exportar para Excel"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>{exportando ? "..." : "Excel"}</span>
            </Button>
          </div>
        </div>

        {/* Botões Completos no Desktop */}
        <div className="hidden sm:flex sm:items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-9 px-3 text-xs font-semibold gap-2 border-border/80 shadow-2xs hover:bg-muted"
          >
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </Button>
          <Button
            size="sm"
            onClick={exportarExcel}
            disabled={exportando}
            className="h-9 px-3 text-xs font-bold gap-2 shadow-2xs"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {exportando ? "Gerando Excel..." : "Exportar Excel"}
          </Button>
        </div>
      </div>

      {/* PAINEL DE CONTROLE GERENCIAL (Oculto na Impressão) */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/90 p-3 sm:p-4 shadow-sm backdrop-blur-xs print:hidden">
        {/* Linha 1: Período Ativo + Seletor Unificado de Ano */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block leading-tight">
                Período Selecionado
              </span>
              <h2 className="font-extrabold text-sm sm:text-base text-foreground truncate">
                {tituloPeriodo}
              </h2>
            </div>
          </div>

          {/* Navegador de Ano Elegante e Unificado: [ < ] [ 2026 ▾ ] [ > ] */}
          <div className="inline-flex items-center rounded-xl border border-border/80 bg-background/80 shadow-2xs shrink-0 overflow-hidden">
            <button
              type="button"
              onClick={mesAnterior}
              className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="relative border-x border-border/60 px-2 flex items-center">
              <select
                value={anoSelecionado}
                onChange={(e) => {
                  const ano = Number(e.target.value)
                  setAnoSelecionado(ano)
                  if (typeof mesSelecionado === "number") {
                    selecionarMes(ano, mesSelecionado)
                  } else if (mesSelecionado === "todos") {
                    selecionarAnoTodo(ano)
                  }
                }}
                className="h-8 appearance-none bg-transparent pr-4 text-xs font-black text-foreground cursor-pointer focus:outline-none"
              >
                {[2024, 2025, 2026, 2027].map((a) => (
                  <option key={a} value={a} className="bg-popover text-popover-foreground">
                    Ano {a}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 h-3 w-3 text-muted-foreground" />
            </div>

            <button
              type="button"
              onClick={mesProximo}
              className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Linha 2: Seletor de Mês (Grid 6x2 no celular que nunca corta, 12 cols no desktop) */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-border/60">
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 sm:gap-1.5">
            {MESES.map((m) => {
              const ativo = mesSelecionado === m.index
              return (
                <button
                  key={m.index}
                  type="button"
                  onClick={() => selecionarMes(anoSelecionado, m.index)}
                  className={cn(
                    "h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center active:scale-95",
                    ativo
                      ? "bg-primary text-primary-foreground font-black shadow-xs ring-2 ring-primary/30"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                >
                  {m.sigla}
                </button>
              )
            })}
          </div>

          {/* Opções de Escopo: Ano Todo, Todo Histórico, Datas Livres */}
          <div className="grid grid-cols-3 gap-1 pt-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => selecionarAnoTodo(anoSelecionado)}
              className={cn(
                "h-7 rounded-lg font-bold transition-all truncate px-1 text-center",
                mesSelecionado === "todos"
                  ? "bg-primary text-primary-foreground font-black shadow-xs"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
            >
              Ano {anoSelecionado} Todo
            </button>
            <button
              type="button"
              onClick={selecionarHistoricoCompleto}
              className={cn(
                "h-7 rounded-lg font-bold transition-all truncate px-1 text-center",
                mesSelecionado === "custom" && !dataDe && !dataAte
                  ? "bg-primary text-primary-foreground font-black shadow-xs"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
            >
              Todo Histórico
            </button>
            <button
              type="button"
              onClick={() => setMostrarDatasCustom((prev) => !prev)}
              className={cn(
                "h-7 rounded-lg font-bold transition-all truncate px-1 text-center flex items-center justify-center gap-1",
                mostrarDatasCustom || (mesSelecionado === "custom" && (dataDe || dataAte))
                  ? "bg-primary/20 text-primary border border-primary/30 font-black"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
            >
              <span>Datas Livres</span>
              <ChevronDown className={cn("h-3 w-3 transition-transform", mostrarDatasCustom && "rotate-180")} />
            </button>
          </div>

          {/* Ajuste fino por data (Colapsável para não poluir o celular) */}
          {mostrarDatasCustom && (
            <div className="mt-1 p-2.5 rounded-xl bg-muted/30 border border-border/60 flex items-center gap-2 text-xs animate-in fade-in duration-200">
              <div className="flex-1 flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-muted-foreground">De:</span>
                <input
                  type="date"
                  value={dataDe}
                  onChange={(e) => {
                    setDataDe(e.target.value)
                    setMesSelecionado("custom")
                  }}
                  className="w-full h-8 rounded-lg border border-border/80 bg-background px-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex-1 flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-muted-foreground">Até:</span>
                <input
                  type="date"
                  value={dataAte}
                  onChange={(e) => {
                    setDataAte(e.target.value)
                    setMesSelecionado("custom")
                  }}
                  className="w-full h-8 rounded-lg border border-border/80 bg-background px-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          )}
        </div>

        {/* Linha 3: Segmented Control de Situação (Ultra compacto e limpo) */}
        <div className="flex flex-col gap-1 pt-2 border-t border-border/60">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground px-0.5">
            <span className="flex items-center gap-1 font-bold uppercase tracking-wider">
              <Filter className="h-3 w-3 text-primary" /> Filtro de Situação:
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">
              {filtroStatus === "todos"
                ? "Todos os lançamentos"
                : filtroStatus === "pagos"
                ? "Apenas baixados / quitados"
                : "Apenas pendentes / em aberto"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted/40 border border-border/60 text-xs font-bold">
            <button
              type="button"
              onClick={() => setFiltroStatus("todos")}
              className={cn(
                "h-8 rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-95",
                filtroStatus === "todos"
                  ? "bg-background text-foreground shadow-2xs font-black border border-border/70"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus("pagos")}
              className={cn(
                "h-8 rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-95",
                filtroStatus === "pagos"
                  ? "bg-emerald-600 text-white shadow-2xs font-black"
                  : "text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Pagos</span>
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatus("pendentes")}
              className={cn(
                "h-8 rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-95",
                filtroStatus === "pendentes"
                  ? "bg-amber-600 text-white shadow-2xs font-black"
                  : "text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
              )}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Em Aberto</span>
            </button>
          </div>
        </div>
      </div>

      {/* CARDS DE MÉTRICAS EM TELA (Compactos, elegantes e responsivos) */}
      <div className="flex flex-col gap-2.5 print:hidden">
        {/* Bloco 1: 4 Métricas Financeiras Principais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {/* Recebido */}
          <div className="flex flex-col rounded-xl border border-border/80 border-l-4 border-l-emerald-500 bg-card p-3 sm:p-4 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              <span className="truncate">Recebido no Período</span>
            </div>
            <p className="mt-1 text-base sm:text-2xl font-black text-emerald-500 truncate">
              {formatarMoeda(resumo.recebido)}
            </p>
            <span className="text-[10px] text-muted-foreground/80 mt-0.5">receitas baixadas</span>
          </div>

          {/* Pago */}
          <div className="flex flex-col rounded-xl border border-border/80 border-l-4 border-l-destructive bg-card p-3 sm:p-4 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              <span className="truncate">Pago no Período</span>
            </div>
            <p className="mt-1 text-base sm:text-2xl font-black text-destructive truncate">
              {formatarMoeda(resumo.pago)}
            </p>
            <span className="text-[10px] text-muted-foreground/80 mt-0.5">despesas baixadas</span>
          </div>

          {/* Saldo período */}
          <div className="flex flex-col rounded-xl border border-border/80 border-l-4 border-l-primary bg-card p-3 sm:p-4 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span className="truncate">Saldo Líquido</span>
            </div>
            <p className={cn("mt-1 text-base sm:text-2xl font-black truncate", saldo < 0 ? "text-destructive" : "text-emerald-500")}>
              {formatarMoeda(saldo)}
            </p>
            <span className="text-[10px] text-muted-foreground/80 mt-0.5">recebido − pago</span>
          </div>

          {/* Vencido a receber */}
          <div className="flex flex-col rounded-xl border border-border/80 border-l-4 border-l-amber-500 bg-card p-3 sm:p-4 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              <span className="truncate">Vencido a Receber</span>
            </div>
            <p className={cn("mt-1 text-base sm:text-2xl font-black truncate", resumo.vencidoAReceber > 0 ? "text-amber-500" : "text-foreground")}>
              {formatarMoeda(resumo.vencidoAReceber)}
            </p>
            <span className="text-[10px] text-muted-foreground/80 mt-0.5">cobranças em atraso</span>
          </div>
        </div>

        {/* Bloco 2: Métricas Operacionais Secundárias */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {/* Orçamentos fechados */}
          <div className="flex flex-col rounded-xl border border-border/60 bg-card/70 p-2.5 sm:p-3.5 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <FileText className="h-3.5 w-3.5 text-blue-500" />
              <span className="truncate">Orçamentos Fechados</span>
            </div>
            <p className="mt-0.5 text-sm sm:text-lg font-black text-foreground">
              {orcamentosPeriodo.length} <span className="text-xs font-semibold text-primary">({formatarMoeda(totalOrcamentos)})</span>
            </p>
          </div>

          {/* Pedidos concluídos */}
          <div className="flex flex-col rounded-xl border border-border/60 bg-card/70 p-2.5 sm:p-3.5 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <Package className="h-3.5 w-3.5 text-violet-500" />
              <span className="truncate">Pedidos Prontos</span>
            </div>
            <p className="mt-0.5 text-sm sm:text-lg font-black text-foreground">
              {pedidosPeriodo.length} <span className="text-xs font-semibold text-primary">({formatarMoeda(totalPedidos)})</span>
            </p>
          </div>

          {/* A receber aberto */}
          <div className="flex flex-col rounded-xl border border-border/60 bg-card/70 p-2.5 sm:p-3.5 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">A Receber Aberto</span>
            </div>
            <p className="mt-0.5 text-sm sm:text-lg font-black text-foreground">
              {formatarMoeda(resumo.aReceber)}
            </p>
          </div>

          {/* Custo materiais */}
          <div className="flex flex-col rounded-xl border border-border/60 bg-card/70 p-2.5 sm:p-3.5 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">Custo de Materiais</span>
            </div>
            <p className="mt-0.5 text-sm sm:text-lg font-black text-foreground">
              {formatarMoeda(totalCustoMateriais)}
            </p>
          </div>
        </div>
      </div>

      {/* SELETOR DE SEÇÕES (Abas para alternar no celular e tela) */}
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
        <section className="flex flex-col gap-3 print-avoid-break">
          {/* Header da Seção Limpo e Responsivo */}
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border/50">
            <div className="flex items-center gap-1.5 min-w-0">
              <FileText className="h-4 w-4 text-blue-500 shrink-0" />
              <h3 className="font-extrabold text-sm sm:text-base text-foreground truncate">
                Orçamentos Fechados
              </h3>
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-black shrink-0">
                {orcamentosPeriodo.length}
              </Badge>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold text-muted-foreground mr-1 hidden xs:inline">Total:</span>
              <span className="text-xs sm:text-base font-black text-primary">
                {formatarMoeda(totalOrcamentos)}
              </span>
            </div>
          </div>

          {/* Cards Mobile Modernos e Compactos (OCULTOS NA IMPRESSÃO) */}
          <div className="block md:hidden print:hidden">
            {orcamentosPeriodo.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/80 bg-card/50 p-5 text-center text-xs text-muted-foreground">
                Nenhum orçamento fechado para os filtros selecionados.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {orcamentosPeriodo.map((o) => (
                  <Link
                    key={o.id}
                    href={`/orcamentos/${o.id}/orcamento`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3 hover:border-primary/40 active:bg-muted/40 transition-all shadow-2xs group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex flex-col items-center justify-center shrink-0 border border-blue-500/20 font-black">
                        <span className="text-[9px] uppercase tracking-wider text-blue-400 font-bold leading-none">OS</span>
                        <span className="text-xs leading-none mt-0.5">#{o.numero}</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                          {nomeCliente(o.clienteId)}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          <span>{o.fechadoEm ? formatarData(o.fechadoEm) : "—"}</span>
                          <span>•</span>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            Fechado
                          </span>
                          {(o.servicoFechado?.nome || o.materialFechado?.nome) && (
                            <>
                              <span>•</span>
                              <span className="text-[11px] text-muted-foreground truncate max-w-[130px]">
                                {o.servicoFechado?.nome || o.materialFechado?.nome}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-sm text-foreground block">
                        {formatarMoeda(o.totalFechado ?? 0)}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground group-hover:text-primary flex items-center justify-end gap-0.5 mt-0.5">
                        Ver OS <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Tabela Estruturada (Exibida em Desktop e EXCLUSIVA NA IMPRESSÃO / PDF) */}
          <div className="hidden md:block print:block rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs print:border-slate-300 print:shadow-none print:rounded-none">
            <Table className="print-table">
              <TableHeader className="bg-muted/40 print:bg-slate-100">
                <TableRow className="print:border-b-2 print:border-slate-400">
                  <TableHead className="font-bold print:text-slate-900">Nº da OS</TableHead>
                  <TableHead className="font-bold print:text-slate-900">Cliente</TableHead>
                  <TableHead className="font-bold print:text-slate-900">Data Fechamento</TableHead>
                  <TableHead className="text-right font-bold print:text-slate-900">Valor Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orcamentosPeriodo.map((o) => (
                  <TableRow key={o.id} className="hover:bg-muted/30 print:border-b print:border-slate-200">
                    <TableCell className="font-bold text-primary print:text-slate-900">#{o.numero}</TableCell>
                    <TableCell className="font-medium print:text-slate-800">{nomeCliente(o.clienteId)}</TableCell>
                    <TableCell className="print:text-slate-700">{o.fechadoEm ? formatarData(o.fechadoEm) : "—"}</TableCell>
                    <TableCell className="text-right font-bold text-primary print:text-slate-900">
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
                  <TableRow className="font-bold bg-muted/20 print:bg-slate-100 print:border-t-2 print:border-slate-400">
                    <TableCell colSpan={3} className="text-right text-muted-foreground print:text-slate-900">
                      TOTAL DO PERÍODO
                    </TableCell>
                    <TableCell className="text-right text-primary font-black print:text-slate-950">
                      {formatarMoeda(totalOrcamentos)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* 2. SEÇÃO: PEDIDOS CONCLUÍDOS */}
      {(secaoFiltro === "todas" || secaoFiltro === "pedidos") && (
        <section className="flex flex-col gap-3 print-avoid-break">
          {/* Header da Seção Limpo e Responsivo */}
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border/50">
            <div className="flex items-center gap-1.5 min-w-0">
              <Package className="h-4 w-4 text-violet-500 shrink-0" />
              <h3 className="font-extrabold text-sm sm:text-base text-foreground truncate">
                Pedidos Concluídos
              </h3>
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-black shrink-0">
                {pedidosPeriodo.length}
              </Badge>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold text-muted-foreground mr-1 hidden xs:inline">Total:</span>
              <span className="text-xs sm:text-base font-black text-primary">
                {formatarMoeda(totalPedidos)}
              </span>
            </div>
          </div>

          {/* Cards Mobile Modernos e Compactos (OCULTOS NA IMPRESSÃO) */}
          <div className="block md:hidden print:hidden">
            {pedidosPeriodo.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/80 bg-card/50 p-5 text-center text-xs text-muted-foreground">
                Nenhum pedido concluído para os filtros selecionados.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {pedidosPeriodo.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-violet-500/10 text-violet-500 flex flex-col items-center justify-center shrink-0 border border-violet-500/20 font-black">
                        <span className="text-[9px] uppercase tracking-wider text-violet-400 font-bold leading-none">PED</span>
                        <span className="text-xs leading-none mt-0.5">#{p.numero}</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-foreground truncate">
                          {p.clienteNome || "Cliente Avulso"}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          <span>{formatarData(p.criadoEm)}</span>
                          <span>•</span>
                          <span className="text-[11px] text-muted-foreground truncate max-w-[130px]">
                            {p.produtoNome ?? "Produto rápido"}
                            {p.varianteNome ? ` (${p.varianteNome})` : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-sm text-foreground block">
                        {formatarMoeda(p.total)}
                      </span>
                      <Badge
                        variant={p.status === "entregue" ? "secondary" : "default"}
                        className="text-[9px] h-4 px-1.5 font-bold mt-0.5"
                      >
                        {p.status === "entregue" ? "Entregue" : "Pronto"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabela Estruturada (Desktop e Impressão) */}
          <div className="hidden md:block print:block rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs print:border-slate-300 print:shadow-none print:rounded-none">
            <Table className="print-table">
              <TableHeader className="bg-muted/40 print:bg-slate-100">
                <TableRow className="print:border-b-2 print:border-slate-400">
                  <TableHead className="font-bold print:text-slate-900">Nº Pedido</TableHead>
                  <TableHead className="font-bold print:text-slate-900">Cliente</TableHead>
                  <TableHead className="font-bold print:text-slate-900">Produto</TableHead>
                  <TableHead className="font-bold print:text-slate-900">Data</TableHead>
                  <TableHead className="font-bold print:text-slate-900">Status</TableHead>
                  <TableHead className="text-right font-bold print:text-slate-900">Valor Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidosPeriodo.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/30 print:border-b print:border-slate-200">
                    <TableCell className="font-bold text-primary print:text-slate-900">#{p.numero}</TableCell>
                    <TableCell className="font-medium print:text-slate-800">{p.clienteNome || "—"}</TableCell>
                    <TableCell className="text-muted-foreground print:text-slate-700">
                      {p.produtoNome ?? "—"}
                      {p.varianteNome ? ` · ${p.varianteNome}` : ""}
                    </TableCell>
                    <TableCell className="print:text-slate-700">{formatarData(p.criadoEm)}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "entregue" ? "secondary" : "default"} className="print:border print:border-slate-400 print:bg-white print:text-slate-900">
                        {p.status === "entregue" ? "Entregue" : "Pronto"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary print:text-slate-900">
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
                  <TableRow className="font-bold bg-muted/20 print:bg-slate-100 print:border-t-2 print:border-slate-400">
                    <TableCell colSpan={5} className="text-right text-muted-foreground print:text-slate-900">
                      TOTAL DO PERÍODO
                    </TableCell>
                    <TableCell className="text-right text-primary font-black print:text-slate-950">
                      {formatarMoeda(totalPedidos)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* 3. SEÇÃO: LANÇAMENTOS FINANCEIROS */}
      {(secaoFiltro === "todas" || secaoFiltro === "financeiro") && (
        <section className="flex flex-col gap-3 print-avoid-break">
          {/* Header da Seção Limpo e Responsivo */}
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border/50">
            <div className="flex items-center gap-1.5 min-w-0">
              <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />
              <h3 className="font-extrabold text-sm sm:text-base text-foreground truncate">
                Lançamentos Financeiros
              </h3>
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-black shrink-0">
                {lancamentosPeriodo.length}
              </Badge>
            </div>
          </div>

          {/* Cards Mobile Modernos e Compactos (OCULTOS NA IMPRESSÃO) */}
          <div className="block md:hidden print:hidden">
            {lancamentosPeriodo.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/80 bg-card/50 p-5 text-center text-xs text-muted-foreground">
                Nenhum lançamento para os filtros selecionados.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {lancamentosPeriodo.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm border",
                          l.tipo === "receita"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-red-500/10 text-red-500 border-red-500/20"
                        )}
                      >
                        {l.tipo === "receita" ? "+" : "−"}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-foreground truncate">
                          {l.descricao}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          <span>
                            {l.status === "pago" && l.pagoEm
                              ? formatarData(l.pagoEm)
                              : formatarData(l.vencimento)}
                          </span>
                          <span>•</span>
                          <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                            {l.categoria}
                          </span>
                          {l.clienteId && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[100px]">{nomeCliente(l.clienteId)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={cn(
                          "font-black text-sm block",
                          l.tipo === "receita" ? "text-emerald-500" : "text-destructive"
                        )}
                      >
                        {l.tipo === "receita" ? "+" : "−"} {formatarMoeda(l.valor)}
                      </span>
                      <Badge
                        variant={l.status === "pago" ? "secondary" : "default"}
                        className={cn(
                          "text-[9px] h-4 px-1.5 font-bold mt-0.5",
                          l.status === "pago" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {l.status === "pago" ? "Pago" : "Pendente"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabela Estruturada (Desktop e Impressão) */}
          <div className="hidden md:block print:block rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs print:border-slate-300 print:shadow-none print:rounded-none">
            <Table className="print-table">
              <TableHeader className="bg-muted/40 print:bg-slate-100">
                <TableRow className="print:border-b-2 print:border-slate-400">
                  <TableHead className="font-bold print:text-slate-900">Data Ref.</TableHead>
                  <TableHead className="font-bold print:text-slate-900">Tipo</TableHead>
                  <TableHead className="font-bold print:text-slate-900">Descrição</TableHead>
                  <TableHead className="font-bold print:text-slate-900">Categoria / Cliente</TableHead>
                  <TableHead className="font-bold print:text-slate-900">Status</TableHead>
                  <TableHead className="text-right font-bold print:text-slate-900">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lancamentosPeriodo.map((l) => (
                  <TableRow key={l.id} className="hover:bg-muted/30 print:border-b print:border-slate-200">
                    <TableCell className="print:text-slate-700">
                      {formatarData(l.status === "pago" && l.pagoEm ? l.pagoEm : l.vencimento)}
                    </TableCell>
                    <TableCell>
                      <span className={cn("text-xs font-bold", l.tipo === "receita" ? "text-emerald-600 dark:text-emerald-400 print:text-emerald-800" : "text-red-600 dark:text-red-400 print:text-red-800")}>
                        {l.tipo === "receita" ? "Receita" : "Despesa"}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground print:text-slate-900">{l.descricao}</TableCell>
                    <TableCell className="text-muted-foreground print:text-slate-700">
                      {l.categoria} {l.clienteId ? `(${nomeCliente(l.clienteId)})` : ""}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={l.status === "pago" ? "secondary" : "default"}
                        className={cn(
                          "print:border print:border-slate-400 print:bg-white",
                          l.status === "pago" ? "print:text-emerald-800" : "print:text-slate-900"
                        )}
                      >
                        {l.status === "pago" ? "Pago" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn("text-right font-black", l.tipo === "receita" ? "text-primary print:text-slate-900" : "text-destructive print:text-slate-900")}>
                      {l.tipo === "receita" ? "+" : "−"} {formatarMoeda(l.valor)}
                    </TableCell>
                  </TableRow>
                ))}
                {lancamentosPeriodo.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhum lançamento para os filtros selecionados.
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
        <section className="flex flex-col gap-3 print-avoid-break">
          {/* Header da Seção Limpo e Responsivo */}
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border/50">
            <div className="flex items-center gap-1.5 min-w-0">
              <Layers className="h-4 w-4 text-orange-500 shrink-0" />
              <h3 className="font-extrabold text-sm sm:text-base text-foreground truncate">
                Consumo de Materiais
              </h3>
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-black shrink-0">
                {usoMaterial.length}
              </Badge>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold text-muted-foreground mr-1 hidden xs:inline">Custo Total:</span>
              <span className="text-xs sm:text-base font-black text-foreground">
                {formatarMoeda(totalCustoMateriais)}
              </span>
            </div>
          </div>

          {/* Cards Mobile Modernos e Compactos (OCULTOS NA IMPRESSÃO) */}
          <div className="block md:hidden print:hidden">
            {usoMaterial.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/80 bg-card/50 p-5 text-center text-xs text-muted-foreground">
                Nenhum uso de material nesse período.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {usoMaterial.map((item) => (
                  <div
                    key={item.nome}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0 border border-orange-500/20">
                        <Layers className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-foreground truncate">
                          {item.nome}
                        </h4>
                        <span className="text-xs text-muted-foreground block mt-0.5 font-medium">
                          Consumo: <strong className="text-foreground">{item.quantidade.toFixed(2)} {item.unidade}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-muted-foreground block">Custo</span>
                      <span className="font-black text-sm text-foreground">
                        {formatarMoeda(item.custo)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabela Estruturada (Desktop e Impressão) */}
          <div className="hidden md:block print:block rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs print:border-slate-300 print:shadow-none print:rounded-none">
            <Table className="print-table">
              <TableHeader className="bg-muted/40 print:bg-slate-100">
                <TableRow className="print:border-b-2 print:border-slate-400">
                  <TableHead className="font-bold print:text-slate-900">Material</TableHead>
                  <TableHead className="font-bold print:text-slate-900">Quantidade Consumida</TableHead>
                  <TableHead className="text-right font-bold print:text-slate-900">Custo Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usoMaterial.map((item) => (
                  <TableRow key={item.nome} className="hover:bg-muted/30 print:border-b print:border-slate-200">
                    <TableCell className="font-semibold text-foreground print:text-slate-900">{item.nome}</TableCell>
                    <TableCell className="print:text-slate-700">{item.quantidade.toFixed(2)} {item.unidade}</TableCell>
                    <TableCell className="text-right font-bold text-foreground print:text-slate-900">{formatarMoeda(item.custo)}</TableCell>
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
                  <TableRow className="font-bold bg-muted/20 print:bg-slate-100 print:border-t-2 print:border-slate-400">
                    <TableCell colSpan={2} className="text-right text-muted-foreground print:text-slate-900">TOTAL</TableCell>
                    <TableCell className="text-right font-black text-foreground print:text-slate-950">{formatarMoeda(totalCustoMateriais)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* ESTILOS DE IMPRESSÃO A4 (Evita páginas infinitas, cortes feios e cartões brutos) */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          body {
            background: white !important;
            color: #0f172a !important;
          }
          .print-table {
            display: table !important;
            width: 100% !important;
            border-collapse: collapse !important;
          }
          .print-table th {
            padding: 5px 8px !important;
            font-size: 11px !important;
            text-transform: uppercase !important;
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            border-bottom: 2px solid #94a3b8 !important;
          }
          .print-table td {
            padding: 5px 8px !important;
            font-size: 10.5px !important;
            line-height: 1.3 !important;
            border-bottom: 1px solid #e2e8f0 !important;
          }
          .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  )
}
