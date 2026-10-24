"use client"

import { useParams, useRouter } from "next/navigation"
import { useData } from "@/context/data-context"
import { Button } from "@/components/ui/button"
import { calcularOrcamentoCompleto } from "@/lib/calculo"
import { ehImagem, formatarNumeroOrcamento, gerarLinhasOrcamento } from "@/lib/orcamento-pdf"
import { OrcamentoOficial } from "@/components/orcamentos/orcamento-oficial"
import { acabamentosSeed, equipamentosAcessoSeed } from "@/lib/seed-data"
import { ArrowLeft, Printer } from "lucide-react"

export default function OrcamentoOficialPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { orcamentos, clientes, materiais, servicos } = useData()

  const orcamento = orcamentos.find((o) => o.id === id)

  if (!orcamento) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <p className="text-sm text-muted-foreground">Orçamento não encontrado.</p>
        <Button variant="outline" className="self-start" onClick={() => router.push("/orcamentos")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao histórico
        </Button>
      </div>
    )
  }

  const cliente = clientes.find((c) => c.id === orcamento.clienteId)
  const material = materiais.find((m) => m.id === orcamento.item.materialId)
  const servico = servicos.find((s) => s.id === orcamento.item.servicoId)

  const resultado = material
    ? calcularOrcamentoCompleto(
        orcamento.item,
        material,
        servico ?? null,
        orcamento.ajusteManual,
        acabamentosSeed,
        equipamentosAcessoSeed
      )
    : null

  const total = orcamento.totalFechado ?? resultado?.total ?? 0
  const nomeMaterial = orcamento.materialFechado?.nome ?? material?.nome ?? "Material removido"
  const unidadeMaterial = orcamento.materialFechado?.unidade ?? material?.unidade ?? "unidade"

  const linhas = resultado
    ? gerarLinhasOrcamento({
        item: orcamento.item,
        nomeMaterial,
        unidadeMaterial,
        acabamentosDisponiveis: acabamentosSeed,
        resultado,
        total,
      })
    : []

  const fotos = [
    ...(orcamento.anexoUrl && ehImagem(orcamento.anexoNome)
      ? [{ url: orcamento.anexoUrl, legenda: "" }]
      : []),
    ...(orcamento.item.fotos ?? []),
  ]
  const condicoes = orcamento.item.condicoesPagamento?.trim() || "À vista"
  const numero = formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" onClick={() => router.push("/orcamentos")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimir / salvar PDF
        </Button>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <OrcamentoOficial
          clienteNome={cliente?.nome ?? "—"}
          data={orcamento.criadoEm}
          numero={numero}
          linhas={linhas}
          total={total}
          condicoes={condicoes}
          fotos={fotos}
        />
      </div>
    </>
  )
}
