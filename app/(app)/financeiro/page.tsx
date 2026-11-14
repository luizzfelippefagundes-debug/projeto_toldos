"use client"

import { useEffect, useMemo, useState } from "react"
import { useData } from "@/context/data-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { LancamentoDetalheDialog } from "@/components/financeiro/lancamento-detalhe-dialog"
import { formatarData, formatarMoeda } from "@/lib/format"
import { agruparPagasDaSerie } from "@/lib/series"
import {
  estaLancamentoVencido,
  resumirFinanceiro,
} from "@/lib/financeiro"
import type { LancamentoFinanceiro, TipoLancamento } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ChevronRight, Plus, Search } from "lucide-react"

const rotuloFormaPagamento: Record<string, string> = {
  boleto: "Boleto",
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  transferencia: "Transferência",
}

export default function FinanceiroPage() {
  const { lancamentos, clientes, orcamentos } = useData()
  const [filtroTipo, setFiltroTipo] = useState<TipoLancamento | "todos" | "boleto" | "fixas">("todos")
  const [filtroCliente, setFiltroCliente] = useState("todos")
  const [busca, setBusca] = useState("")
  const [soComOs, setSoComOs] = useState(true)
  const [selecionado, setSelecionado] = useState<LancamentoFinanceiro | null>(null)
  // Despesas pessoais ficam fora dos totais, a não ser que a pessoa queira ver tudo junto.
  const [incluirPessoais, setIncluirPessoais] = useState(false)
  // Séries (financiamento etc.) com as parcelas pagas abertas na lista.
  const [seriesAbertas, setSeriesAbertas] = useState<Set<string>>(new Set())

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Contas a pagar e a receber — orçamentos fechados e pedidos
            aprovados entram aqui automaticamente.
          </p>
        </div>
        <LancamentoFormDialog />
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              A receber
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-primary">
            {formatarMoeda(resumo.aReceber)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              A pagar este mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">
              {hoje ? formatarMoeda(resumo.aPagarMes) : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Total comprometido (com parcelas futuras): {formatarMoeda(resumo.aPagar)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recebido no total
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-primary">
            {formatarMoeda(resumo.recebido)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pago no total
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-destructive">
            {formatarMoeda(resumo.pago)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo recebido − pago
            </CardTitle>
          </CardHeader>
          <CardContent
            className={cn(
              "text-3xl font-bold",
              saldo < 0 && "text-destructive"
            )}
          >
            {formatarMoeda(saldo)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vencido a receber
            </CardTitle>
          </CardHeader>
          <CardContent
            className={cn(
              "text-3xl font-bold",
              resumo.vencidoAReceber > 0 && "text-destructive"
            )}
          >
            {hoje ? formatarMoeda(resumo.vencidoAReceber) : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vencido a pagar
            </CardTitle>
          </CardHeader>
          <CardContent
            className={cn(
              "text-3xl font-bold",
              resumo.vencidoAPagar > 0 && "text-destructive"
            )}
          >
            {hoje ? formatarMoeda(resumo.vencidoAPagar) : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recebimentos nos próximos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {hoje ? resumo.recebiveisVencendo7Dias : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Boletos nos próximos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent
            className={cn(
              "text-3xl font-bold",
              resumo.boletosVencendo7Dias > 0 && "text-destructive"
            )}
          >
            {hoje ? resumo.boletosVencendo7Dias : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Despesas fixas pendentes
            </CardTitle>
          </CardHeader>
          <CardContent
            className={cn(
              "text-3xl font-bold",
              resumo.despesasFixas > 0 && "text-destructive"
            )}
          >
            {hoje ? formatarMoeda(resumo.despesasFixas) : "—"}
          </CardContent>
        </Card>
      </div>
      {(resumo.pessoalForaDosTotais > 0 || incluirPessoais) && (
        <label className="flex w-fit cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
          <Switch checked={incluirPessoais} onCheckedChange={setIncluirPessoais} />
          <span>
            Incluir despesas pessoais nos totais
            {!incluirPessoais && (
              <span className="ml-1 text-muted-foreground">
                ({formatarMoeda(resumo.pessoalForaDosTotais)} a pagar ficam de fora)
              </span>
            )}
          </span>
        </label>
      )}
      <p className="text-xs text-muted-foreground">
        Valores recebidos e pagos consideram a data da baixa. Registros antigos
        sem data de baixa usam a data de criação do lançamento.
      </p>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { valor: "todos", label: "Todos" },
              { valor: "receita", label: "Receitas" },
              { valor: "despesa", label: "Despesas" },
              { valor: "fixas", label: "Fixas" },
              { valor: "boleto", label: "Boletos" },
            ] as const
          ).map((opcao) => (
            <button
              key={opcao.valor}
              onClick={() => setFiltroTipo(opcao.valor)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm",
                filtroTipo === opcao.valor
                  ? "border-primary bg-primary/15 font-medium text-foreground"
                  : "border-border text-muted-foreground hover:bg-accent"
              )}
            >
              {opcao.label}
            </button>
          ))}
          <button
            onClick={() => setSoComOs((v) => !v)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm",
              soComOs
                ? "border-primary bg-primary/15 font-medium text-foreground"
                : "border-border text-muted-foreground hover:bg-accent"
            )}
          >
            Só com OS
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, empresa..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 pr-7 h-9 text-sm"
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
            className="w-56 sm:w-64 h-9 bg-background"
            contentClassName="min-w-[320px] max-w-[440px]"
          />
        </div>
      </div>

      {seriesAbertas.size > 0 && (
        <button
          onClick={() => setSeriesAbertas(new Set())}
          className="w-fit text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Recolher parcelas pagas
        </button>
      )}

      {/* Mobile: cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {itensLista.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum lançamento encontrado.
          </p>
        ) : (
          itensLista.map((item) => {
            if (item.tipo === "pagas") {
              return (
                <button
                  key={`pagas-${item.chave}`}
                  onClick={() => abrirSerie(item.chave)}
                  className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-left text-sm transition-colors hover:bg-accent/50"
                >
                  <span className="flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <span>
                      <span className="font-medium">{item.nome}</span>
                      <span className="block text-xs text-muted-foreground">
                        {item.itens.length} parcelas pagas — toque pra ver
                      </span>
                    </span>
                  </span>
                  <span className="font-medium text-muted-foreground">{formatarMoeda(item.total)}</span>
                </button>
              )
            }
            const lancamento = item.lancamento
            const vencido = hoje ? estaLancamentoVencido(lancamento, hoje) : false
            return (
              <button
                key={lancamento.id}
                onClick={() => setSelecionado(lancamento)}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent/50 active:bg-accent"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {lancamento.descricao}
                      {lancamento.pessoal && (
                        <Badge variant="outline" className="ml-2 px-1.5 py-0 text-[10px]">
                          Pessoal
                        </Badge>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">{lancamento.categoria}</p>
                  </div>
                  <Badge
                    variant={lancamento.status === "pago" ? "secondary" : "default"}
                    className="shrink-0"
                  >
                    {lancamento.status === "pago" ? "Pago" : "Pendente"}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-border pt-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Vencimento</p>
                    <p className={cn(vencido && lancamento.status !== "pago" && "font-medium text-destructive")}>
                      {formatarData(lancamento.vencimento)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="truncate">{nomeCliente(lancamento.clienteId)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor</p>
                    <p
                      className={cn(
                        "font-medium",
                        lancamento.tipo === "receita" ? "text-primary" : "text-destructive"
                      )}
                    >
                      {lancamento.tipo === "receita" ? "+" : "−"}{" "}
                      {formatarMoeda(lancamento.valor)}
                    </p>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden rounded-lg border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Forma</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itensLista.map((item) => {
              if (item.tipo === "pagas") {
                return (
                  <TableRow
                    key={`pagas-${item.chave}`}
                    onClick={() => abrirSerie(item.chave)}
                    className="cursor-pointer bg-muted/30"
                  >
                    <TableCell colSpan={5} className="text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4" />
                        <span className="font-medium text-foreground">{item.nome}</span>
                        — {item.itens.length} parcelas pagas (clique pra ver uma por uma)
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatarMoeda(item.total)}</TableCell>
                    <TableCell>
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
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">
                    {lancamento.descricao}
                    {lancamento.pessoal && (
                      <Badge variant="outline" className="ml-2 px-1.5 py-0 text-[10px]">
                        Pessoal
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {nomeCliente(lancamento.clienteId)}
                  </TableCell>
                  <TableCell>{lancamento.categoria}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {lancamento.formaPagamento
                      ? rotuloFormaPagamento[lancamento.formaPagamento]
                      : "—"}
                    {lancamento.numeroBoleto && (
                      <span className="block text-xs">Nº {lancamento.numeroBoleto}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span>{formatarData(lancamento.vencimento)}</span>
                    {vencido && lancamento.status !== "pago" && (
                      <Badge variant="destructive" className="mt-1 block w-fit">
                        Vencido
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell
                    className={
                      lancamento.tipo === "receita" ? "text-primary" : "text-destructive"
                    }
                  >
                    {lancamento.tipo === "receita" ? "+ " : "− "}
                    {formatarMoeda(lancamento.valor)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={lancamento.status === "pago" ? "secondary" : "default"}>
                      {lancamento.status === "pago" ? "Pago" : "Pendente"}
                    </Badge>
                    {lancamento.status === "pago" && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {lancamento.pagoEm
                          ? `Baixado em ${formatarData(lancamento.pagoEm)}`
                          : "Baixa antiga sem data"}
                      </span>
                    )}
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

      {/* Botão novo lançamento mobile */}
      <div className="fixed bottom-6 right-6 md:hidden">
        <LancamentoFormDialog
          trigger={
            <Button size="lg" className="rounded-full shadow-lg">
              <Plus className="h-5 w-5" />
            </Button>
          }
        />
      </div>

      <LancamentoDetalheDialog
        lancamento={selecionado}
        onOpenChange={(open) => !open && setSelecionado(null)}
        hoje={hoje}
      />
    </div>
  )
}
