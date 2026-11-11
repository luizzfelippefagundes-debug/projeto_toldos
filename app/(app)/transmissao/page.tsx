"use client"

import { useState, useMemo } from "react"
import { useData } from "@/context/data-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Search, Send, CheckSquare, Square, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { toast } from "sonner"

export default function TransmissaoPage() {
  const { clientes } = useData()
  const [busca, setBusca] = useState("")
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [mensagem, setMensagem] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ enviados: number; falhas: number } | null>(null)

  const clientesComTelefone = useMemo(
    () => clientes.filter((c) => c.telefone?.trim()),
    [clientes]
  )

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return clientesComTelefone
    return clientesComTelefone.filter(
      (c) =>
        c.nome.toLowerCase().includes(termo) ||
        c.telefone.includes(termo)
    )
  }, [clientesComTelefone, busca])

  function toggleCliente(id: string) {
    setSelecionados((prev) => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  function selecionarTodos() {
    setSelecionados(new Set(clientesFiltrados.map((c) => c.id)))
  }

  function deselecionarTodos() {
    setSelecionados(new Set())
  }

  async function enviar() {
    if (!mensagem.trim()) {
      toast.error("Digite uma mensagem antes de enviar.")
      return
    }
    if (selecionados.size === 0) {
      toast.error("Selecione ao menos um cliente.")
      return
    }

    const clientesSelecionados = clientesComTelefone.filter((c) => selecionados.has(c.id))
    const telefones = clientesSelecionados.map((c) => c.telefone.trim())

    setEnviando(true)
    setResultado(null)

    try {
      const res = await fetch("/api/transmissao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem: mensagem.trim(), telefones }),
      })
      const dados = await res.json() as { enviados: number; falhas: number }
      setResultado(dados)
      if (dados.falhas === 0) {
        toast.success(`Mensagem enviada para ${dados.enviados} cliente(s)!`)
      } else {
        toast.warning(`${dados.enviados} enviados, ${dados.falhas} falharam.`)
      }
    } catch {
      toast.error("Erro ao enviar. Tente novamente.")
    } finally {
      setEnviando(false)
    }
  }

  const todosFiltradosSelecionados =
    clientesFiltrados.length > 0 &&
    clientesFiltrados.every((c) => selecionados.has(c.id))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">📡 Transmissão</h1>
        <p className="text-sm text-muted-foreground">
          Envie uma mensagem para vários clientes ao mesmo tempo pelo WhatsApp.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mensagem */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mensagem</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Textarea
              placeholder="Digite a mensagem que será enviada para todos os clientes selecionados..."
              className="min-h-40 resize-none"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              disabled={enviando}
            />
            <p className="text-xs text-muted-foreground">
              {mensagem.length} caracteres · {selecionados.size} cliente(s) selecionado(s)
            </p>

            {resultado && (
              <div className="flex gap-3">
                <div className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {resultado.enviados} enviados
                </div>
                {resultado.falhas > 0 && (
                  <div className="flex items-center gap-1.5 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600">
                    <XCircle className="h-4 w-4" />
                    {resultado.falhas} falharam
                  </div>
                )}
              </div>
            )}

            <Button
              className="w-full"
              onClick={enviar}
              disabled={enviando || !mensagem.trim() || selecionados.size === 0}
            >
              {enviando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar para {selecionados.size} cliente(s)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Clientes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">
                Clientes
                <Badge variant="outline" className="ml-2">
                  {clientesComTelefone.length}
                </Badge>
              </CardTitle>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={todosFiltradosSelecionados ? deselecionarTodos : selecionarTodos}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {todosFiltradosSelecionados ? (
                    <><Square className="h-3 w-3" /> Desmarcar</>
                  ) : (
                    <><CheckSquare className="h-3 w-3" /> Marcar todos</>
                  )}
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                className="pl-9"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>

            <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {clientesFiltrados.map((cliente) => {
                const ativo = selecionados.has(cliente.id)
                return (
                  <button
                    key={cliente.id}
                    type="button"
                    onClick={() => toggleCliente(cliente.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                      ativo
                        ? "bg-primary/10 text-foreground"
                        : "hover:bg-accent text-muted-foreground"
                    )}
                  >
                    <div className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      ativo ? "border-primary bg-primary text-primary-foreground" : "border-border"
                    )}>
                      {ativo && <span className="text-[10px] font-bold">✓</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{cliente.nome}</p>
                      <p className="truncate text-xs">{cliente.telefone}</p>
                    </div>
                  </button>
                )
              })}
              {clientesFiltrados.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nenhum cliente encontrado.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
