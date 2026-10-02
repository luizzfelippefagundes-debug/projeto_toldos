"use client"

import { useEffect, useMemo, useState } from "react"
import { useData } from "@/context/data-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { LancamentoFormDialog } from "@/components/financeiro/lancamento-form-dialog"
import { formatarData, formatarMoeda } from "@/lib/format"
import type { StatusLancamento, TipoLancamento } from "@/lib/types"
import { cn } from "@/lib/utils"

const UM_DIA_MS = 24 * 60 * 60 * 1000

const rotuloFormaPagamento: Record<string, string> = {
  boleto: "Boleto",
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  transferencia: "Transferência",
}

export default function FinanceiroPage() {
  const { lancamentos, clientes, marcarLancamentoStatus } = useData()
  const [filtroTipo, setFiltroTipo] = useState<
    TipoLancamento | "todos" | "boleto"
  >("todos")
  const [filtroCliente, setFiltroCliente] = useState("todos")

  // "Boletos a vencer" depende de "hoje" — mesmo cuidado de hydration do
  // resto do app.
  const [hoje, setHoje] = useState<Date | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoje(new Date())
  }, [])

  const resumo = useMemo(() => {
    const aReceber = lancamentos
      .filter((l) => l.tipo === "receita" && l.status === "pendente")
      .reduce((soma, l) => soma + l.valor, 0)
    const aPagar = lancamentos
      .filter((l) => l.tipo === "despesa" && l.status === "pendente")
      .reduce((soma, l) => soma + l.valor, 0)
    const recebido = lancamentos
      .filter((l) => l.tipo === "receita" && l.status === "pago")
      .reduce((soma, l) => soma + l.valor, 0)
    const pago = lancamentos
      .filter((l) => l.tipo === "despesa" && l.status === "pago")
      .reduce((soma, l) => soma + l.valor, 0)
    return { aReceber, aPagar, saldo: recebido - pago }
  }, [lancamentos])

  const boletosAVencer = useMemo(() => {
    if (!hoje) return []
    const limite = new Date(hoje.getTime() + 7 * UM_DIA_MS)
    return lancamentos.filter(
      (l) =>
        l.formaPagamento === "boleto" &&
        l.status === "pendente" &&
        new Date(l.vencimento) <= limite
    )
  }, [lancamentos, hoje])

  const lancamentosFiltrados = lancamentos
    .filter((l) =>
      filtroTipo === "todos"
        ? true
        : filtroTipo === "boleto"
          ? l.formaPagamento === "boleto"
          : l.tipo === filtroTipo
    )
    .filter((l) => filtroCliente === "todos" || l.clienteId === filtroCliente)

  const ordenados = [...lancamentosFiltrados].sort(
    (a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime()
  )

  function nomeCliente(id?: string) {
    if (!id) return "—"
    return clientes.find((c) => c.id === id)?.nome ?? "—"
  }

  function alternarStatus(id: string, statusAtual: StatusLancamento) {
    marcarLancamentoStatus(id, statusAtual === "pago" ? "pendente" : "pago")
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
              A pagar
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-destructive">
            {formatarMoeda(resumo.aPagar)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo (recebido − pago)
            </CardTitle>
          </CardHeader>
          <CardContent
            className={cn(
              "text-3xl font-bold",
              resumo.saldo < 0 && "text-destructive"
            )}
          >
            {formatarMoeda(resumo.saldo)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Boletos a vencer (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent
            className={cn(
              "text-3xl font-bold",
              boletosAVencer.length > 0 && "text-destructive"
            )}
          >
            {hoje ? boletosAVencer.length : "—"}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { valor: "todos", label: "Todos" },
              { valor: "receita", label: "Receitas" },
              { valor: "despesa", label: "Despesas" },
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
        </div>
        <Select value={filtroCliente} onValueChange={(v) => setFiltroCliente(v ?? "todos")}>
          <SelectTrigger className="w-48">
            <SelectValue>
              {(v: string) =>
                v === "todos" ? "Todos os clientes" : nomeCliente(v)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os clientes</SelectItem>
            {clientes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border">
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
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenados.map((lancamento) => (
              <TableRow key={lancamento.id}>
                <TableCell className="font-medium">
                  {lancamento.descricao}
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
                    <span className="block text-xs">
                      Nº {lancamento.numeroBoleto}
                    </span>
                  )}
                </TableCell>
                <TableCell>{formatarData(lancamento.vencimento)}</TableCell>
                <TableCell
                  className={
                    lancamento.tipo === "receita"
                      ? "text-primary"
                      : "text-destructive"
                  }
                >
                  {lancamento.tipo === "receita" ? "+ " : "− "}
                  {formatarMoeda(lancamento.valor)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      lancamento.status === "pago" ? "secondary" : "default"
                    }
                  >
                    {lancamento.status === "pago" ? "Pago" : "Pendente"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      alternarStatus(lancamento.id, lancamento.status)
                    }
                  >
                    {lancamento.status === "pago"
                      ? "Marcar pendente"
                      : "Marcar pago"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {ordenados.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-muted-foreground"
                >
                  Nenhum lançamento encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
