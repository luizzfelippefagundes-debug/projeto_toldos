"use client"

import { useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useData } from "@/context/data-context"
import { formatarData, formatarMoeda } from "@/lib/format"
import { calcularOrcamentoCompleto } from "@/lib/calculo"
import { acabamentosSeed, equipamentosAcessoSeed } from "@/lib/seed-data"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Phone, Mail, FileText, TrendingUp, Clock } from "lucide-react"
import type { StatusOrcamento } from "@/lib/types"

const statusLabel: Record<StatusOrcamento, string> = {
  aberto: "Aberto",
  fechado: "Fechado",
  cancelado: "Cancelado",
}

const statusVariant: Record<StatusOrcamento, "default" | "secondary" | "destructive"> = {
  aberto: "default",
  fechado: "secondary",
  cancelado: "destructive",
}

function totalOrcamento(
  o: ReturnType<typeof useData>["orcamentos"][number],
  materiais: ReturnType<typeof useData>["materiais"],
  servicos: ReturnType<typeof useData>["servicos"]
) {
  if (o.totalFechado !== undefined) return o.totalFechado
  const mat = materiais.find((m) => m.id === o.item.materialId)
  const srv = servicos.find((s) => s.id === o.item.servicoId)
  if (!mat || !srv) return 0
  return calcularOrcamentoCompleto(
    o.item, mat, srv, o.ajusteManual, acabamentosSeed, equipamentosAcessoSeed
  ).total
}

export default function FichaClientePage() {
  const { id } = useParams<{ id: string }>()
  const { clientes, orcamentos, materiais, servicos } = useData()

  const cliente = clientes.find((c) => c.id === id)

  const orcamentosCliente = useMemo(() => {
    return orcamentos
      .filter((o) => o.clienteId === id)
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
  }, [orcamentos, id])

  const stats = useMemo(() => {
    const fechados = orcamentosCliente.filter((o) => o.status === "fechado")
    const faturado = fechados.reduce((acc, o) => acc + totalOrcamento(o, materiais, servicos), 0)
    const ticketMedio = fechados.length > 0 ? faturado / fechados.length : 0
    return { total: orcamentosCliente.length, faturado, ticketMedio, fechados: fechados.length }
  }, [orcamentosCliente, materiais, servicos])

  if (!cliente) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
        <p>Cliente não encontrado.</p>
        <Button variant="outline" nativeButton={false} render={<Link href="/clientes" />}>
          Voltar para Clientes
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/clientes" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{cliente.nome}</h1>
          <p className="text-sm text-muted-foreground">Ficha do cliente</p>
        </div>
      </div>

      {/* Info + Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="col-span-full sm:col-span-2 lg:col-span-1 rounded-lg border border-border bg-card p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Contato
          </p>
          <div className="flex flex-col gap-2">
            {cliente.telefone && (
              <a
                href={`https://wa.me/55${cliente.telefone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm hover:text-primary"
              >
                <Phone className="h-4 w-4 text-muted-foreground" />
                {cliente.telefone}
              </a>
            )}
            {cliente.email && (
              <a
                href={`mailto:${cliente.email}`}
                className="flex items-center gap-2 text-sm hover:text-primary"
              >
                <Mail className="h-4 w-4 text-muted-foreground" />
                {cliente.email}
              </a>
            )}
            {!cliente.telefone && !cliente.email && (
              <p className="text-sm text-muted-foreground">Sem dados de contato.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total de orçamentos
          </p>
          <p className="mt-2 flex items-end gap-1 text-2xl font-bold">
            <FileText className="mb-0.5 h-5 w-5 text-muted-foreground" />
            {stats.total}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{stats.fechados} fechado(s)</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total faturado
          </p>
          <p className="mt-2 flex items-end gap-1 text-2xl font-bold">
            <TrendingUp className="mb-0.5 h-5 w-5 text-muted-foreground" />
            {formatarMoeda(stats.faturado)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">somente fechados</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Ticket médio
          </p>
          <p className="mt-2 flex items-end gap-1 text-2xl font-bold">
            <Clock className="mb-0.5 h-5 w-5 text-muted-foreground" />
            {formatarMoeda(stats.ticketMedio)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">por orçamento fechado</p>
        </div>
      </div>

      {/* Tabela de orçamentos */}
      <div>
        <h2 className="mb-3 text-base font-semibold">Histórico de orçamentos</h2>
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orcamentosCliente.map((o) => {
                const mat = materiais.find((m) => m.id === o.item.materialId)
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">#{o.numero}</TableCell>
                    <TableCell>{formatarData(o.criadoEm)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.materialFechado?.nome ?? mat?.nome ?? "—"}
                    </TableCell>
                    <TableCell>{formatarMoeda(totalOrcamento(o, materiais, servicos))}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[o.status]}>
                        {statusLabel[o.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/orcamentos/${o.id}/os`} />}
                      >
                        OS
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {orcamentosCliente.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhum orçamento encontrado para este cliente.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
