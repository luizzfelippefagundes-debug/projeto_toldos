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
import {
  estaLancamentoVencido,
  resumirFinanceiro,
} from "@/lib/financeiro"
import type { StatusLancamento, TipoLancamento } from "@/lib/types"
import { cn } from "@/lib/utils"
import { MessageCircle } from "lucide-react"
import { toast } from "sonner"

const rotuloFormaPagamento: Record<string, string> = {
  boleto: "Boleto",
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  transferencia: "Transferência",
}

export default function FinanceiroPage() {
  const { lancamentos, clientes, marcarLancamentoStatus, addMensagemBot } =
    useData()
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

  const resumo = useMemo(
    () => resumirFinanceiro(lancamentos, hoje ?? new Date(0)),
    [lancamentos, hoje]
  )

  const saldo = resumo.recebido - resumo.pago

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

  function mandarLembrete(lancamento: (typeof lancamentos)[number]) {
    const cliente = clientes.find((c) => c.id === lancamento.clienteId)
    if (!cliente) return
    addMensagemBot({
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      telefone: cliente.telefone,
      texto: `Lembrete: "${lancamento.descricao}" no valor de ${formatarMoeda(lancamento.valor)} ${estaLancamentoVencido(lancamento, hoje ?? new Date()) ? "venceu em" : "vence em"} ${formatarData(lancamento.vencimento)}.`,
      origem: "lembrete",
      autor: "bot",
    })
    toast.success(`Lembrete registrado pra ${cliente.nome}`)
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
      </div>
      <p className="text-xs text-muted-foreground">
        Valores recebidos e pagos consideram a data da baixa. Registros antigos
        sem data de baixa usam a data de criação do lançamento.
      </p>

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
              <TableHead className="w-48" />
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
                <TableCell>
                  <span>{formatarData(lancamento.vencimento)}</span>
                  {hoje && estaLancamentoVencido(lancamento, hoje) && (
                    <Badge variant="destructive" className="mt-1 block w-fit">
                      Vencido
                    </Badge>
                  )}
                </TableCell>
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
                  {lancamento.status === "pago" && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {lancamento.pagoEm
                        ? `Baixado em ${formatarData(lancamento.pagoEm)}`
                        : "Baixa antiga sem data"}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {lancamento.status === "pendente" &&
                      lancamento.clienteId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => mandarLembrete(lancamento)}
                        >
                          <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                          Lembrete
                        </Button>
                      )}
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
                  </div>
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
