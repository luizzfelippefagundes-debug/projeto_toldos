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
import type { Material, TipoMaterial, UnidadeMedida } from "@/lib/types"
import { Pencil, Plus } from "lucide-react"

const tipos: TipoMaterial[] = [
  "Lona",
  "ACM",
  "PVC",
  "Adesivo Vinil",
  "Metalon",
  "Outro",
]

interface Props {
  material?: Material
}

export function MaterialFormDialog({ material }: Props) {
  const modoEdicao = Boolean(material)
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
          Novo Material
        </DialogTrigger>
      )}
      <DialogContent>
        {/*
          Os campos vivem em um subcomponente remontado (via `key`) toda vez
          que o diálogo abre, para reiniciar o formulário a partir dos dados
          atuais de `material`. Essa é a forma recomendada pelo React de
          "resetar" state a partir de uma condição (ver
          https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes),
          em vez de sincronizar via useEffect chamando setState no corpo do
          efeito — o que o lint react-hooks/set-state-in-effect rejeita, e
          com razão aqui: diferente dos dois usos legítimos de
          eslint-disable já existentes neste projeto (hidratação do
          localStorage em context/data-context.tsx e do relógio do sistema
          em app/dashboard/page.tsx, ambos sincronizando com um sistema
          externo real), aqui não há sistema externo algum: é só resetar
          state local a partir de uma prop, o caso que a própria doc do React
          resolve com `key`.
        */}
        <MaterialFormFields
          key={aberto ? `aberto-${material?.id ?? "novo"}` : "fechado"}
          material={material}
          modoEdicao={modoEdicao}
          onFechar={() => setAberto(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

interface FieldsProps {
  material?: Material
  modoEdicao: boolean
  onFechar: () => void
}

function MaterialFormFields({ material, modoEdicao, onFechar }: FieldsProps) {
  const { addMaterial, updateMaterial } = useData()

  const [nome, setNome] = useState(material?.nome ?? "")
  const [tipo, setTipo] = useState<TipoMaterial>(material?.tipo ?? "Lona")
  const [unidade, setUnidade] = useState<UnidadeMedida>(
    material?.unidade ?? "m2"
  )
  const [precoUnitario, setPrecoUnitario] = useState(
    material?.precoUnitario?.toString() ?? ""
  )
  const [estoqueMinimo, setEstoqueMinimo] = useState(
    material?.estoqueMinimo?.toString() ?? ""
  )
  const [quantidadeEstoque, setQuantidadeEstoque] = useState(
    material?.quantidadeEstoque?.toString() ?? "0"
  )

  const valido = nome.trim().length > 0 && Number(precoUnitario) > 0

  function salvar() {
    const dados = {
      nome: nome.trim(),
      tipo,
      unidade,
      precoUnitario: Number(precoUnitario),
      estoqueMinimo: Number(estoqueMinimo) || 0,
      quantidadeEstoque: Number(quantidadeEstoque) || 0,
    }
    if (modoEdicao && material) {
      updateMaterial(material.id, {
        ...dados,
        quantidadeEstoque: material.quantidadeEstoque,
      })
    } else {
      addMaterial(dados)
    }
    onFechar()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {modoEdicao ? "Editar material" : "Novo material"}
        </DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Lona 440g Fosca"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>Tipo</Label>
            <Select
              value={tipo}
              onValueChange={(v) => setTipo(v as TipoMaterial)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tipos.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Cobrado por</Label>
            <Select
              value={unidade}
              onValueChange={(v) => setUnidade(v as UnidadeMedida)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="m2">Metro quadrado (m²)</SelectItem>
                <SelectItem value="unidade">Unidade</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="preco">
              Preço ({unidade === "m2" ? "por m²" : "por unidade"})
            </Label>
            <Input
              id="preco"
              type="number"
              min="0"
              step="0.01"
              value={precoUnitario}
              onChange={(e) => setPrecoUnitario(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="minimo">Estoque mínimo (alerta)</Label>
            <Input
              id="minimo"
              type="number"
              min="0"
              value={estoqueMinimo}
              onChange={(e) => setEstoqueMinimo(e.target.value)}
            />
          </div>
        </div>

        {!modoEdicao && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="estoqueInicial">Estoque inicial</Label>
            <Input
              id="estoqueInicial"
              type="number"
              min="0"
              value={quantidadeEstoque}
              onChange={(e) => setQuantidadeEstoque(e.target.value)}
            />
          </div>
        )}
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
