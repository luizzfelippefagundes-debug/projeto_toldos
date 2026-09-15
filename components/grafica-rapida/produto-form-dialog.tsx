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
import type { CategoriaProdutoRapido } from "@/lib/types"
import { Plus, X } from "lucide-react"

const categorias: CategoriaProdutoRapido[] = [
  "Adesivo",
  "Banner",
  "Camiseta",
  "Cartão de Visita",
  "Lona / Faixa",
  "Panfleto / Flyer",
  "Outro",
]

interface VarianteRascunho {
  chave: string
  nome: string
  preco: string
}

function novaVarianteVazia(): VarianteRascunho {
  return { chave: Math.random().toString(36).slice(2), nome: "", preco: "" }
}

export function ProdutoFormDialog() {
  const [aberto, setAberto] = useState(false)

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Novo produto
      </DialogTrigger>
      <DialogContent>
        {/* Remontado via `key` a cada abertura — mesmo padrão de
            material-form-dialog.tsx, evita o lint react-hooks/set-state-in-effect. */}
        <ProdutoFormFields
          key={aberto ? "aberto" : "fechado"}
          onFechar={() => setAberto(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function ProdutoFormFields({ onFechar }: { onFechar: () => void }) {
  const { addProdutoRapido } = useData()

  const [nome, setNome] = useState("")
  const [categoria, setCategoria] = useState<CategoriaProdutoRapido>("Adesivo")
  const [prazoDias, setPrazoDias] = useState("1")
  const [temAcabamento, setTemAcabamento] = useState(false)
  const [variantes, setVariantes] = useState<VarianteRascunho[]>([
    novaVarianteVazia(),
  ])

  const variantesValidas = variantes.filter(
    (v) => v.nome.trim().length > 0 && Number(v.preco) > 0
  )
  const valido = nome.trim().length > 0 && variantesValidas.length > 0

  function atualizarVariante(chave: string, campo: "nome" | "preco", valor: string) {
    setVariantes((atual) =>
      atual.map((v) => (v.chave === chave ? { ...v, [campo]: valor } : v))
    )
  }

  function removerVariante(chave: string) {
    setVariantes((atual) => atual.filter((v) => v.chave !== chave))
  }

  function salvar() {
    addProdutoRapido({
      nome: nome.trim(),
      categoria,
      prazoDias: Number(prazoDias) || 1,
      temAcabamento,
      variantes: variantesValidas.map((v) => ({
        id: `${v.chave}`,
        nome: v.nome.trim(),
        preco: Number(v.preco),
      })),
    })
    onFechar()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Novo produto</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="nomeProduto">Nome</Label>
          <Input
            id="nomeProduto"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Banner Lona 440g"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>Categoria</Label>
            <Select
              value={categoria}
              onValueChange={(v) =>
                setCategoria((v as CategoriaProdutoRapido) ?? categoria)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="prazoDias">Prazo (dias)</Label>
            <Input
              id="prazoDias"
              type="number"
              min="1"
              value={prazoDias}
              onChange={(e) => setPrazoDias(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <Label htmlFor="temAcabamento">Tem opção de acabamento</Label>
          <Switch
            id="temAcabamento"
            checked={temAcabamento}
            onCheckedChange={setTemAcabamento}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Tamanhos e preços</Label>
          {variantes.map((v) => (
            <div key={v.chave} className="flex gap-2">
              <Input
                placeholder="Ex: A4, 100 un..."
                value={v.nome}
                onChange={(e) =>
                  atualizarVariante(v.chave, "nome", e.target.value)
                }
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Preço"
                className="w-28"
                value={v.preco}
                onChange={(e) =>
                  atualizarVariante(v.chave, "preco", e.target.value)
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removerVariante(v.chave)}
                disabled={variantes.length === 1}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              setVariantes((atual) => [...atual, novaVarianteVazia()])
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar tamanho
          </Button>
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
