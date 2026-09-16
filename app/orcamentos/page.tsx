"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatarData, formatarMoeda } from "@/lib/format"
import { calcularOrcamentoCompleto } from "@/lib/calculo"
import { acabamentosSeed, equipamentosAcessoSeed } from "@/lib/seed-data"
import type { StatusOrcamento } from "@/lib/types"
import { MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

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
  const {
    orcamentos,
    clientes,
    materiais,
    servicos,
    reabrirOrcamento,
    duplicarOrcamento,
  } = useData()
  const router = useRouter()

  const [clienteId, setClienteId] = useState<string>("todos")
  const [dataDe, setDataDe] = useState("")
  const [dataAte, setDataAte] = useState("")

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
    const material = materiais.find((m) => m.id === orcamento.item.materialId)
    const servico = servicos.find((s) => s.id === orcamento.item.servicoId)
    if (!material || !servico) return 0
    return calcularOrcamentoCompleto(
      orcamento.item,
      material,
      servico,
      orcamento.ajusteManual,
      acabamentosSeed,
      equipamentosAcessoSeed
    ).total
  }

  function handleReabrir(id: string) {
    reabrirOrcamento(id)
    toast.success("Orçamento reaberto")
  }

  function handleDuplicar(id: string) {
    duplicarOrcamento(id)
    router.push("/orcamentos/novo")
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Histórico de Orçamentos</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe, reabra ou duplique orçamentos anteriores.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Cliente</span>
          <Select
            value={clienteId}
            onValueChange={(v) => setClienteId(v ?? "todos")}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
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
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">De</span>
          <Input
            type="date"
            value={dataDe}
            onChange={(e) => setDataDe(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Até</span>
          <Input
            type="date"
            value={dataAte}
            onChange={(e) => setDataAte(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Válido até</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orcamentosFiltrados.map((orcamento) => (
              <TableRow key={orcamento.id}>
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
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon" />}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleDuplicar(orcamento.id)}
                      >
                        Duplicar
                      </DropdownMenuItem>
                      {orcamento.status !== "aberto" && (
                        <DropdownMenuItem
                          onClick={() => handleReabrir(orcamento.id)}
                        >
                          Reabrir
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {orcamentosFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nenhum orçamento encontrado para esse filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
