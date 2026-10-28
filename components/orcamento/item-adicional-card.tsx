"use client"

import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatarMoeda } from "@/lib/format"
import { acabamentosSeed } from "@/lib/seed-data"
import type { ItemAdicionalForm } from "@/lib/item-adicional-form"
import type { Material, Servico } from "@/lib/types"

interface ItemAdicionalCardProps {
  numero: number
  form: ItemAdicionalForm
  materiais: Material[]
  servicos: Servico[]
  onChange: (form: ItemAdicionalForm) => void
  onRemover: () => void
}

// Um item a mais do orçamento: material, serviço, medidas, quantidade e
// acabamentos. Instalação, desconto etc. valem pro orçamento todo (item 1).
export function ItemAdicionalCard({
  numero,
  form,
  materiais,
  servicos,
  onChange,
  onRemover,
}: ItemAdicionalCardProps) {
  const material = materiais.find((m) => m.id === form.materialId)
  const servico = servicos.find((s) => s.id === form.servicoId)
  const precisaMedidas =
    material?.unidade === "m2" || servico?.formaCobranca === "m2"

  function atualizar(campos: Partial<ItemAdicionalForm>) {
    onChange({ ...form, ...campos })
  }

  function atualizarAcabamento(id: string, campos: { ativo?: boolean; qtd?: string }) {
    const atual = form.acabamentos[id] ?? { ativo: false, qtd: "" }
    atualizar({ acabamentos: { ...form.acabamentos, [id]: { ...atual, ...campos } } })
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Item {numero}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemover}
          aria-label={`Remover item ${numero}`}
        >
          <Trash2 className="mr-1 h-4 w-4" />
          Remover
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <Label>Material</Label>
          <Select
            value={form.materialId}
            onValueChange={(v) => atualizar({ materialId: v ?? "" })}
          >
            {/* Nome longo de material não pode alargar a tela no celular. */}
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder="Selecione o material">
                {(v: string) =>
                  materiais.find((m) => m.id === v)?.nome ?? "Selecione o material"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {materiais.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label>
            Serviço{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Select
            value={form.servicoId}
            onValueChange={(v) => atualizar({ servicoId: v ?? "nenhum" })}
          >
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder="Sem serviço adicional">
                {(v: string) =>
                  servicos.find((s) => s.id === v)?.nome ?? "Sem serviço adicional"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhum">Sem serviço adicional</SelectItem>
              {servicos.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {precisaMedidas && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`largura-${form.id}`}>Largura (m)</Label>
            <Input
              id={`largura-${form.id}`}
              type="number"
              min="0"
              step="0.01"
              value={form.largura}
              onChange={(e) => atualizar({ largura: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`altura-${form.id}`}>Altura (m)</Label>
            <Input
              id={`altura-${form.id}`}
              type="number"
              min="0"
              step="0.01"
              value={form.altura}
              onChange={(e) => atualizar({ altura: e.target.value })}
            />
          </div>
        </div>
      )}

      {material && (
        <div className="flex flex-col gap-2 sm:w-48">
          <Label htmlFor={`quantidade-${form.id}`}>Quantidade</Label>
          <Input
            id={`quantidade-${form.id}`}
            type="number"
            min="1"
            step="1"
            value={form.quantidadeUnidades}
            onChange={(e) => atualizar({ quantidadeUnidades: e.target.value })}
          />
        </div>
      )}

      {servico?.formaCobranca === "hora" && (
        <div className="flex flex-col gap-2 sm:w-48">
          <Label htmlFor={`horas-${form.id}`}>Horas estimadas</Label>
          <Input
            id={`horas-${form.id}`}
            type="number"
            min="0"
            step="0.5"
            value={form.horasEstimadas}
            onChange={(e) => atualizar({ horasEstimadas: e.target.value })}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label>
          Acabamentos{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        {acabamentosSeed.map((acabamento) => {
          const sel = form.acabamentos[acabamento.id] ?? { ativo: false, qtd: "" }
          return (
            <div
              key={acabamento.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="min-w-32 flex-1">
                <p className="text-sm font-medium">{acabamento.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {formatarMoeda(acabamento.precoUnitario)} / {acabamento.unidade}
                </p>
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Qtd."
                className="w-24"
                value={sel.qtd}
                disabled={!sel.ativo}
                onChange={(e) => atualizarAcabamento(acabamento.id, { qtd: e.target.value })}
              />
              <Switch
                checked={sel.ativo}
                onCheckedChange={(v) => atualizarAcabamento(acabamento.id, { ativo: v })}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
