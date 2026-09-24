"use client"

import Link from "next/link"
import { useData } from "@/context/data-context"
import { useVendedorAtivo } from "@/context/vendedor-ativo-context"
import { vendedoresSeed } from "@/lib/seed-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatarMoeda } from "@/lib/format"
import { FilePlus2 } from "lucide-react"

export default function PainelVendedorPage() {
  const { pedidosRapidos } = useData()
  const { vendedorId } = useVendedorAtivo()
  const vendedor = vendedoresSeed.find((v) => v.id === vendedorId)

  const meusPedidos = pedidosRapidos.filter((p) => p.vendedorId === vendedorId)
  const fechados = meusPedidos.filter((p) => p.status !== "aguardando")
  const totalVendido = fechados.reduce((soma, p) => soma + p.total, 0)
  const comissao = vendedor
    ? totalVendido * (vendedor.comissaoPercent / 100)
    : 0

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Olá, {vendedor?.nome ?? "—"} 👋</h1>
        <p className="text-sm text-muted-foreground">
          Resumo do que você fechou até agora.
        </p>
      </div>

      <Button size="lg" className="w-full" render={<Link href="/vendedor/novo" />}>
        <FilePlus2 className="mr-2 h-4 w-4" />
        Novo Orçamento
      </Button>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Orçamentos fechados
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {fechados.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total vendido
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {formatarMoeda(totalVendido)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Comissão estimada ({vendedor?.comissaoPercent ?? 0}%)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-bold text-primary">
          {formatarMoeda(comissao)}
        </CardContent>
      </Card>
    </div>
  )
}
