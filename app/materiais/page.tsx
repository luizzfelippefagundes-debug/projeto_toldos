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
import { formatarMoeda } from "@/lib/format"
import { MaterialFormDialog } from "@/components/materiais/material-form-dialog"

export default function MateriaisPage() {
  const { materiais } = useData()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Materiais</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre os materiais usados nos orçamentos e no controle de
            estoque.
          </p>
        </div>
        <MaterialFormDialog />
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead className="w-12" />
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
                    {formatarMoeda(material.precoUnitario)}
                    {material.unidade === "m2" ? " / m²" : " / un"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={baixo ? "destructive" : "secondary"}>
                      {material.quantidadeEstoque}{" "}
                      {material.unidade === "m2" ? "m²" : "un"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <MaterialFormDialog material={material} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
