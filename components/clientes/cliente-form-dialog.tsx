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
import { useData } from "@/context/data-context"
import type { Cliente } from "@/lib/types"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface Props {
  cliente?: Cliente
}

export function ClienteFormDialog({ cliente }: Props) {
  const modoEdicao = Boolean(cliente)
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
          Novo Cliente
        </DialogTrigger>
      )}
      <DialogContent>
        <ClienteFormFields
          key={aberto ? `aberto-${cliente?.id ?? "novo"}` : "fechado"}
          cliente={cliente}
          modoEdicao={modoEdicao}
          onFechar={() => setAberto(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

interface FieldsProps {
  cliente?: Cliente
  modoEdicao: boolean
  onFechar: () => void
}

function ClienteFormFields({ cliente, modoEdicao, onFechar }: FieldsProps) {
  const { addCliente, updateCliente, removeCliente } = useData()
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)

  const [nome, setNome] = useState(cliente?.nome ?? "")
  const [telefone, setTelefone] = useState(cliente?.telefone ?? "")
  const [email, setEmail] = useState(cliente?.email ?? "")

  const valido = nome.trim().length > 0

  function salvar() {
    const dados = { nome: nome.trim(), telefone: telefone.trim(), email: email.trim() || undefined }
    if (modoEdicao && cliente) {
      updateCliente(cliente.id, { ...dados, telefone: dados.telefone })
      toast.success("Cliente atualizado.")
    } else {
      addCliente({ ...dados, telefone: dados.telefone })
      toast.success("Cliente cadastrado.")
    }
    onFechar()
  }

  function excluir() {
    if (!cliente) return
    removeCliente(cliente.id)
    toast.success("Cliente removido.")
    onFechar()
  }

  if (confirmandoExclusao) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Remover cliente?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Isso remove o cadastro de <strong>{cliente?.nome}</strong>. Os orçamentos
          existentes ficam registrados com "Cliente removido".
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmandoExclusao(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={excluir}>
            Remover
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{modoEdicao ? "Editar cliente" : "Novo cliente"}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="nome">Nome *</Label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome completo ou empresa"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="telefone">Telefone / WhatsApp</Label>
          <Input
            id="telefone"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(00) 00000-0000"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
          />
        </div>
      </div>

      <DialogFooter className="gap-2">
        {modoEdicao && (
          <Button
            variant="ghost"
            size="icon"
            className="mr-auto text-destructive hover:text-destructive"
            onClick={() => setConfirmandoExclusao(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
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
