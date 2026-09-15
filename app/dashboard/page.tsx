"use client"

import Link from "next/link"
import { useData } from "@/context/data-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Check, FilePlus2 } from "lucide-react"
import { cn } from "@/lib/utils"

export default function DashboardPage() {
  const { materiais, servicos, orcamentos } = useData()

  const passos = [
    { label: "Cadastrar materiais", feito: materiais.length > 0 },
    { label: "Cadastrar mão de obra", feito: servicos.length > 0 },
    { label: "Fazer o primeiro orçamento", feito: orcamentos.length > 0 },
  ]
  const concluidos = passos.filter((p) => p.feito).length
  const progresso = Math.round((concluidos / passos.length) * 100)

  const agora = new Date()
  const abertos = orcamentos.filter((o) => o.status === "aberto").length
  const fechadosNoMes = orcamentos.filter(
    (o) =>
      o.status === "fechado" &&
      o.fechadoEm &&
      new Date(o.fechadoEm).getMonth() === agora.getMonth() &&
      new Date(o.fechadoEm).getFullYear() === agora.getFullYear()
  ).length
  const estoqueBaixo = materiais.filter(
    (m) => m.quantidadeEstoque < m.estoqueMinimo
  ).length

  return (
    <div className="flex flex-col gap-6">
      {progresso < 100 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configure seu sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={progresso} className="mb-4" />
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              {passos.map((passo) => (
                <div key={passo.label} className="flex items-center gap-2 text-sm">
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border",
                      passo.feito
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40 text-transparent"
                    )}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  <span
                    className={
                      passo.feito ? "text-foreground" : "text-muted-foreground"
                    }
                  >
                    {passo.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bom dia 👋</h1>
        <Button size="lg" render={<Link href="/orcamentos/novo" />}>
          <FilePlus2 className="mr-2 h-4 w-4" />
          Novo Orçamento
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Orçamentos abertos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{abertos}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fechados no mês
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {fechadosNoMes}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Estoque com alerta baixo
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {estoqueBaixo}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
