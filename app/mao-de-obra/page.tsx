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
import { ServicoFormDialog } from "@/components/mao-de-obra/servico-form-dialog"
import type { FormaCobranca } from "@/lib/types"

const rotulos: Record<FormaCobranca, string> = {
  fixo: "Valor fixo",
  hora: "Por hora",
  m2: "Por m²",
  percentual: "% sobre material",
}

function formatarValor(formaCobranca: FormaCobranca, valor: number) {
  if (formaCobranca === "percentual") return `${valor}%`
  const base = formatarMoeda(valor)
  if (formaCobranca === "hora") return `${base} / hora`
  if (formaCobranca === "m2") return `${base} / m²`
  return base
}

export default function MaoDeObraPage() {
  const { servicos } = useData()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mão de Obra</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre os tipos de serviço e como cada um é cobrado.
          </p>
        </div>
        <ServicoFormDialog />
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serviço</TableHead>
              <TableHead>Forma de cobrança</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {servicos.map((servico) => (
              <TableRow key={servico.id}>
                <TableCell className="font-medium">{servico.nome}</TableCell>
                <TableCell>{rotulos[servico.formaCobranca]}</TableCell>
                <TableCell>
                  {formatarValor(servico.formaCobranca, servico.valor)}
                </TableCell>
                <TableCell>
                  <ServicoFormDialog servico={servico} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
