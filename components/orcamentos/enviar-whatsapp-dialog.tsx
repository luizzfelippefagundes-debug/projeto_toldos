"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { MessageCircle } from "lucide-react"
import type { Orcamento, Cliente } from "@/lib/types"
import { formatarMoeda } from "@/lib/format"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  orcamento: Orcamento
  cliente: Cliente | undefined
}

function mensagemSugerida(orcamento: Orcamento, cliente: Cliente | undefined): string {
  const nome = cliente?.nome?.split(" ")[0] ?? "cliente"
  const num = String(orcamento.numero).padStart(4, "0")
  const valor = orcamento.totalFechado ? ` no valor de ${formatarMoeda(orcamento.totalFechado)}` : ""

  if (orcamento.status === "aberto") {
    return `Olá, ${nome}! 👋 Tudo bem?\n\nPassando pra lembrar que seu orçamento nº ${num} da *Toldos Print*${valor} ainda está aguardando aprovação.\n\nQualquer dúvida ou quiser ajustar algo, é só falar! 😊`
  }

  if (orcamento.status === "fechado") {
    return `Olá, ${nome}! 👋\n\nSeu pedido nº ${num} da *Toldos Print*${valor} está em produção. Em breve te avisamos quando estiver pronto! 😊`
  }

  return `Olá, ${nome}! 👋 Tudo bem?\n\nPassando pra dar um alô da *Toldos Print* sobre o orçamento nº ${num}.\n\nQualquer dúvida, estamos à disposição! 😊`
}

function normalizarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, "")
  if (digits.startsWith("55") && digits.length >= 12) return digits
  if (digits.length === 11 || digits.length === 10) return `55${digits}`
  return digits
}

export function EnviarWhatsappDialog({ open, onOpenChange, orcamento, cliente }: Props) {
  const [mensagem, setMensagem] = useState(() => mensagemSugerida(orcamento, cliente))
  const [enviando, setEnviando] = useState(false)

  const telefone = cliente?.telefone ? normalizarTelefone(cliente.telefone) : null

  async function handleEnviar() {
    if (!telefone || !mensagem.trim()) return
    setEnviando(true)
    try {
      const res = await fetch("/api/whatsapp/enviar-notificacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefone,
          mensagem: mensagem.trim(),
          clienteId: cliente?.id ?? null,
          clienteNome: cliente?.nome ?? telefone,
        }),
      })
      if (!res.ok) throw new Error("Falha ao enviar")
      toast.success("Mensagem enviada pelo WhatsApp!")
      onOpenChange(false)
    } catch {
      toast.error("Erro ao enviar. Verifique a conexão com o WhatsApp.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Enviar WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {!telefone && (
            <p className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
              Este cliente não tem telefone cadastrado.
            </p>
          )}

          {telefone && (
            <p className="text-sm text-muted-foreground">
              Será enviado para <span className="font-medium text-foreground">{cliente?.nome}</span>{" "}
              ({cliente?.telefone})
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="mensagem-whatsapp">Mensagem</Label>
            <Textarea
              id="mensagem-whatsapp"
              rows={6}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              disabled={!telefone}
              className="resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleEnviar}
            disabled={!telefone || !mensagem.trim() || enviando}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {enviando ? "Enviando…" : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
