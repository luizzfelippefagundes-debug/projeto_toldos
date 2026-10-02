"use client"

import { useState } from "react"
import { useData } from "@/context/data-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatarDataHora } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Bot, Send, User } from "lucide-react"
import { toast } from "sonner"

export default function BotPage() {
  const { mensagensBot, clientes, addMensagemBot } = useData()
  const [clienteId, setClienteId] = useState(
    () => clientes.find((c) => c.nome.includes("Teste"))?.id ?? clientes[0]?.id ?? ""
  )
  const [pergunta, setPergunta] = useState("")
  const [enviando, setEnviando] = useState(false)

  const cliente = clientes.find((c) => c.id === clienteId)

  async function perguntar() {
    const texto = pergunta.trim()
    if (!texto || !cliente) return
    setEnviando(true)
    addMensagemBot({
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      telefone: cliente.telefone,
      texto,
      origem: "pergunta",
      autor: "cliente",
    })
    setPergunta("")

    try {
      const resposta = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pergunta: texto,
          contexto: { cliente: cliente.nome },
        }),
      })
      const dados = await resposta.json()
      if (!resposta.ok) {
        toast.error(dados.erro ?? "Erro ao falar com o bot")
        return
      }
      addMensagemBot({
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        telefone: cliente.telefone,
        texto: dados.resposta,
        origem: "pergunta",
        autor: "bot",
      })
    } catch {
      toast.error("Não consegui falar com o bot agora.")
    } finally {
      setEnviando(false)
    }
  }

  const ordenadas = [...mensagensBot].sort(
    (a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime()
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Central do Bot</h1>
        <p className="text-sm text-muted-foreground">
          Mensagens automáticas (orçamento fechado, status do pedido) e
          perguntas testadas com IA de verdade (Gemini). O envio por WhatsApp
          ainda não está conectado — por enquanto, tudo fica registrado aqui.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Testar bot</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Simulando como</Label>
            <Select
              value={clienteId}
              onValueChange={(v) => setClienteId(v ?? clienteId)}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue>
                  {(v: string) => {
                    const c = clientes.find((c) => c.id === v)
                    return c ? `${c.nome} — ${c.telefone}` : "Selecione"
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} — {c.telefone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pergunta">Pergunta do cliente</Label>
            <Textarea
              id="pergunta"
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              placeholder="Ex: Quando fica pronto meu pedido?"
            />
          </div>
          <Button
            onClick={perguntar}
            disabled={enviando || !pergunta.trim()}
            className="self-end"
          >
            <Send className="mr-2 h-4 w-4" />
            {enviando ? "Perguntando..." : "Perguntar"}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {ordenadas.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex",
              m.autor === "cliente" ? "justify-start" : "justify-end"
            )}
          >
            <div
              className={cn(
                "max-w-md rounded-lg px-4 py-2 text-sm",
                m.autor === "cliente"
                  ? "bg-muted"
                  : "bg-primary/15"
              )}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {m.autor === "cliente" ? (
                  <User className="h-3 w-3" />
                ) : (
                  <Bot className="h-3 w-3" />
                )}
                <span>{m.clienteNome}</span>
                <span>·</span>
                <span>{formatarDataHora(m.criadoEm)}</span>
                {m.origem === "automatica" && (
                  <Badge variant="secondary" className="text-[10px]">
                    Automática
                  </Badge>
                )}
              </div>
              {m.texto}
            </div>
          </div>
        ))}
        {ordenadas.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma mensagem ainda.
          </p>
        )}
      </div>
    </div>
  )
}
