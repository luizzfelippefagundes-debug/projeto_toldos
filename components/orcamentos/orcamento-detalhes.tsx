"use client"

import { useData } from "@/context/data-context"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { calcularOrcamentoCompleto, quantidadeMaterialConsumida, quantidadePecas } from "@/lib/calculo"
import { formatarData, formatarMoeda } from "@/lib/format"
import { acabamentosSeed, equipamentosAcessoSeed } from "@/lib/seed-data"
import type { Orcamento, StatusOrcamento } from "@/lib/types"

const statusLabel: Record<StatusOrcamento, string> = {
  aberto: "Aberto",
  fechado: "Fechado",
  cancelado: "Cancelado",
}

const statusVariant: Record<
  StatusOrcamento,
  "default" | "secondary" | "destructive"
> = {
  aberto: "default",
  fechado: "secondary",
  cancelado: "destructive",
}

// Conteúdo com todos os dados do orçamento — usado tanto na OS impressa
// (app/orcamentos/[id]/os) quanto no modal de detalhes do histórico.
export function OrcamentoDetalhes({ orcamento }: { orcamento: Orcamento }) {
  const { clientes, materiais, servicos } = useData()

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
  const unidadeMaterial = orcamento.materialFechado?.unidade ?? material?.unidade
  const nomeMaterial =
    orcamento.materialFechado?.nome ?? material?.nome ?? "Material removido"
  const consumo =
    orcamento.materialFechado?.quantidade ??
    (material ? quantidadeMaterialConsumida(orcamento.item, material) : null)
  const servicoFoiEscolhido = Boolean(
    orcamento.item.servicoId && orcamento.item.servicoId !== "nenhum"
  )
  const nomeServico =
    orcamento.servicoFechado?.nome ??
    servico?.nome ??
    (servicoFoiEscolhido ? "Serviço removido" : "Nenhum")
  const ferramentas =
    orcamento.servicoFechado?.ferramentas ?? servico?.ferramentas

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
  const deslocamento = orcamento.item.deslocamento
  const validadeAte = new Date(orcamento.criadoEm)
  validadeAte.setDate(validadeAte.getDate() + (orcamento.validadeDias ?? 7))
  const totalDeslocamento = deslocamento?.incluido
    ? deslocamento.distanciaKm * deslocamento.custoPorKm +
      deslocamento.pedagio +
      deslocamento.alimentacao
    : 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">Orçamento #{orcamento.numero}</p>
          <p className="text-sm text-muted-foreground">
            Criado em {formatarData(orcamento.criadoEm)}
          </p>
        </div>
        <Badge variant={statusVariant[orcamento.status]}>
          {statusLabel[orcamento.status]}
        </Badge>
      </div>

      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Cliente</p>
          <p className="font-medium">{cliente?.nome ?? "Cliente removido"}</p>
          {cliente?.telefone && (
            <p className="text-sm text-muted-foreground">{cliente.telefone}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Validade do orçamento</p>
          <p className="font-medium">
            Válido até {formatarData(validadeAte.toISOString())}
          </p>
        </div>
      </div>

      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Material</p>
          <p className="font-medium">{nomeMaterial}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Medidas / consumo</p>
          <p className="font-medium">
            {unidadeMaterial === "m2"
              ? `${orcamento.item.largura} × ${orcamento.item.altura} m × ${quantidadePecas(orcamento.item)} un`
              : `${orcamento.item.quantidadeUnidades} un`}{" "}
            —{" "}
            {consumo === null
              ? "Consumo não registrado"
              : `${consumo.toFixed(2)} ${unidadeMaterial === "m2" ? "m²" : "un"}`}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Serviço</p>
          <p className="font-medium">{nomeServico}</p>
          {ferramentas?.trim() && (
            <p className="mt-1 text-sm text-muted-foreground">
              Ferramentas: {ferramentas}
            </p>
          )}
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
              {instalacao.custoHora > 0
                ? ` · ${formatarMoeda(instalacao.custoHora)}/h`
                : ""}
              {instalacao.numAjudantes > 0
                ? ` · Diária por ajudante: ${formatarMoeda(instalacao.diariaAjudante)}`
                : ""}
              {equipamento ? ` · Equipamento: ${equipamento.nome}` : ""}
            </p>
          </div>
        </>
      )}

      {deslocamento?.incluido && (
        <>
          <Separator />
          <div>
            <p className="text-xs text-muted-foreground">Deslocamento</p>
            <p className="font-medium">
              {deslocamento.distanciaKm} km ·{" "}
              {formatarMoeda(deslocamento.custoPorKm)}/km · Pedágio:{" "}
              {formatarMoeda(deslocamento.pedagio)} · Alimentação:{" "}
              {formatarMoeda(deslocamento.alimentacao)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total de deslocamento: {formatarMoeda(totalDeslocamento)}
            </p>
          </div>
        </>
      )}

      {orcamento.anexoNome && (
        <>
          <Separator />
          <div>
            <p className="text-xs text-muted-foreground">Anexo de referência</p>
            {orcamento.anexoUrl ? (
              <a
                href={orcamento.anexoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-2"
              >
                {orcamento.anexoNome}
              </a>
            ) : (
              <p className="font-medium">{orcamento.anexoNome}</p>
            )}
          </div>
        </>
      )}

      <Separator />

      <div className="flex justify-between text-base font-semibold">
        <span>Valor do orçamento</span>
        <span>
          {orcamento.totalFechado !== undefined || resultado
            ? formatarMoeda(orcamento.totalFechado ?? resultado!.total)
            : "Valor indisponível"}
        </span>
      </div>
    </div>
  )
}
