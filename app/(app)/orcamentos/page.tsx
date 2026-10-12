"use client"

import { useMemo, useState } from "react"
import { useData } from "@/context/data-context"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { OrcamentoDetalheDialog } from "@/components/orcamentos/orcamento-detalhe-dialog"
import { formatarData, formatarMoeda } from "@/lib/format"
import { calcularOrcamentoCompleto } from "@/lib/calculo"
import { acabamentosSeed, equipamentosAcessoSeed } from "@/lib/seed-data"
import type { StatusOrcamento } from "@/lib/types"

const statusLabel: Record<StatusOrcamento, string> = {
  aberto: "Aberto",
  fechado: "Fechado",
  cancelado: "Cancelado",
}

const statusVariant: Record<
  StatusOrcamento,
  "default" | "secondary" | "destructive"
> = {
  aberto: "default",
  fechado: "secondary",
  cancelado: "destructive",
}

export default function HistoricoOrcamentosPage() {
  const { orcamentos, clientes, materiais, servicos } = useData()

  const [clienteId, setClienteId] = useState<string>("todos")
  const [dataDe, setDataDe] = useState("")
  const [dataAte, setDataAte] = useState("")
  const [detalheId, setDetalheId] = useState<string | null>(null)

  const orcamentosFiltrados = useMemo(() => {
    return orcamentos.filter((orcamento) => {
      if (clienteId !== "todos" && orcamento.clienteId !== clienteId)
        return false
      const criado = new Date(orcamento.criadoEm)
      if (dataDe && criado < new Date(dataDe)) return false
      if (dataAte && criado > new Date(`${dataAte}T23:59:59`)) return false
      return true
    })
  }, [orcamentos, clienteId, dataDe, dataAte])

  function nomeCliente(id: string) {
    return clientes.find((c) => c.id === id)?.nome ?? "Cliente removido"
  }

  function validoAte(orcamento: (typeof orcamentos)[number]) {
    const dias = orcamento.validadeDias ?? 7
    const data = new Date(orcamento.criadoEm)
    data.setDate(data.getDate() + dias)
    return data.toISOString()
  }

  function totalOrcamento(orcamentoId: string) {
    const orcamento = orcamentos.find((o) => o.id === orcamentoId)
    if (!orcamento) return 0
    if (orcamento.totalFechado !== undefined) return orcamento.totalFechado
    const material = materiais.find((m) => m.id === orcamento.item.materialId)
    const servico = servicos.find((s) => s.id === orcamento.item.servicoId)
    if (!material) return 0
    return calcularOrcamentoCompleto(
      orcamento.item,
      material,
      servico ?? null,
      orcamento.ajusteManual,
      acabamentosSeed,
      equipamentosAcessoSeed
    ).total
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Histórico de Orçamentos</h1>
        <p className="text-sm text-muted-foreground">
          Clique em um orçamento para ver os detalhes, reabrir ou duplicar.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Cliente</span>
          <Select
            value={clienteId}
            onValueChange={(v) => setClienteId(v ?? "todos")}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue>
                {(v: string) =>
                  v === "todos" ? "Todos os clientes" : clientes.find((c) => c.id === v)?.nome
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
        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-2 sm:flex-none">
            <span className="text-xs text-muted-foreground">De</span>
            <Input
              type="date"
              value={dataDe}
              onChange={(e) => setDataDe(e.target.value)}
              className="w-full sm:w-40"
            />
          </div>
          <div className="flex flex-1 flex-col gap-2 sm:flex-none">
            <span className="text-xs text-muted-foreground">Até</span>
            <Input
              type="date"
              value={dataAte}
              onChange={(e) => setDataAte(e.target.value)}
              className="w-full sm:w-40"
            />
          </div>
        </div>
      </div>

      {/* Celular: lista de cartões */}
      <div className="flex flex-col gap-2 md:hidden">
        {orcamentosFiltrados.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum orçamento encontrado para esse filtro.
          </p>
        ) : (
          orcamentosFiltrados.map((orcamento) => (
            <button
              key={orcamento.id}
              onClick={() => setDetalheId(orcamento.id)}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent/50 active:bg-accent"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">#{orcamento.numero}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {nomeCliente(orcamento.clienteId)}
                  </p>
                </div>
                <Badge variant={statusVariant[orcamento.status]} className="shrink-0">
                  {statusLabel[orcamento.status]}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-border pt-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p>{formatarData(orcamento.criadoEm)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Válido até</p>
                  <p>{formatarData(validoAte(orcamento))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-medium">{formatarMoeda(totalOrcamento(orcamento.id))}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Computador: tabela */}
      <div className="hidden rounded-lg border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Válido até</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orcamentosFiltrados.map((orcamento) => (
              <TableRow
                key={orcamento.id}
                onClick={() => setDetalheId(orcamento.id)}
                className="cursor-pointer"
              >
                <TableCell className="font-medium">
                  #{orcamento.numero}
                </TableCell>
                <TableCell>{nomeCliente(orcamento.clienteId)}</TableCell>
                <TableCell>{formatarData(orcamento.criadoEm)}</TableCell>
                <TableCell>{formatarData(validoAte(orcamento))}</TableCell>
                <TableCell>
                  {formatarMoeda(totalOrcamento(orcamento.id))}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[orcamento.status]}>
                    {statusLabel[orcamento.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {orcamentosFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nenhum orçamento encontrado para esse filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <OrcamentoDetalheDialog
        orcamentoId={detalheId}
        onOpenChange={(open) => !open && setDetalheId(null)}
      />
    </div>
  )
}
