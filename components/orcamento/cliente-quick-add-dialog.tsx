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
  const [email, setEmail] = useState("")
  const [cpf, setCpf] = useState("")

  const valido = nome.trim().length > 0 && telefone.trim().length > 0

  function salvar() {
    const cliente = addCliente({
      nome: nome.trim(),
      telefone: telefone.trim(),
      email: email.trim() || undefined,
      cpf: cpf.trim() || undefined,
    })
    onCriado(cliente)
    setNome("")
    setTelefone("")
    setEmail("")
    setCpf("")
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
            <Label htmlFor="nomeCliente">Nome *</Label>
            <Input
              id="nomeCliente"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do cliente ou empresa"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="telefoneCliente">Telefone *</Label>
            <Input
              id="telefoneCliente"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cpfCliente">
                CPF <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="cpfCliente"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="emailCliente">
                E-mail <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="emailCliente"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@email.com"
              />
            </div>
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
