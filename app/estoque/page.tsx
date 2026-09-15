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
import { Badge } from "@/components/ui/badge"
import { NovaEntradaDialog } from "@/components/estoque/nova-entrada-dialog"
import { formatarData } from "@/lib/format"

export default function EstoquePage() {
  const { materiais, entradasEstoque } = useData()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Estoque</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe a quantidade disponível de cada material.
          </p>
        </div>
        <NovaEntradaDialog />
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materiais.map((material) => {
              const baixo = material.quantidadeEstoque < material.estoqueMinimo
              return (
                <TableRow key={material.id}>
                  <TableCell className="font-medium">
                    {material.nome}
                  </TableCell>
                  <TableCell>{material.tipo}</TableCell>
                  <TableCell>
                    {material.quantidadeEstoque}{" "}
                    {material.unidade === "m2" ? "m²" : "un"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={baixo ? "destructive" : "secondary"}>
                      {baixo ? "Estoque baixo" : "OK"}
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Últimas entradas</h2>
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Nota fiscal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entradasEstoque.map((entrada) => {
                const material = materiais.find(
                  (m) => m.id === entrada.materialId
                )
                return (
                  <TableRow key={entrada.id}>
                    <TableCell>{formatarData(entrada.data)}</TableCell>
                    <TableCell>{material?.nome ?? "—"}</TableCell>
                    <TableCell>{entrada.quantidade}</TableCell>
                    <TableCell>{entrada.fornecedor ?? "—"}</TableCell>
                    <TableCell>
                      {entrada.comNotaFiscal
                        ? `Nº ${entrada.numeroNota ?? "—"}`
                        : "Sem nota"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
