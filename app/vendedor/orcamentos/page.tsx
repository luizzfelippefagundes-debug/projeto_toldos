"use client"

import { useData } from "@/context/data-context"
import { useVendedorAtivo } from "@/context/vendedor-ativo-context"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatarData, formatarMoeda } from "@/lib/format"
import type { StatusPedidoRapido } from "@/lib/types"

const statusLabel: Record<StatusPedidoRapido, string> = {
  aguardando: "Aguardando",
  aprovado: "Aprovado",
  arte: "Arte",
  impressao: "Impressão",
  acabamento: "Acabamento",
  pronto: "Pronto",
  entregue: "Entregue",
}

const statusVariant: Record<
  StatusPedidoRapido,
  "default" | "secondary" | "destructive"
> = {
  aguardando: "default",
  aprovado: "secondary",
  arte: "secondary",
  impressao: "secondary",
  acabamento: "secondary",
  pronto: "secondary",
  entregue: "secondary",
}

export default function MeusOrcamentosPage() {
  const { pedidosRapidos, produtosRapidos } = useData()
  const { vendedorId } = useVendedorAtivo()

  const meusPedidos = pedidosRapidos
    .filter((p) => p.vendedorId === vendedorId)
    .sort(
      (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
    )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Meus Orçamentos</h1>
        <p className="text-sm text-muted-foreground">
          {meusPedidos.length}{" "}
          {meusPedidos.length === 1 ? "orçamento" : "orçamentos"}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {meusPedidos.map((pedido) => {
          const produto = produtosRapidos.find((p) => p.id === pedido.produtoId)
          return (
            <Card key={pedido.id}>
              <CardContent className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">#{pedido.numero}</span>
                  <Badge variant={statusVariant[pedido.status]}>
                    {statusLabel[pedido.status]}
                  </Badge>
                </div>
                <p className="font-medium">
                  {produto?.nome ?? "Produto removido"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pedido.clienteNome || "Sem cliente"} ·{" "}
                  {formatarData(pedido.criadoEm)}
                </p>
                <p className="text-base font-semibold text-primary">
                  {formatarMoeda(pedido.total)}
                </p>
              </CardContent>
            </Card>
          )
        })}
        {meusPedidos.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum orçamento seu ainda.
          </p>
        )}
      </div>
    </div>
  )
}
