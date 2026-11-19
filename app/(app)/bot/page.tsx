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
import { Bot, Send, User, KeyRound, Smartphone, Copy, Loader2, Check } from "lucide-react"
import { toast } from "sonner"

export default function BotPage() {
  const { mensagensBot, clientes, addMensagemBot } = useData()
  const [clienteId, setClienteId] = useState(
    () => clientes.find((c) => c.nome.includes("Teste"))?.id ?? clientes[0]?.id ?? ""
  )
  const [pergunta, setPergunta] = useState("")
  const [enviando, setEnviando] = useState(false)

  // Pareamento por código
  const [numeroPareamento, setNumeroPareamento] = useState("27997489714")
  const [gerandoCodigo, setGerandoCodigo] = useState(false)
  const [codigoPareamento, setCodigoPareamento] = useState<string | null>(null)
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  async function gerarCodigo() {
    if (!numeroPareamento.trim()) {
      toast.error("Informe o número de telefone com DDD.")
      return
    }
    setGerandoCodigo(true)
    setCodigoPareamento(null)
    setQrCodeBase64(null)
    setCopiado(false)
    try {
      const res = await fetch("/api/bot/pareamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero: numeroPareamento.trim() }),
      })
      const dados = (await res.json()) as { code?: string; qrBase64?: string; erro?: string }
      if (!res.ok) {
        toast.error(dados.erro || "Falha ao gerar código na Evolution API.")
        return
      }
      if (dados.code) setCodigoPareamento(dados.code)
      if (dados.qrBase64) setQrCodeBase64(dados.qrBase64)

      if (dados.code || dados.qrBase64) {
        toast.success("Código de pareamento gerado com sucesso!")
      } else {
        toast.warning("Código não gerado. Verifique se o número está correto.")
      }
    } catch {
      toast.error("Erro de conexão ao gerar código.")
    } finally {
      setGerandoCodigo(false)
    }
  }

  function copiarCodigo() {
    if (!codigoPareamento) return
    navigator.clipboard.writeText(codigoPareamento)
    setCopiado(true)
    toast.success("Código copiado!")
    setTimeout(() => setCopiado(false), 3000)
  }

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
          Conexão do WhatsApp da empresa, mensagens automáticas e transmissão.
        </p>
      </div>

      {/* Card Conectar por Código de Pareamento */}
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
            <KeyRound className="h-5 w-5 text-emerald-600" />
            Conectar WhatsApp à Distância (Código de 8 Dígitos — Sem QR Code)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Gere o código de pareamento para o número do dono. Ele receberá uma notificação ou poderá digitar o código no WhatsApp dele sem precisar escanear QR Code com a câmera.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="DDD + Número (ex: 27997489714)"
                value={numeroPareamento}
                onChange={(e) => setNumeroPareamento(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <Button
              type="button"
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-2 shrink-0"
              onClick={gerarCodigo}
              disabled={gerandoCodigo}
            >
              {gerandoCodigo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando Código...
                </>
              ) : (
                <>
                  <Smartphone className="h-4 w-4" />
                  Gerar Código de Conexão
                </>
              )}
            </Button>
          </div>

          {(codigoPareamento || qrCodeBase64) && (
            <div className="mt-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5 flex flex-col gap-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                {codigoPareamento && (
                  <div className="flex-1">
                    <span className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold uppercase tracking-wider">
                      Código de Pareamento de 8 Dígitos:
                    </span>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="text-3xl sm:text-4xl font-mono font-bold tracking-widest text-emerald-700 dark:text-emerald-300 bg-background/80 px-4 py-2 rounded-lg border border-emerald-500/30">
                        {codigoPareamento}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-10 px-3 border-emerald-500/40 bg-background hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium"
                        onClick={copiarCodigo}
                      >
                        {copiado ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        {copiado ? "Copiado!" : "Copiar"}
                      </Button>
                    </div>
                  </div>
                )}

                {qrCodeBase64 && (
                  <div className="flex flex-col items-center gap-1.5 shrink-0 bg-background/80 p-3 rounded-xl border border-emerald-500/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrCodeBase64}
                      alt="QR Code WhatsApp"
                      className="h-36 w-36 object-contain rounded bg-white p-1"
                    />
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Ou escaneie com a câmera
                    </span>
                  </div>
                )}
              </div>

              {codigoPareamento && (
                <div className="rounded-lg bg-background/80 p-3.5 text-xs text-muted-foreground border border-border/60 space-y-1.5">
                  <p className="font-semibold text-foreground text-sm">Como o dono conecta no WhatsApp dele:</p>
                  <p>1. Abrir o WhatsApp ➔ Configurações (ou três pontinhos) ➔ <b>Aparelhos Conectados</b></p>
                  <p>2. Clicar no botão verde <b>Conectar um aparelho</b></p>
                  <p>3. Embaixo de onde abre a câmera, clicar em <b>&quot;Conectar com número de telefone&quot;</b></p>
                  <p>4. Digitar o código de 8 dígitos: <strong className="text-foreground font-mono text-sm">{codigoPareamento}</strong></p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
