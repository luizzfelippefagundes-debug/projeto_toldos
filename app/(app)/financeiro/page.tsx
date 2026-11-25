"use client"

import { useEffect, useMemo, useState } from "react"
import { useData } from "@/context/data-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Combobox } from "@/components/ui/combobox"
import { LancamentoFormDialog } from "@/components/financeiro/lancamento-form-dialog"
import { LeitorBoletoDialog } from "@/components/financeiro/leitor-boleto-dialog"
import { LancamentoDetalheDialog } from "@/components/financeiro/lancamento-detalhe-dialog"
import { SimuladorTaxasCard } from "@/components/financeiro/simulador-taxas-card"
import { formatarData, formatarMoeda } from "@/lib/format"
import { agruparPagasDaSerie } from "@/lib/series"
import {
  estaLancamentoVencido,
  resumirFinanceiro,
} from "@/lib/financeiro"
import type { LancamentoFinanceiro, TipoLancamento } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  ChevronRight,
  FileCheck,
  Plus,
  Search,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  User,
  Tag,
  CreditCard,
  Calculator,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react"

const rotuloFormaPagamento: Record<string, string> = {
  boleto: "Boleto",
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  transferencia: "Transferência",
}

export default function FinanceiroPage() {
  const { lancamentos, clientes, orcamentos } = useData()
  const [abaAtiva, setAbaAtiva] = useState<"fluxo" | "taxas">("fluxo")
  const [filtroTipo, setFiltroTipo] = useState<TipoLancamento | "todos" | "boleto" | "fixas">("todos")
  const [filtroCliente, setFiltroCliente] = useState("todos")
  const [busca, setBusca] = useState("")
  const [soComOs, setSoComOs] = useState(true)
  const [selecionado, setSelecionado] = useState<LancamentoFinanceiro | null>(null)
  const [incluirPessoais, setIncluirPessoais] = useState(false)
  const [seriesAbertas, setSeriesAbertas] = useState<Set<string>>(new Set())
  const [expandirMetricas, setExpandirMetricas] = useState(false)

  function abrirSerie(chave: string) {
    setSeriesAbertas((atual) => new Set(atual).add(chave))
  }

  const [hoje, setHoje] = useState<Date | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoje(new Date())
  }, [])

  const resumo = useMemo(
    () => resumirFinanceiro(lancamentos, hoje ?? new Date(0), "", "", incluirPessoais),
    [lancamentos, hoje, incluirPessoais]
  )

  const saldo = resumo.recebido - resumo.pago

  const orcamentosAbertos = useMemo(() => {
    return orcamentos.filter((o) => o.status === "aberto")
  }, [orcamentos])

  const totalOrcamentosAbertos = useMemo(() => {
    return orcamentosAbertos.reduce((acc, o) => acc + (o.totalFechado || 0), 0)
  }, [orcamentosAbertos])

  const ordenados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return lancamentos
      .filter((l) =>
        filtroTipo === "todos"
          ? true
          : filtroTipo === "boleto"
            ? l.formaPagamento === "boleto"
            : filtroTipo === "fixas"
              ? l.despesaFixa === true
              : l.tipo === filtroTipo
      )
      .filter((l) => filtroCliente === "todos" || l.clienteId === filtroCliente)
      .filter((l) => {
        if (!termo) return true
        const desc = (l.descricao ?? "").toLowerCase()
        const cli = clientes.find((c) => c.id === l.clienteId)
        const cliNome = (cli?.nome ?? "").toLowerCase()
        const cliCpf = (cli?.cpf ?? "").toLowerCase()
        const cat = (l.categoria ?? "").toLowerCase()
        return (
          desc.includes(termo) ||
          cliNome.includes(termo) ||
          cliCpf.includes(termo) ||
          cat.includes(termo)
        )
      })
      .filter((l) => {
        if (!soComOs) return true
        if (l.origem === "orcamento" && l.origemId) {
          const orc = orcamentos.find((o) => o.id === l.origemId)
          return Boolean(orc?.osEmitidaEm)
        }
        return true
      })
      .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())
  }, [lancamentos, filtroTipo, filtroCliente, busca, clientes, soComOs, orcamentos])

  const itensLista = useMemo(
    () => agruparPagasDaSerie(ordenados, lancamentos, seriesAbertas),
    [ordenados, lancamentos, seriesAbertas]
  )

  function nomeCliente(id?: string) {
    if (!id) return "—"
    return clientes.find((c) => c.id === id)?.nome ?? "—"
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black tracking-tight">Financeiro</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Contas a pagar e a receber — orçamentos fechados e pedidos entram aqui automaticamente.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
          <Button
            type="button"
            variant={abaAtiva === "taxas" ? "default" : "outline"}
            onClick={() => setAbaAtiva((prev) => (prev === "taxas" ? "fluxo" : "taxas"))}
            className="w-full sm:w-auto font-bold gap-1.5 text-xs sm:text-sm h-10 px-2 sm:px-4 shadow-2xs cursor-pointer"
          >
            <Calculator className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="whitespace-nowrap">Simulador Cartão (MP)</span>
          </Button>
          <LeitorBoletoDialog />
          <LancamentoFormDialog
            trigger={
              <Button className="w-full sm:w-auto font-bold gap-1.5 text-xs sm:text-sm h-10 px-2 sm:px-4 shadow-2xs">
                <Plus className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">Novo Lançamento</span>
              </Button>
            }
          />
        </div>
      </div>

      {/* Abas de Navegação do Financeiro */}
      <div className="flex items-center gap-2 border-b border-border/70 pb-2">
        <button
          type="button"
          onClick={() => setAbaAtiva("fluxo")}
          className={cn(
            "flex items-center gap-2 py-2 px-3.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer",
            abaAtiva === "fluxo"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Wallet className="h-4 w-4 shrink-0" />
          <span>Fluxo de Caixa & Lançamentos</span>
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva("taxas")}
          className={cn(
            "flex items-center gap-2 py-2 px-3.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer relative",
            abaAtiva === "taxas"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Calculator className="h-4 w-4 shrink-0 text-amber-400" />
          <span>Simulador de Taxas (Mercado Pago)</span>
          <span className="hidden sm:inline-block text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md bg-amber-500 text-black">
            3x a 12x
          </span>
        </button>
      </div>

      {/* CONTEÚDO DA ABA SELECIONADA */}
      {abaAtiva === "taxas" ? (
        <SimuladorTaxasCard valorInicial={560} />
      ) : (
        <>
      {/* DASHBOARD DE MÉTRICAS (Ultra responsivo e intuitivo no celular) */}
      <div className="flex flex-col gap-2.5">
        {/* Card Principal: Saldo Atual e Totais */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Saldo Atual (Recebido − Pago)
              </span>
              <div
                className={cn(
                  "mt-1 text-2xl sm:text-3xl font-black tracking-tight",
                  saldo < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                )}
              >
                {formatarMoeda(saldo)}
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-5 border-t sm:border-t-0 sm:border-l border-border/60 pt-2.5 sm:pt-0 sm:pl-5">
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block">
                  Total Recebido
                </span>
                <span className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {formatarMoeda(resumo.recebido)}
                </span>
              </div>
              <div className="h-8 w-px bg-border/60" />
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block">
                  Total Pago
                </span>
                <span className="text-sm sm:text-base font-bold text-destructive">
                  {formatarMoeda(resumo.pago)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Banner Explícito: Orçamentos em Aberto (Propostas comerciais em negociação) */}
        {orcamentosAbertos.length > 0 && (
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 dark:bg-blue-950/30 p-3.5 sm:p-4 text-xs sm:text-sm text-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <span className="text-xl shrink-0">📋</span>
              <div>
                <div className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5 flex-wrap">
                  <span>Propostas Comerciais em Aberto:</span>
                  <span className="font-black text-foreground">
                    {orcamentosAbertos.length} orçamento{orcamentosAbertos.length !== 1 ? "s" : ""} ({formatarMoeda(totalOrcamentosAbertos)})
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  <strong>Nota contábil:</strong> Orçamentos em aberto são propostas em negociação e não entram no &quot;A Receber&quot; abaixo para não inflar o fluxo de caixa real antes de serem fechados pelo cliente.
                </p>
              </div>
            </div>
            <a
              href="/orcamentos"
              className="shrink-0 self-end sm:self-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-bold transition-all shadow-xs"
            >
              Ver Orçamentos →
            </a>
          </div>
        )}

        {/* Grid 2x2 com cards principais de ação */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* A Receber */}
          <button
            type="button"
            onClick={() => setFiltroTipo("receita")}
            className={cn(
              "flex flex-col rounded-2xl border p-3 sm:p-4 text-left transition-all",
              filtroTipo === "receita"
                ? "border-primary bg-primary/5 shadow-xs"
                : "border-border/80 bg-card hover:bg-muted/40 shadow-2xs"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground">
                A Receber
              </span>
              <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="mt-1 text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
              {formatarMoeda(resumo.aReceber)}
            </span>
            {resumo.vencidoAReceber > 0 && (
              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-destructive">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {formatarMoeda(resumo.vencidoAReceber)} vencido
              </span>
            )}
          </button>

          {/* A Pagar este mês */}
          <button
            type="button"
            onClick={() => setFiltroTipo("despesa")}
            className={cn(
              "flex flex-col rounded-2xl border p-3 sm:p-4 text-left transition-all",
              filtroTipo === "despesa"
                ? "border-primary bg-primary/5 shadow-xs"
                : "border-border/80 bg-card hover:bg-muted/40 shadow-2xs"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground">
                A Pagar (Mês)
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
            </div>
            <span className="mt-1 text-lg sm:text-xl font-black text-destructive">
              {hoje ? formatarMoeda(resumo.aPagarMes) : "—"}
            </span>
            {resumo.vencidoAPagar > 0 ? (
              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-destructive">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {formatarMoeda(resumo.vencidoAPagar)} atrasado
              </span>
            ) : (
              <span className="mt-1 text-[10px] text-muted-foreground truncate">
                Total futuro: {formatarMoeda(resumo.aPagar)}
              </span>
            )}
          </button>

          {/* Boletos próximos 7 dias */}
          <button
            type="button"
            onClick={() => setFiltroTipo("boleto")}
            className={cn(
              "flex flex-col rounded-2xl border p-3 sm:p-4 text-left transition-all",
              filtroTipo === "boleto"
                ? "border-primary bg-primary/5 shadow-xs"
                : "border-border/80 bg-card hover:bg-muted/40 shadow-2xs"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground">
                Boletos (7 dias)
              </span>
              <CreditCard className="h-3.5 w-3.5 text-primary" />
            </div>
            <span
              className={cn(
                "mt-1 text-lg sm:text-xl font-black",
                resumo.boletosVencendo7Dias > 0 ? "text-destructive" : "text-foreground"
              )}
            >
              {hoje ? resumo.boletosVencendo7Dias : "—"}
            </span>
            <span className="mt-1 text-[10px] text-muted-foreground/80">
              vencem em até uma semana
            </span>
          </button>

          {/* Despesas Fixas */}
          <button
            type="button"
            onClick={() => setFiltroTipo("fixas")}
            className={cn(
              "flex flex-col rounded-2xl border p-3 sm:p-4 text-left transition-all",
              filtroTipo === "fixas"
                ? "border-primary bg-primary/5 shadow-xs"
                : "border-border/80 bg-card hover:bg-muted/40 shadow-2xs"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground">
                Fixas Pendentes
              </span>
              <Calendar className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="mt-1 text-lg sm:text-xl font-black text-foreground">
              {hoje ? formatarMoeda(resumo.despesasFixas) : "—"}
            </span>
            <span className="mt-1 text-[10px] text-muted-foreground/80">
              água, luz, internet, etc.
            </span>
          </button>
        </div>

        {/* Toggle para métricas detalhadas no mobile */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setExpandirMetricas(!expandirMetricas)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            {expandirMetricas ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Ocultar detalhes extras
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Ver detalhes de vencimentos e prazos
              </>
            )}
          </button>

          {(resumo.pessoalForaDosTotais > 0 || incluirPessoais) && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={incluirPessoais} onCheckedChange={setIncluirPessoais} />
              <span className="hidden sm:inline">Incluir despesas pessoais</span>
              <span className="sm:hidden">Pessoais</span>
            </label>
          )}
        </div>

        {/* Painel de Métricas Detalhadas Expandido */}
        {expandirMetricas && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 rounded-2xl border border-border/70 bg-muted/20 p-3 text-xs animate-in fade-in duration-200">
            <div>
              <span className="text-muted-foreground font-medium block">Vencido a receber:</span>
              <span className={cn("font-bold text-sm", resumo.vencidoAReceber > 0 ? "text-destructive" : "text-foreground")}>
                {hoje ? formatarMoeda(resumo.vencidoAReceber) : "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground font-medium block">Vencido a pagar:</span>
              <span className={cn("font-bold text-sm", resumo.vencidoAPagar > 0 ? "text-destructive" : "text-foreground")}>
                {hoje ? formatarMoeda(resumo.vencidoAPagar) : "—"}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-muted-foreground font-medium block">Recebimentos próx. 7 dias:</span>
              <span className="font-bold text-sm text-foreground">
                {hoje ? resumo.recebiveisVencendo7Dias : "—"} lançamento(s)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* BARRA DE FILTROS E BUSCA */}
      <div className="flex flex-col gap-3">
        {/* Linha de busca e cliente */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar cliente, empresa ou descrição..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 pr-9 h-11 rounded-xl bg-card border-border/80 text-sm focus-visible:ring-primary/30"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Combobox
            options={[
              { value: "todos", label: "Todos os clientes" },
              ...clientes.map((c) => ({ value: c.id, label: c.nome })),
            ]}
            value={filtroCliente}
            onValueChange={setFiltroCliente}
            placeholder="Todos os clientes"
            searchPlaceholder="Buscar cliente na lista..."
            emptyText="Nenhum cliente encontrado."
            className="w-full h-11 bg-card border-border/80 rounded-xl text-sm"
            contentClassName="min-w-[300px] max-w-[420px]"
          />
        </div>

        {/* Chips de filtro por tipo + modificador "Apenas com OS" */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {(
            [
              { valor: "todos", label: `Todos (${lancamentos.length})` },
              { valor: "receita", label: "Receitas" },
              { valor: "despesa", label: "Despesas" },
              { valor: "fixas", label: "Fixas" },
              { valor: "boleto", label: "Boletos" },
            ] as const
          ).map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              onClick={() => setFiltroTipo(opcao.valor)}
              className={cn(
                "px-3 py-1.5 rounded-full font-medium transition-colors shrink-0",
                filtroTipo === opcao.valor
                  ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                  : "bg-muted/70 hover:bg-muted text-muted-foreground"
              )}
            >
              {opcao.label}
            </button>
          ))}

          {/* Filtro modificador: Só com OS */}
          <button
            type="button"
            onClick={() => setSoComOs((v) => !v)}
            className={cn(
              "px-3 py-1.5 rounded-full font-medium transition-all shrink-0 inline-flex items-center gap-1.5",
              soComOs
                ? "bg-emerald-600 text-white shadow-2xs font-semibold"
                : "bg-muted/70 hover:bg-muted text-muted-foreground"
            )}
            title="Exibir apenas orçamentos que já possuem Ordem de Serviço emitida"
          >
            <FileCheck className="h-3.5 w-3.5" />
            <span>Apenas com OS</span>
          </button>
        </div>
      </div>

      {seriesAbertas.size > 0 && (
        <button
          onClick={() => setSeriesAbertas(new Set())}
          className="w-fit text-xs font-semibold text-primary underline underline-offset-4 hover:opacity-80"
        >
          Recolher parcelas pagas
        </button>
      )}

      {/* FEED MOBILE (Cards individuais - block md:hidden) */}
      <div className="block md:hidden">
        {itensLista.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-8 text-center bg-card/50">
            <Wallet className="h-10 w-10 text-muted-foreground/50 mb-2" />
            <p className="font-semibold text-foreground">Nenhum lançamento encontrado</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Tente redefinir os filtros de busca ou alterar a categoria selecionada.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {itensLista.map((item) => {
              if (item.tipo === "pagas") {
                return (
                  <button
                    key={`pagas-${item.chave}`}
                    onClick={() => abrirSerie(item.chave)}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-dashed border-border/80 bg-muted/30 p-3.5 text-left text-sm transition-all hover:bg-muted/50 active:scale-[0.99]"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="min-w-0">
                        <span className="font-bold text-foreground block truncate">{item.nome}</span>
                        <span className="block text-xs text-muted-foreground">
                          {item.itens.length} parcelas pagas — toque pra ver
                        </span>
                      </span>
                    </span>
                    <span className="font-bold text-muted-foreground shrink-0">
                      {formatarMoeda(item.total)}
                    </span>
                  </button>
                )
              }

              const lancamento = item.lancamento
              const vencido = hoje ? estaLancamentoVencido(lancamento, hoje) : false
              const isReceita = lancamento.tipo === "receita"

              return (
                <button
                  key={lancamento.id}
                  onClick={() => setSelecionado(lancamento)}
                  className="flex flex-col rounded-2xl border border-border/80 bg-card p-3.5 text-left transition-all hover:border-primary/40 active:scale-[0.99] shadow-2xs"
                >
                  {/* Linha superior: Tipo, Descrição e Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <div
                        className={cn(
                          "mt-0.5 rounded-lg p-1.5 shrink-0",
                          isReceita
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-red-500/10 text-red-600 dark:text-red-400"
                        )}
                      >
                        {isReceita ? (
                          <ArrowDownLeft className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-sm text-foreground leading-snug break-words">
                            {lancamento.descricao}
                          </h3>
                          {lancamento.pessoal && (
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                              Pessoal
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground block mt-0.5">
                          {lancamento.categoria}
                        </span>
                      </div>
                    </div>

                    <Badge
                      variant={
                        lancamento.status === "pago"
                          ? "secondary"
                          : vencido
                            ? "destructive"
                            : "default"
                      }
                      className={cn(
                        "shrink-0 text-[10px] font-semibold",
                        lancamento.status === "pago" &&
                          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                      )}
                    >
                      {lancamento.status === "pago"
                        ? "Pago"
                        : vencido
                          ? "Vencido"
                          : "Pendente"}
                    </Badge>
                  </div>

                  {/* Informações de Cliente, Forma de Pagamento e Vencimento */}
                  <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-col gap-1.5 text-xs text-muted-foreground">
                    {lancamento.clienteId && (
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                        <span className="truncate">{nomeCliente(lancamento.clienteId)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                        <span
                          className={cn(
                            vencido && lancamento.status !== "pago" && "font-bold text-destructive"
                          )}
                        >
                          Vencimento: {formatarData(lancamento.vencimento)}
                        </span>
                      </div>

                      {lancamento.formaPagamento && (
                        <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                          {rotuloFormaPagamento[lancamento.formaPagamento] ?? lancamento.formaPagamento}
                          {lancamento.numeroBoleto ? ` · Nº ${lancamento.numeroBoleto}` : ""}
                        </span>
                      )}
                    </div>

                    {lancamento.status === "pago" && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        {lancamento.pagoEm
                          ? `Pago em ${formatarData(lancamento.pagoEm)}`
                          : "Pago"}
                      </span>
                    )}
                  </div>

                  {/* Valor em destaque no rodapé */}
                  <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Valor:</span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "text-base font-black tracking-tight",
                          isReceita
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {isReceita ? "+ " : "− "}
                        {formatarMoeda(lancamento.valor)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* TABELA DESKTOP (hidden md:block) */}
      <div className="hidden rounded-2xl border border-border/80 bg-card shadow-2xs md:block overflow-x-auto w-full max-w-full">
        <Table className="w-full text-xs sm:text-sm">
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="font-bold text-foreground min-w-[130px] max-w-[220px] pl-4">Descrição</TableHead>
              <TableHead className="font-bold text-foreground min-w-[90px] max-w-[140px]">Cliente</TableHead>
              <TableHead className="font-bold text-foreground whitespace-nowrap min-w-[85px]">Categoria</TableHead>
              <TableHead className="font-bold text-foreground whitespace-nowrap min-w-[80px]">Forma</TableHead>
              <TableHead className="font-bold text-foreground whitespace-nowrap min-w-[85px]">Vencimento</TableHead>
              <TableHead className="font-bold text-foreground whitespace-nowrap text-right min-w-[95px]">Valor</TableHead>
              <TableHead className="font-bold text-foreground whitespace-nowrap text-right min-w-[125px] pr-5">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itensLista.map((item) => {
              if (item.tipo === "pagas") {
                return (
                  <TableRow
                    key={`pagas-${item.chave}`}
                    onClick={() => abrirSerie(item.chave)}
                    className="cursor-pointer bg-muted/30 hover:bg-muted/50"
                  >
                    <TableCell colSpan={5} className="text-muted-foreground pl-4">
                      <span className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4 shrink-0" />
                        <span className="font-medium text-foreground">{item.nome}</span>
                        — {item.itens.length} parcelas pagas (clique pra ver uma por uma)
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-semibold text-right whitespace-nowrap">
                      {formatarMoeda(item.total)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap pr-5">
                      <Badge variant="secondary">Pagas</Badge>
                    </TableCell>
                  </TableRow>
                )
              }
              const lancamento = item.lancamento
              const vencido = hoje ? estaLancamentoVencido(lancamento, hoje) : false
              return (
                <TableRow
                  key={lancamento.id}
                  onClick={() => setSelecionado(lancamento)}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <TableCell className="font-medium min-w-[130px] max-w-[220px] pl-4">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate block" title={lancamento.descricao}>
                        {lancamento.descricao}
                      </span>
                      {lancamento.pessoal && (
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px] shrink-0">
                          Pessoal
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground min-w-[90px] max-w-[140px]">
                    <span className="truncate block" title={nomeCliente(lancamento.clienteId)}>
                      {nomeCliente(lancamento.clienteId)}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap min-w-[85px]">
                    <span className="truncate block max-w-[130px]" title={lancamento.categoria}>
                      {lancamento.categoria}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap min-w-[80px]">
                    <span className="block truncate">
                      {lancamento.formaPagamento
                        ? rotuloFormaPagamento[lancamento.formaPagamento]
                        : "—"}
                    </span>
                    {lancamento.numeroBoleto && (
                      <span
                        className="block text-[11px] font-mono text-muted-foreground/80 truncate max-w-[130px]"
                        title={`Boleto Nº ${lancamento.numeroBoleto}`}
                      >
                        Nº {lancamento.numeroBoleto}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap min-w-[85px]">
                    <span>{formatarData(lancamento.vencimento)}</span>
                    {vencido && lancamento.status !== "pago" && (
                      <Badge variant="destructive" className="mt-0.5 block w-fit text-[10px] px-1.5 py-0">
                        Vencido
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "whitespace-nowrap text-right font-bold min-w-[95px]",
                      lancamento.tipo === "receita" ? "text-primary" : "text-destructive"
                    )}
                  >
                    {lancamento.tipo === "receita" ? "+ " : "− "}
                    {formatarMoeda(lancamento.valor)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right min-w-[125px] pr-5">
                    <div className="flex flex-col items-end gap-0.5">
                      <Badge variant={lancamento.status === "pago" ? "secondary" : "default"} className="text-[11px]">
                        {lancamento.status === "pago" ? "Pago" : "Pendente"}
                      </Badge>
                      {lancamento.status === "pago" && (
                        <span className="block text-[10px] text-muted-foreground whitespace-nowrap">
                          {lancamento.pagoEm
                            ? `Baixado em ${formatarData(lancamento.pagoEm)}`
                            : "Baixa antiga sem data"}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {itensLista.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nenhum lançamento encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      </>
      )}

      <LancamentoDetalheDialog
        lancamento={selecionado}
        onOpenChange={(open) => !open && setSelecionado(null)}
        hoje={hoje}
      />
    </div>
  )
}
