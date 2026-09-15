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
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useData } from "@/context/data-context"
import { toast } from "sonner"
import { Plus } from "lucide-react"

export function NovaEntradaDialog() {
  const { materiais, addEntradaEstoque } = useData()
  const [aberto, setAberto] = useState(false)
  const [materialId, setMaterialId] = useState("")
  const [quantidade, setQuantidade] = useState("")
  const [fornecedor, setFornecedor] = useState("")
  const [comNotaFiscal, setComNotaFiscal] = useState(false)
  const [numeroNota, setNumeroNota] = useState("")

  const valido = materialId !== "" && Number(quantidade) > 0

  function limpar() {
    setMaterialId("")
    setQuantidade("")
    setFornecedor("")
    setComNotaFiscal(false)
    setNumeroNota("")
  }

  function salvar() {
    addEntradaEstoque({
      materialId,
      quantidade: Number(quantidade),
      fornecedor: fornecedor.trim() || undefined,
      comNotaFiscal,
      numeroNota: comNotaFiscal ? numeroNota.trim() || undefined : undefined,
    })
    const material = materiais.find((m) => m.id === materialId)
    toast.success(`Estoque atualizado: ${material?.nome ?? ""}`)
    limpar()
    setAberto(false)
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v)
        if (!v) limpar()
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Nova Entrada
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova entrada de estoque</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Material</Label>
            <Select
              value={materialId}
              onValueChange={(v) => setMaterialId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o material" />
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="quantidadeEntrada">Quantidade</Label>
            <Input
              id="quantidadeEntrada"
              type="number"
              min="0"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="fornecedor">Fornecedor (opcional)</Label>
            <Input
              id="fornecedor"
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label htmlFor="comNota">Com nota fiscal</Label>
            <Switch
              id="comNota"
              checked={comNotaFiscal}
              onCheckedChange={setComNotaFiscal}
            />
          </div>

          {comNotaFiscal && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="numeroNota">Número da nota</Label>
              <Input
                id="numeroNota"
                value={numeroNota}
                onChange={(e) => setNumeroNota(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button disabled={!valido} onClick={salvar}>
            Salvar entrada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
