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
import { UserPlus } from "lucide-react"

interface Props {
  onCriado: (cliente: Cliente) => void
}

export function ClienteQuickAddDialog({ onCriado }: Props) {
  const { addCliente } = useData()
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState("")
  const [telefone, setTelefone] = useState("")

  const valido = nome.trim().length > 0 && telefone.trim().length > 0

  function salvar() {
    const cliente = addCliente({ nome: nome.trim(), telefone: telefone.trim() })
    onCriado(cliente)
    setNome("")
    setTelefone("")
    setAberto(false)
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <UserPlus className="mr-2 h-4 w-4" />
        Novo cliente
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastro rápido de cliente</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nomeCliente">Nome</Label>
            <Input
              id="nomeCliente"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="telefoneCliente">Telefone</Label>
            <Input
              id="telefoneCliente"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button disabled={!valido} onClick={salvar}>
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
