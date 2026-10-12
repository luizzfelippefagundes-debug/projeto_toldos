"use client"

import { useParams, useRouter } from "next/navigation"
import { useData } from "@/context/data-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { OrcamentoDetalhes } from "@/components/orcamentos/orcamento-detalhes"
import { formatarData } from "@/lib/format"
import { ArrowLeft, Printer } from "lucide-react"

export default function OrdemDeServicoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { orcamentos } = useData()

  const orcamento = orcamentos.find((o) => o.id === id)

  if (!orcamento) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Orçamento não encontrado.
        </p>
        <Button variant="outline" className="self-start" onClick={() => router.push("/orcamentos")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao histórico
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" onClick={() => router.push("/orcamentos")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimir OS
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="text-lg font-semibold">
              Ordem de Serviço — #{orcamento.numero}
            </p>
            <p className="text-sm text-muted-foreground">
              Toldos Print · Gerada em {formatarData(new Date().toISOString())}
            </p>
          </div>
          <OrcamentoDetalhes orcamento={orcamento} />
        </CardContent>
      </Card>
    </div>
  )
}
