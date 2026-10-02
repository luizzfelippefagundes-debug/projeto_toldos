"use client"

import { useParams, useRouter } from "next/navigation"
import { useData } from "@/context/data-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { calcularOrcamentoCompleto, quantidadeMaterialConsumida } from "@/lib/calculo"
import { formatarData, formatarMoeda } from "@/lib/format"
import { acabamentosSeed, equipamentosAcessoSeed } from "@/lib/seed-data"
import { ArrowLeft, Printer } from "lucide-react"

export default function OrdemDeServicoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { orcamentos, clientes, materiais, servicos } = useData()

  const orcamento = orcamentos.find((o) => o.id === id)
  const cliente = clientes.find((c) => c.id === orcamento?.clienteId)
  const material = materiais.find((m) => m.id === orcamento?.item.materialId)
  const servico = servicos.find((s) => s.id === orcamento?.item.servicoId)

  if (!orcamento || !cliente || !material || !servico) {
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

  const resultado = calcularOrcamentoCompleto(
    orcamento.item,
    material,
    servico,
    orcamento.ajusteManual,
    acabamentosSeed,
    equipamentosAcessoSeed
  )
  const consumo = quantidadeMaterialConsumida(orcamento.item, material)

  const acabamentosSelecionados = (orcamento.item.acabamentos ?? [])
    .map((sel) => {
      const acabamento = acabamentosSeed.find((a) => a.id === sel.acabamentoId)
      return acabamento ? `${acabamento.nome} (${sel.quantidade} ${acabamento.unidade})` : null
    })
    .filter(Boolean)

  const instalacao = orcamento.item.instalacao
  const equipamento = equipamentosAcessoSeed.find(
    (e) => e.id === instalacao?.equipamentoId
  )

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
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold">
                Ordem de Serviço — #{orcamento.numero}
              </p>
              <p className="text-sm text-muted-foreground">
                Toldos Print · Gerada em {formatarData(new Date().toISOString())}
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Cliente</p>
              <p className="font-medium">{cliente.nome}</p>
              <p className="text-sm text-muted-foreground">{cliente.telefone}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prazo / validade</p>
              <p className="font-medium">
                {orcamento.validadeDias ?? 7} dias a partir de{" "}
                {formatarData(orcamento.criadoEm)}
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Material</p>
              <p className="font-medium">{material.nome}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Medidas / consumo</p>
              <p className="font-medium">
                {material.unidade === "m2"
                  ? `${orcamento.item.largura} × ${orcamento.item.altura} m`
                  : `${orcamento.item.quantidadeUnidades} un`}{" "}
                — {consumo.toFixed(2)} {material.unidade === "m2" ? "m²" : "un"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Serviço</p>
              <p className="font-medium">{servico.nome}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Acabamentos</p>
              <p className="font-medium">
                {acabamentosSelecionados.length > 0
                  ? acabamentosSelecionados.join(", ")
                  : "Nenhum"}
              </p>
            </div>
          </div>

          {instalacao?.incluida && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground">Instalação</p>
                <p className="font-medium">
                  {instalacao.horas}h · {instalacao.numAjudantes} ajudante(s)
                  {equipamento ? ` · Equipamento: ${equipamento.nome}` : ""}
                </p>
              </div>
            </>
          )}

          {orcamento.anexoNome && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground">Anexo de referência</p>
                <p className="font-medium">{orcamento.anexoNome}</p>
              </div>
            </>
          )}

          <Separator />

          <div className="flex justify-between text-base font-semibold">
            <span>Valor do orçamento</span>
            <span>{formatarMoeda(resultado.total)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
