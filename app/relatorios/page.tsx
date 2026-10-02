"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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

const UM_DIA_MS = 24 * 60 * 60 * 1000

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

  const dentroPeriodo = useCallback(
    (dataIso: string | null) => {
      if (!dataIso) return false
      const data = new Date(dataIso)
      if (dataDe && data < new Date(dataDe)) return false
      if (dataAte && data > new Date(`${dataAte}T23:59:59`)) return false
      return true
    },
    [dataDe, dataAte]
  )

  const lancamentosPeriodo = useMemo(
    () => lancamentos.filter((l) => dentroPeriodo(l.criadoEm)),
    [lancamentos, dentroPeriodo]
  )

  const entradas = lancamentosPeriodo
    .filter((l) => l.tipo === "receita")
    .reduce((soma, l) => soma + l.valor, 0)
  const custos = lancamentosPeriodo
    .filter((l) => l.tipo === "despesa")
    .reduce((soma, l) => soma + l.valor, 0)

  const aVencerEm7Dias = useMemo(() => {
    if (!hoje) return []
    const limite = new Date(hoje.getTime() + 7 * UM_DIA_MS)
    return lancamentos.filter((l) => {
      if (l.status !== "pendente") return false
      const venc = new Date(l.vencimento)
      return venc <= limite
    })
  }, [lancamentos, hoje])

  const boletosAVencer = aVencerEm7Dias.filter((l) => l.tipo === "despesa")
  const receberAVencer = aVencerEm7Dias.filter((l) => l.tipo === "receita")

  const orcamentosFechadosPeriodo = useMemo(
    () =>
      orcamentos.filter(
        (o) => o.status === "fechado" && dentroPeriodo(o.fechadoEm)
      ),
    [orcamentos, dentroPeriodo]
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
      if (!material) continue
      const quantidade = quantidadeMaterialConsumida(orcamento.item, material)
      const custo = quantidade * material.precoUnitario
      const atual = porMaterial.get(material.id)
      if (atual) {
        atual.quantidade += quantidade
        atual.custo += custo
      } else {
        porMaterial.set(material.id, {
          nome: material.nome,
          unidade: material.unidade === "m2" ? "m²" : "un",
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Entrando no período
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-primary">
            {formatarMoeda(entradas)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Custos no período
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-destructive">
            {formatarMoeda(custos)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              A receber em 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {hoje ? receberAVencer.length : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Boletos a vencer em 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent
            className={cn(
              "text-3xl font-bold",
              boletosAVencer.length > 0 && "text-destructive"
            )}
          >
            {hoje ? boletosAVencer.length : "—"}
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
