"use client"

import { useEffect, useMemo, useState } from "react"
import { useData } from "@/context/data-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { quantidadeMaterialConsumida } from "@/lib/calculo"
import { formatarMoeda } from "@/lib/format"
import { cn } from "@/lib/utils"
import { resumirFinanceiro } from "@/lib/financeiro"

export default function RelatoriosPage() {
  const { orcamentos, materiais, lancamentos } = useData()
  const [dataDe, setDataDe] = useState("")
  const [dataAte, setDataAte] = useState("")

  // "Próximos 7 dias" depende de "hoje" — mesmo cuidado de hydration do
  // resto do app (ver dashboard/page.tsx): começa nulo e só calcula depois
  // de montar, pra não travar a data de build numa página pré-renderizada.
  const [hoje, setHoje] = useState<Date | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoje(new Date())
  }, [])

  const resumo = useMemo(
    () =>
      resumirFinanceiro(lancamentos, hoje ?? new Date(0), dataDe, dataAte),
    [lancamentos, hoje, dataDe, dataAte]
  )

  const orcamentosFechadosPeriodo = useMemo(
    () =>
      orcamentos.filter(
        (o) => {
          if (o.status !== "fechado" || !o.fechadoEm) return false
          const data = new Date(o.fechadoEm)
          if (!Number.isFinite(data.getTime())) return false
          if (dataDe && data < new Date(`${dataDe}T00:00:00`)) return false
          if (dataAte && data > new Date(`${dataAte}T23:59:59.999`))
            return false
          return true
        }
      ),
    [orcamentos, dataDe, dataAte]
  )

  const usoMaterial = useMemo(() => {
    const porMaterial = new Map<
      string,
      { nome: string; unidade: string; quantidade: number; custo: number }
    >()
    for (const orcamento of orcamentosFechadosPeriodo) {
      const material = materiais.find(
        (m) => m.id === orcamento.item.materialId
      )
      const snapshot = orcamento.materialFechado
      if (!snapshot && !material) continue
      const id = snapshot?.id ?? material!.id
      const nome = snapshot?.nome ?? material!.nome
      const unidade =
        snapshot?.unidade ?? material!.unidade
      const quantidade =
        snapshot?.quantidade ??
        quantidadeMaterialConsumida(orcamento.item, material!)
      const custo = snapshot?.custo ?? quantidade * material!.precoUnitario
      const atual = porMaterial.get(id)
      if (atual) {
        atual.quantidade += quantidade
        atual.custo += custo
      } else {
        porMaterial.set(id, {
          nome,
          unidade: unidade === "m2" ? "m²" : "un",
          quantidade,
          custo,
        })
      }
    }
    return Array.from(porMaterial.values()).sort((a, b) => b.custo - a.custo)
  }, [orcamentosFechadosPeriodo, materiais])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          O que está entrando, o que foi custo, e quanto de cada material foi
          usado.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">De</Label>
          <Input
            type="date"
            value={dataDe}
            onChange={(e) => setDataDe(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">Até</Label>
          <Input
            type="date"
            value={dataAte}
            onChange={(e) => setDataAte(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        O período considera a data de recebimento/pagamento para lançamentos
        baixados e o vencimento para contas ainda em aberto. Baixas antigas sem
        data registrada usam a data de criação.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recebido no período
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-primary">
            {formatarMoeda(resumo.recebido)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pago no período
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-destructive">
            {formatarMoeda(resumo.pago)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Em aberto a receber
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-primary">
            {formatarMoeda(resumo.aReceber)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Em aberto a pagar
            </CardTitle>
          </CardHeader>
          <CardContent
            className="text-3xl font-bold text-destructive"
          >
            {formatarMoeda(resumo.aPagar)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vencido a receber
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-destructive">
            {formatarMoeda(resumo.vencidoAReceber)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vencido a pagar
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-destructive">
            {formatarMoeda(resumo.vencidoAPagar)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recebimentos em 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {hoje ? resumo.recebiveisVencendo7Dias : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Boletos em 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent className={cn("text-3xl font-bold", resumo.boletosVencendo7Dias > 0 && "text-destructive")}>
            {hoje ? resumo.boletosVencendo7Dias : "—"}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Uso de material no período</h2>
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Quantidade usada</TableHead>
                <TableHead>Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usoMaterial.map((item) => (
                <TableRow key={item.nome}>
                  <TableCell className="font-medium">{item.nome}</TableCell>
                  <TableCell>
                    {item.quantidade.toFixed(2)} {item.unidade}
                  </TableCell>
                  <TableCell>{formatarMoeda(item.custo)}</TableCell>
                </TableRow>
              ))}
              {usoMaterial.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Nenhum orçamento fechado nesse período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
