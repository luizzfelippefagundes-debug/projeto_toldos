"use client"

import { useEffect, useMemo, useState } from "react"
import { useData } from "@/context/data-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { formatarMoeda, formatarData } from "@/lib/format"
import { cn } from "@/lib/utils"
import { resumirFinanceiro } from "@/lib/financeiro"
import { FileSpreadsheet, Printer, TrendingUp, TrendingDown, Clock, Package, FileText, Layers } from "lucide-react"

function atalhosDePeriodo() {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth()

  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const inicioMes = new Date(ano, mes, 1)
  const fimMes = new Date(ano, mes + 1, 0)
  const inicioMesPassado = new Date(ano, mes - 1, 1)
  const fimMesPassado = new Date(ano, mes, 0)
  const inicioAno = new Date(ano, 0, 1)
  const inicioSemana = new Date(hoje)
  inicioSemana.setDate(hoje.getDate() - hoje.getDay())

  return [
    { label: "Esta semana", de: fmt(inicioSemana), ate: fmt(hoje) },
    { label: "Este mês", de: fmt(inicioMes), ate: fmt(fimMes) },
    { label: "Mês passado", de: fmt(inicioMesPassado), ate: fmt(fimMesPassado) },
    { label: "Este ano", de: fmt(inicioAno), ate: fmt(hoje) },
    { label: "Tudo", de: "", ate: "" },
  ]
}

export default function RelatoriosPage() {
  const { orcamentos, materiais, lancamentos, pedidosRapidos, clientes } = useData()
  const [dataDe, setDataDe] = useState("")
  const [dataAte, setDataAte] = useState("")
  const [hoje, setHoje] = useState<Date | null>(null)
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoje(new Date())
    const { de, ate } = atalhosDePeriodo()[1] // este mês por padrão
    setDataDe(de)
    setDataAte(ate)
  }, [])

  const resumo = useMemo(
    () => resumirFinanceiro(lancamentos, hoje ?? new Date(0), dataDe, dataAte),
    [lancamentos, hoje, dataDe, dataAte]
  )

  const orcamentosPeriodo = useMemo(() => {
    return orcamentos.filter((o) => {
      if (o.status !== "fechado" || !o.fechadoEm) return false
      if (dataDe && o.fechadoEm < `${dataDe}T00:00:00`) return false
      if (dataAte && o.fechadoEm > `${dataAte}T23:59:59`) return false
      return true
    }).sort((a, b) => new Date(b.fechadoEm!).getTime() - new Date(a.fechadoEm!).getTime())
  }, [orcamentos, dataDe, dataAte])

  const pedidosPeriodo = useMemo(() => {
    return pedidosRapidos.filter((p) => {
      if (!["pronto", "entregue"].includes(p.status)) return false
      if (dataDe && p.criadoEm < `${dataDe}T00:00:00`) return false
      if (dataAte && p.criadoEm > `${dataAte}T23:59:59`) return false
      return true
    }).sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
  }, [pedidosRapidos, dataDe, dataAte])

  const lancamentosPeriodo = useMemo(() => {
    return lancamentos.filter((l) => {
      const dataRef = l.status === "pago" ? (l.pagoEm ?? l.criadoEm) : l.vencimento
      if (dataDe && dataRef < `${dataDe}T00:00:00`) return false
      if (dataAte && dataRef > `${dataAte}T23:59:59`) return false
      return true
    }).sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  }, [lancamentos, dataDe, dataAte])

  const usoMaterial = useMemo(() => {
    const porMaterial = new Map<string, { nome: string; unidade: string; quantidade: number; custo: number }>()
    for (const o of orcamentosPeriodo) {
      const mat = materiais.find((m) => m.id === o.item.materialId)
      const snap = o.materialFechado
      if (!snap && !mat) continue
      const id = snap?.id ?? mat!.id
      const nome = snap?.nome ?? mat!.nome
      const unidade = snap?.unidade ?? mat!.unidade
      const qtd = snap?.quantidade ?? quantidadeMaterialConsumida(o.item, mat!)
      const custo = snap?.custo ?? qtd * mat!.precoUnitario
      const atual = porMaterial.get(id)
      if (atual) { atual.quantidade += qtd; atual.custo += custo }
      else porMaterial.set(id, { nome, unidade: unidade === "m2" ? "m²" : "un", quantidade: qtd, custo })
    }
    return Array.from(porMaterial.values()).sort((a, b) => b.custo - a.custo)
  }, [orcamentosPeriodo, materiais])

  const totalOrcamentos = orcamentosPeriodo.reduce((s, o) => s + (o.totalFechado ?? 0), 0)
  const totalPedidos = pedidosPeriodo.reduce((s, p) => s + p.total, 0)
  const saldo = resumo.recebido - resumo.pago

  function nomeCliente(id?: string) {
    return clientes.find((c) => c.id === id)?.nome ?? "—"
  }

  async function exportarExcel() {
    setExportando(true)
    try {
      const { utils, writeFile } = await import("xlsx")
      const periodo = dataDe || dataAte
        ? `${dataDe || "início"} a ${dataAte || "hoje"}`
        : "Todos os períodos"

      const abaResumo = [
        ["Relatório — Toldos Print"],
        ["Período:", periodo],
        ["Gerado em:", new Date().toLocaleString("pt-BR")],
        [],
        ["RESUMO FINANCEIRO", ""],
        ["Recebido no período", resumo.recebido],
        ["Pago no período", resumo.pago],
        ["Saldo (recebido − pago)", saldo],
        ["Em aberto a receber", resumo.aReceber],
        ["Em aberto a pagar", resumo.aPagar],
        ["Vencido a receber", resumo.vencidoAReceber],
        ["Vencido a pagar", resumo.vencidoAPagar],
        [],
        ["ORÇAMENTOS FECHADOS", ""],
        ["Quantidade", orcamentosPeriodo.length],
        ["Valor total", totalOrcamentos],
        [],
        ["PEDIDOS (PRONTOS + ENTREGUES)", ""],
        ["Quantidade", pedidosPeriodo.length],
        ["Valor total", totalPedidos],
      ]

      const abaOrcamentos = [
        ["Nº", "Cliente", "Data Fechamento", "Total (R$)", "Status"],
        ...orcamentosPeriodo.map((o) => [
          `#${o.numero}`,
          nomeCliente(o.clienteId),
          o.fechadoEm ? formatarData(o.fechadoEm) : "",
          o.totalFechado ?? 0,
          "Fechado",
        ]),
      ]

      const abaPedidos = [
        ["Nº", "Cliente", "Produto", "Variante", "Data", "Total (R$)", "Status"],
        ...pedidosPeriodo.map((p) => [
          `#${p.numero}`,
          p.clienteNome || "—",
          p.produtoNome ?? "—",
          p.varianteNome ?? "—",
          formatarData(p.criadoEm),
          p.total,
          p.status === "entregue" ? "Entregue" : "Pronto",
        ]),
      ]

      const abaLancamentos = [
        ["Descrição", "Tipo", "Categoria", "Valor (R$)", "Vencimento", "Status", "Forma Pgto", "Cliente"],
        ...lancamentosPeriodo.map((l) => [
          l.descricao,
          l.tipo === "receita" ? "Receita" : "Despesa",
          l.categoria,
          l.valor,
          formatarData(l.vencimento),
          l.status === "pago" ? "Pago" : "Pendente",
          l.formaPagamento ?? "",
          nomeCliente(l.clienteId),
        ]),
      ]

      const abaMateriais = [
        ["Material", "Quantidade", "Unidade", "Custo (R$)"],
        ...usoMaterial.map((m) => [m.nome, m.quantidade.toFixed(2), m.unidade, m.custo]),
      ]

      const wb = utils.book_new()
      utils.book_append_sheet(wb, utils.aoa_to_sheet(abaResumo), "Resumo")
      utils.book_append_sheet(wb, utils.aoa_to_sheet(abaOrcamentos), "Orçamentos")
      utils.book_append_sheet(wb, utils.aoa_to_sheet(abaPedidos), "Pedidos")
      utils.book_append_sheet(wb, utils.aoa_to_sheet(abaLancamentos), "Lançamentos")
      utils.book_append_sheet(wb, utils.aoa_to_sheet(abaMateriais), "Uso de Material")

      const nome = `relatorio-${dataDe || "inicio"}-${dataAte || "hoje"}.xlsx`
      writeFile(wb, nome)
    } finally {
      setExportando(false)
    }
  }

  const atalhos = atalhosDePeriodo()

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Visão completa do período — financeiro, orçamentos, pedidos e materiais.
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / PDF
          </Button>
          <Button size="sm" onClick={exportarExcel} disabled={exportando}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {exportando ? "Gerando..." : "Exportar Excel"}
          </Button>
        </div>
      </div>

      {/* Filtro de período */}
      <div className="flex flex-col gap-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          {atalhos.map((a) => (
            <button
              key={a.label}
              onClick={() => { setDataDe(a.de); setDataAte(a.ate) }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                dataDe === a.de && dataAte === a.ate
                  ? "border-primary bg-primary/15 font-medium text-foreground"
                  : "border-border text-muted-foreground hover:bg-accent"
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} className="w-40" />
          </div>
        </div>
      </div>

      {/* Período exibido na impressão */}
      <p className="hidden text-sm text-muted-foreground print:block">
        Período: {dataDe ? formatarData(`${dataDe}T00:00:00`) : "início"} até {dataAte ? formatarData(`${dataAte}T00:00:00`) : "hoje"} — gerado em {new Date().toLocaleString("pt-BR")}
      </p>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            Recebido
          </div>
          <p className="text-2xl font-bold text-primary">{formatarMoeda(resumo.recebido)}</p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5 text-destructive" />
            Pago
          </div>
          <p className="text-2xl font-bold text-destructive">{formatarMoeda(resumo.pago)}</p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Saldo período
          </div>
          <p className={cn("text-2xl font-bold", saldo < 0 ? "text-destructive" : "text-primary")}>
            {formatarMoeda(saldo)}
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-orange-500" />
            Vencido a receber
          </div>
          <p className={cn("text-2xl font-bold", resumo.vencidoAReceber > 0 ? "text-destructive" : "")}>
            {formatarMoeda(resumo.vencidoAReceber)}
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5 text-blue-500" />
            Orçamentos fechados
          </div>
          <p className="text-2xl font-bold">{orcamentosPeriodo.length}</p>
          <p className="text-xs text-muted-foreground">{formatarMoeda(totalOrcamentos)}</p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Package className="h-3.5 w-3.5 text-violet-500" />
            Pedidos concluídos
          </div>
          <p className="text-2xl font-bold">{pedidosPeriodo.length}</p>
          <p className="text-xs text-muted-foreground">{formatarMoeda(totalPedidos)}</p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            A receber
          </div>
          <p className="text-2xl font-bold text-primary">{formatarMoeda(resumo.aReceber)}</p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            Custo materiais
          </div>
          <p className="text-2xl font-bold">
            {formatarMoeda(usoMaterial.reduce((s, m) => s + m.custo, 0))}
          </p>
        </div>
      </div>

      {/* Orçamentos fechados */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FileText className="h-5 w-5 text-blue-500" />
          Orçamentos fechados no período
          <Badge variant="secondary">{orcamentosPeriodo.length}</Badge>
        </h2>
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data fechamento</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orcamentosPeriodo.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">#{o.numero}</TableCell>
                  <TableCell>{nomeCliente(o.clienteId)}</TableCell>
                  <TableCell>{o.fechadoEm ? formatarData(o.fechadoEm) : "—"}</TableCell>
                  <TableCell className="text-right font-medium text-primary">
                    {formatarMoeda(o.totalFechado ?? 0)}
                  </TableCell>
                </TableRow>
              ))}
              {orcamentosPeriodo.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Nenhum orçamento fechado nesse período.
                  </TableCell>
                </TableRow>
              )}
              {orcamentosPeriodo.length > 0 && (
                <TableRow className="font-semibold">
                  <TableCell colSpan={3} className="text-right text-muted-foreground">Total</TableCell>
                  <TableCell className="text-right text-primary">{formatarMoeda(totalOrcamentos)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Pedidos concluídos */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Package className="h-5 w-5 text-violet-500" />
          Pedidos (prontos/entregues) no período
          <Badge variant="secondary">{pedidosPeriodo.length}</Badge>
        </h2>
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidosPeriodo.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">#{p.numero}</TableCell>
                  <TableCell>{p.clienteNome || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.produtoNome ?? "—"}
                    {p.varianteNome ? ` · ${p.varianteNome}` : ""}
                  </TableCell>
                  <TableCell>{formatarData(p.criadoEm)}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "entregue" ? "secondary" : "default"}>
                      {p.status === "entregue" ? "Entregue" : "Pronto"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium text-primary">
                    {formatarMoeda(p.total)}
                  </TableCell>
                </TableRow>
              ))}
              {pedidosPeriodo.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhum pedido concluído nesse período.
                  </TableCell>
                </TableRow>
              )}
              {pedidosPeriodo.length > 0 && (
                <TableRow className="font-semibold">
                  <TableCell colSpan={5} className="text-right text-muted-foreground">Total</TableCell>
                  <TableCell className="text-right text-primary">{formatarMoeda(totalPedidos)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Lançamentos financeiros */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <TrendingUp className="h-5 w-5 text-emerald-500" />
          Lançamentos financeiros no período
          <Badge variant="secondary">{lancamentosPeriodo.length}</Badge>
        </h2>
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lancamentosPeriodo.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.descricao}</TableCell>
                  <TableCell className="text-muted-foreground">{l.categoria}</TableCell>
                  <TableCell>{formatarData(l.vencimento)}</TableCell>
                  <TableCell>
                    <Badge variant={l.status === "pago" ? "secondary" : "default"}>
                      {l.status === "pago" ? "Pago" : "Pendente"}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn("text-right font-medium", l.tipo === "receita" ? "text-primary" : "text-destructive")}>
                    {l.tipo === "receita" ? "+" : "−"} {formatarMoeda(l.valor)}
                  </TableCell>
                </TableRow>
              ))}
              {lancamentosPeriodo.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhum lançamento nesse período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Uso de material */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Layers className="h-5 w-5 text-orange-500" />
          Uso de materiais no período
          <Badge variant="secondary">{usoMaterial.length}</Badge>
        </h2>
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usoMaterial.map((item) => (
                <TableRow key={item.nome}>
                  <TableCell className="font-medium">{item.nome}</TableCell>
                  <TableCell>{item.quantidade.toFixed(2)} {item.unidade}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(item.custo)}</TableCell>
                </TableRow>
              ))}
              {usoMaterial.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    Nenhum uso de material nesse período.
                  </TableCell>
                </TableRow>
              )}
              {usoMaterial.length > 0 && (
                <TableRow className="font-semibold">
                  <TableCell colSpan={2} className="text-right text-muted-foreground">Total</TableCell>
                  <TableCell className="text-right">{formatarMoeda(usoMaterial.reduce((s, m) => s + m.custo, 0))}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
