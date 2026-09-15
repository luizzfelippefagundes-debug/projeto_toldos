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
import type { FormaCobranca, Servico } from "@/lib/types"
import { Pencil, Plus } from "lucide-react"

const formasCobranca: { value: FormaCobranca; label: string; sufixo: string }[] = [
  { value: "fixo", label: "Valor fixo", sufixo: "R$" },
  { value: "hora", label: "Por hora", sufixo: "R$/hora" },
  { value: "m2", label: "Por m²", sufixo: "R$/m²" },
  { value: "percentual", label: "% sobre o material", sufixo: "%" },
]

interface Props {
  servico?: Servico
}

export function ServicoFormDialog({ servico }: Props) {
  const modoEdicao = Boolean(servico)
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
          Novo Serviço
        </DialogTrigger>
      )}
      <DialogContent>
        {/* Ver comentário equivalente em material-form-dialog.tsx: os campos
            são remontados via `key` a cada abertura, em vez de reidratados
            por useEffect, para não recair no lint react-hooks/set-state-in-effect. */}
        <ServicoFormFields
          key={aberto ? `aberto-${servico?.id ?? "novo"}` : "fechado"}
          servico={servico}
          modoEdicao={modoEdicao}
          onFechar={() => setAberto(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

interface FieldsProps {
  servico?: Servico
  modoEdicao: boolean
  onFechar: () => void
}

function ServicoFormFields({ servico, modoEdicao, onFechar }: FieldsProps) {
  const { addServico, updateServico } = useData()

  const [nome, setNome] = useState(servico?.nome ?? "")
  const [formaCobranca, setFormaCobranca] = useState<FormaCobranca>(
    servico?.formaCobranca ?? "fixo"
  )
  const [valor, setValor] = useState(servico?.valor?.toString() ?? "")

  const sufixo = formasCobranca.find((f) => f.value === formaCobranca)?.sufixo ?? ""
  const valido = nome.trim().length > 0 && Number(valor) > 0

  function salvar() {
    const dados = { nome: nome.trim(), formaCobranca, valor: Number(valor) }
    if (modoEdicao && servico) {
      updateServico(servico.id, dados)
    } else {
      addServico(dados)
    }
    onFechar()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {modoEdicao ? "Editar serviço" : "Novo serviço"}
        </DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="nomeServico">Tipo de serviço</Label>
          <Input
            id="nomeServico"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Instalação de Toldo"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Forma de cobrança</Label>
          <Select
            value={formaCobranca}
            onValueChange={(v) => setFormaCobranca(v as FormaCobranca)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {formasCobranca.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="valorServico">Valor ({sufixo})</Label>
          <Input
            id="valorServico"
            type="number"
            min="0"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
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
