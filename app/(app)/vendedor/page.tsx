"use client"

import Link from "next/link"
import { useData } from "@/context/data-context"
import { useVendedorAtivo } from "@/context/vendedor-ativo-context"
import { vendedoresSeed } from "@/lib/seed-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatarData, formatarMoeda } from "@/lib/format"
import type { StatusPedidoRapido } from "@/lib/types"
import { FilePlus2 } from "lucide-react"

const statusPedido: Record<StatusPedidoRapido, string> = {
  aguardando: "Aguardando",
  aprovado: "Aprovado",
  arte: "Arte",
  impressao: "Impressão",
  acabamento: "Acabamento",
  pronto: "Pronto",
  entregue: "Entregue",
}

export default function PainelVendedorPage() {
  const { pedidosRapidos } = useData()
  const { vendedorId } = useVendedorAtivo()
  const vendedor = vendedoresSeed.find((v) => v.id === vendedorId)

  const meusPedidos = pedidosRapidos.filter((p) => p.vendedorId === vendedorId)
  const fechados = meusPedidos.filter((p) => p.status !== "aguardando")
  const aguardando = meusPedidos.filter((p) => p.status === "aguardando")
  const emAndamento = meusPedidos.filter(
    (p) => p.status !== "aguardando" && p.status !== "entregue",
  )
  const recentes = [...meusPedidos]
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    .slice(0, 5)
  const totalVendido = fechados.reduce((soma, p) => soma + p.total, 0)
  const comissao = vendedor
    ? totalVendido * (vendedor.comissaoPercent / 100)
    : 0

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">
            Olá, {vendedor?.nome ?? "—"} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe seus pedidos, produção e comissão estimada.
          </p>
        </div>

        <Button
          size="lg"
          className="w-full md:w-auto"
          nativeButton={false}
          render={<Link href="/vendedor/novo" />}
        >
          <FilePlus2 className="mr-2 h-4 w-4" />
          Novo Orçamento
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Pedidos fechados
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
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Aguardando aprovação
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {aguardando.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Em andamento
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {emAndamento.length}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-3 md:items-start">
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

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Meus pedidos recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {recentes.map((pedido) => (
              <div
                key={pedido.id}
                className="flex items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    #{pedido.numero} · {pedido.clienteNome || "Sem cliente"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pedido.produtoNome ?? "Produto"} ·{" "}
                    {formatarData(pedido.criadoEm)}
                  </p>
                </div>
                <Badge
                  variant={
                    pedido.status === "entregue" ? "secondary" : "outline"
                  }
                >
                  {statusPedido[pedido.status]}
                </Badge>
              </div>
            ))}
            {recentes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum pedido associado a este vendedor.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
