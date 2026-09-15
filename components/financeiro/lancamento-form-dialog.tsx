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
import type { TipoLancamento } from "@/lib/types"
import { Plus } from "lucide-react"

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export function LancamentoFormDialog() {
  const [aberto, setAberto] = useState(false)

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Novo lançamento
      </DialogTrigger>
      <DialogContent>
        {/* Remontado via `key` a cada abertura — mesmo padrão usado nos
            outros diálogos de cadastro deste projeto. */}
        <LancamentoFormFields
          key={aberto ? "aberto" : "fechado"}
          onFechar={() => setAberto(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function LancamentoFormFields({ onFechar }: { onFechar: () => void }) {
  const { addLancamento } = useData()

  const [tipo, setTipo] = useState<TipoLancamento>("despesa")
  const [descricao, setDescricao] = useState("")
  const [categoria, setCategoria] = useState("")
  const [valor, setValor] = useState("")
  const [vencimento, setVencimento] = useState(hojeISO())

  const valido =
    descricao.trim().length > 0 &&
    categoria.trim().length > 0 &&
    Number(valor) > 0

  function salvar() {
    addLancamento({
      descricao: descricao.trim(),
      tipo,
      categoria: categoria.trim(),
      valor: Number(valor),
      vencimento: new Date(`${vencimento}T00:00:00`).toISOString(),
      status: "pendente",
      origem: "manual",
      origemId: null,
    })
    onFechar()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Novo lançamento</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Tipo</Label>
          <Select
            value={tipo}
            onValueChange={(v) => setTipo((v as TipoLancamento) ?? tipo)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="despesa">Despesa (a pagar)</SelectItem>
              <SelectItem value="receita">Receita (a receber)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="descricao">Descrição</Label>
          <Input
            id="descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Aluguel do galpão"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="categoria">Categoria</Label>
            <Input
              id="categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ex: Aluguel, Fornecedor..."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="valor">Valor (R$)</Label>
            <Input
              id="valor"
              type="number"
              min="0"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="vencimento">Vencimento</Label>
          <Input
            id="vencimento"
            type="date"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onFechar}>
          Cancelar
        </Button>
        <Button disabled={!valido} onClick={salvar}>
          Salvar
        </Button>
      </DialogFooter>
    </>
  )
}
