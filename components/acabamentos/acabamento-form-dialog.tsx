"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useData } from "@/context/data-context"
import type { Acabamento } from "@/lib/types"
import { isPositiveNumberInput } from "@/lib/number"
import { Pencil, Plus, Trash2 } from "lucide-react"

interface Props {
  acabamento?: Acabamento
}

export function AcabamentoFormDialog({ acabamento }: Props) {
  const modoEdicao = Boolean(acabamento)
  const [aberto, setAberto] = useState(false)

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      {modoEdicao ? (
        <DialogTrigger render={<Button variant="ghost" size="icon" />}>
          <Pencil className="h-4 w-4" />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Acabamento
        </DialogTrigger>
      )}
      <DialogContent>
        <AcabamentoFormFields
          key={aberto ? `aberto-${acabamento?.id ?? "novo"}` : "fechado"}
          acabamento={acabamento}
          modoEdicao={modoEdicao}
          onFechar={() => setAberto(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

interface FieldsProps {
  acabamento?: Acabamento
  modoEdicao: boolean
  onFechar: () => void
}

function AcabamentoFormFields({ acabamento, modoEdicao, onFechar }: FieldsProps) {
  const { addAcabamento, updateAcabamento, removeAcabamento } = useData()

  const [nome, setNome] = useState(acabamento?.nome ?? "")
  const [unidade, setUnidade] = useState(acabamento?.unidade ?? "un")
  const [preco, setPreco] = useState(acabamento?.precoUnitario?.toString() ?? "")
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)

  const valido = nome.trim().length > 0 && isPositiveNumberInput(preco)

  function salvar() {
    const dados = {
      nome: nome.trim(),
      unidade,
      precoUnitario: Number(preco),
    }
    if (modoEdicao && acabamento) {
      updateAcabamento(acabamento.id, dados)
    } else {
      addAcabamento(dados)
    }
    onFechar()
  }

  if (confirmandoExclusao) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Excluir acabamento</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Tem certeza que deseja excluir <strong>{acabamento?.nome}</strong>? Orçamentos já fechados não são afetados.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setConfirmandoExclusao(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              removeAcabamento(acabamento!.id)
              onFechar()
            }}
          >
            Excluir
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{modoEdicao ? "Editar acabamento" : "Novo acabamento"}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Ilhós"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="preco">Preço unitário (R$)</Label>
            <Input
              id="preco"
              type="number"
              min="0"
              step="0.01"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              placeholder="0,00"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Unidade</Label>
            <Select value={unidade} onValueChange={(v) => setUnidade(v ?? "un")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="un">unidade</SelectItem>
                <SelectItem value="m">metro linear</SelectItem>
                <SelectItem value="m²">m²</SelectItem>
                <SelectItem value="peça">peça</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <DialogFooter className="gap-2">
        {modoEdicao && (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto text-destructive hover:text-destructive"
            onClick={() => setConfirmandoExclusao(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </Button>
        )}
        <Button variant="outline" onClick={onFechar}>
          Cancelar
        </Button>
        <Button onClick={salvar} disabled={!valido}>
          {modoEdicao ? "Salvar" : "Adicionar"}
        </Button>
      </DialogFooter>
    </>
  )
}
