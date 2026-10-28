"use client"

import { quantidadeMaterialConsumida, quantidadePecas, type ResultadoItem } from "@/lib/calculo"
import { formatarMoeda } from "@/lib/format"
import { acabamentosSeed } from "@/lib/seed-data"
import type { ItemAdicional, Material, Servico } from "@/lib/types"

interface ItensAdicionaisListaProps {
  itens: ItemAdicional[]
  // Partes do resultado dos adicionais (`resultado.itens.slice(1)`), na mesma ordem.
  partes: ResultadoItem[] | undefined
  materiais: Material[]
  servicos: Servico[]
}

// Itens a mais de um orçamento salvo (OS e detalhes): nome, medidas, serviço,
// acabamentos e valor de cada um. Não renderiza nada sem adicionais.
export function ItensAdicionaisLista({ itens, partes, materiais, servicos }: ItensAdicionaisListaProps) {
  if (itens.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">Outros itens do orçamento</p>
      {itens.map((item, i) => {
        const material = materiais.find((m) => m.id === item.materialId)
        const nome = item.materialFechado?.nome ?? material?.nome ?? "Material removido"
        const unidade = item.materialFechado?.unidade ?? material?.unidade
        const consumo =
          item.materialFechado?.quantidade ??
          (material ? quantidadeMaterialConsumida(item, material) : null)
        const servico = servicos.find((s) => s.id === item.servicoId)
        const parte = partes?.[i]
        const acabamentos = (item.acabamentos ?? [])
          .map((sel) => {
            const a = acabamentosSeed.find((x) => x.id === sel.acabamentoId)
            return a ? `${a.nome} (${sel.quantidade} ${a.unidade})` : null
          })
          .filter(Boolean)
        return (
          <div key={item.id} className="rounded-md border border-border p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 break-words font-medium">
                Item {i + 2} — {nome}
              </p>
              {parte && (
                <p className="shrink-0 font-medium">
                  {formatarMoeda(
                    parte.subtotalMaterial + parte.subtotalMaoDeObra + parte.subtotalAcabamentos
                  )}
                </p>
              )}
            </div>
            <p className="text-muted-foreground">
              {unidade === "m2"
                ? `${item.largura} × ${item.altura} m × ${quantidadePecas(item)} un`
                : `${item.quantidadeUnidades} un`}
              {consumo !== null && ` — ${consumo.toFixed(2)} ${unidade === "m2" ? "m²" : "un"}`}
            </p>
            {servico && item.servicoId !== "nenhum" && (
              <p className="text-muted-foreground">Serviço: {servico.nome}</p>
            )}
            {acabamentos.length > 0 && (
              <p className="text-muted-foreground">Acabamentos: {acabamentos.join(", ")}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
