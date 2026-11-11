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
import { formatarMoeda } from "@/lib/format"
import { MaterialFormDialog } from "@/components/materiais/material-form-dialog"
import { Search } from "lucide-react"

export default function MateriaisPage() {
  const { materiais } = useData()
  const [busca, setBusca] = useState("")

  const materiaisFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return materiais
    return materiais.filter(
      (m) =>
        m.nome.toLowerCase().includes(termo) ||
        m.tipo.toLowerCase().includes(termo)
    )
  }, [materiais, busca])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Materiais</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre os materiais usados nos orçamentos e no controle de
            estoque.
          </p>
        </div>
        <MaterialFormDialog />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar material por nome ou tipo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
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
            {materiaisFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum material encontrado para &quot;{busca}&quot;.
                </TableCell>
              </TableRow>
            ) : (
              materiaisFiltrados.map((material) => {
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
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
