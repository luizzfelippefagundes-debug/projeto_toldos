"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useData } from "@/context/data-context"
import { formatarMoeda } from "@/lib/format"
import { calcularOrcamentoCompleto } from "@/lib/calculo"
import { acabamentosSeed, equipamentosAcessoSeed } from "@/lib/seed-data"
import { Users, ChevronRight, Phone, Mail } from "lucide-react"

function totalOrcamento(
  o: ReturnType<typeof useData>["orcamentos"][number],
  materiais: ReturnType<typeof useData>["materiais"],
  servicos: ReturnType<typeof useData>["servicos"]
) {
  if (o.totalFechado !== undefined) return o.totalFechado
  const mat = materiais.find((m) => m.id === o.item.materialId)
  const srv = servicos.find((s) => s.id === o.item.servicoId)
  if (!mat || !srv) return 0
  return calcularOrcamentoCompleto(
    o.item, mat, srv, o.ajusteManual, acabamentosSeed, equipamentosAcessoSeed
  ).total
}

export default function ClientesPage() {
  const { clientes, orcamentos, materiais, servicos } = useData()

  const fichas = useMemo(() => {
    return clientes.map((cliente) => {
      const ocs = orcamentos
        .filter((o) => o.clienteId === cliente.id)
        .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
      const totalFaturado = ocs
        .filter((o) => o.status === "fechado")
        .reduce((acc, o) => acc + totalOrcamento(o, materiais, servicos), 0)
      const ultimoOrcamento = ocs[0]?.criadoEm ?? null
      return { cliente, totalOrcamentos: ocs.length, totalFaturado, ultimoOrcamento }
    }).sort((a, b) => b.totalOrcamentos - a.totalOrcamentos)
  }, [clientes, orcamentos, materiais, servicos])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Ficha de cada cliente com histórico de orçamentos.
        </p>
      </div>

      {fichas.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Users className="h-10 w-10 opacity-30" />
          <p>Nenhum cliente cadastrado ainda.</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fichas.map(({ cliente, totalOrcamentos, totalFaturado, ultimoOrcamento }) => (
          <Link
            key={cliente.id}
            href={`/clientes/${cliente.id}`}
            className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {cliente.nome.charAt(0).toUpperCase()}
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>

            <div>
              <p className="font-medium leading-tight">{cliente.nome}</p>
              {cliente.telefone && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {cliente.telefone}
                </p>
              )}
              {cliente.email && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  {cliente.email}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
              <div>
                <p className="text-xs text-muted-foreground">Orçamentos</p>
                <p className="text-sm font-semibold">{totalOrcamentos}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Faturado</p>
                <p className="text-sm font-semibold">{formatarMoeda(totalFaturado)}</p>
              </div>
              {ultimoOrcamento && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">
                    Último orçamento:{" "}
                    {new Date(ultimoOrcamento).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
