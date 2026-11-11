"use client"

import { useData } from "@/context/data-context"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatarMoeda } from "@/lib/format"
import { AcabamentoFormDialog } from "@/components/acabamentos/acabamento-form-dialog"

export default function AcabamentosPage() {
  const { acabamentos } = useData()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Acabamentos</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os acabamentos disponíveis nos orçamentos.
          </p>
        </div>
        <AcabamentoFormDialog />
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Preço unitário</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {acabamentos.map((acabamento) => (
              <TableRow key={acabamento.id}>
                <TableCell className="font-medium">{acabamento.nome}</TableCell>
                <TableCell>{formatarMoeda(acabamento.precoUnitario)}</TableCell>
                <TableCell>{acabamento.unidade}</TableCell>
                <TableCell>
                  <AcabamentoFormDialog acabamento={acabamento} />
                </TableCell>
              </TableRow>
            ))}
            {acabamentos.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  Nenhum acabamento cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
