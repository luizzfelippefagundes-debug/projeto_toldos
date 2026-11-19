"use client"

import { useState, useMemo, useRef } from "react"
import { useData } from "@/context/data-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  Search,
  Send,
  CheckSquare,
  Square,
  Loader2,
  CheckCircle2,
  XCircle,
  ImageIcon,
  Trash2,
  Copy,
  Download,
  ExternalLink,
  MessageCircle,
  Smartphone,
  Bot,
  ArrowRight,
  RotateCcw,
} from "lucide-react"
import { toast } from "sonner"
import { linkWhatsapp } from "@/lib/whatsapp"

export default function TransmissaoPage() {
  const { clientes } = useData()
  const [busca, setBusca] = useState("")
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [mensagem, setMensagem] = useState("")
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [fotoNome, setFotoNome] = useState<string | null>(null)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ enviados: number; falhas: number } | null>(null)

  // Disparo manual via WhatsApp Web
  const [modalManualAberto, setModalManualAberto] = useState(false)
  const [enviadosManuais, setEnviadosManuais] = useState<Set<string>>(new Set())

  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const listaSelecionados = useMemo(
    () => clientesComTelefone.filter((c) => selecionados.has(c.id)),
    [clientesComTelefone, selecionados]
  )

  const qtdEnviadosManuais = useMemo(
    () => listaSelecionados.filter((c) => enviadosManuais.has(c.id)).length,
    [listaSelecionados, enviadosManuais]
  )

  const progressoPercent = listaSelecionados.length > 0
    ? Math.round((qtdEnviadosManuais / listaSelecionados.length) * 100)
    : 0

  const proximoPendente = useMemo(
    () => listaSelecionados.find((c) => !enviadosManuais.has(c.id)),
    [listaSelecionados, enviadosManuais]
  )

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

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 20 * 1024 * 1024) {
      toast.error("A foto deve ter no máximo 20 MB.")
      return
    }

    setUploadingFoto(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const localDataUrl = reader.result as string
      setFotoUrl(localDataUrl)
      setFotoNome(file.name)

      // Tenta upload no servidor (se houver Blob configurado)
      try {
        const formData = new FormData()
        formData.append("file", file)
        const res = await fetch("/api/upload", { method: "POST", body: formData })
        if (res.ok) {
          const dados = (await res.json()) as { url?: string }
          if (dados.url) setFotoUrl(dados.url)
        }
      } catch {
        // Mantém o dataUrl local como fallback
      } finally {
        setUploadingFoto(false)
        toast.success("Foto carregada com sucesso!")
      }
    }
    reader.onerror = () => {
      setUploadingFoto(false)
      toast.error("Erro ao ler o arquivo de foto.")
    }
    reader.readAsDataURL(file)
  }

  function removerFoto() {
    setFotoUrl(null)
    setFotoNome(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function copiarFotoParaClipboard() {
    if (!fotoUrl) return
    try {
      const res = await fetch(fotoUrl)
      const blob = await res.blob()

      if (blob.type === "image/png") {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
        toast.success("Foto copiada! Aperte Ctrl + V no WhatsApp para colar.")
        return
      }

      // Converte JPEG/WebP para PNG via canvas para permitir escrita na área de transferência
      const img = new Image()
      img.crossOrigin = "anonymous"
      const objUrl = URL.createObjectURL(blob)
      img.src = objUrl
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Erro no canvas")
      ctx.drawImage(img, 0, 0)

      canvas.toBlob(async (pngBlob) => {
        URL.revokeObjectURL(objUrl)
        if (!pngBlob) {
          toast.error("Não foi possível converter a foto.")
          return
        }
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })])
          toast.success("Foto copiada! Aperte Ctrl + V no WhatsApp para colar.")
        } catch {
          toast.error("Navegador não autorizou copiar a imagem. Use o botão Baixar Foto.")
        }
      }, "image/png")
    } catch {
      toast.error("Erro ao copiar foto. Use o botão Baixar Foto.")
    }
  }

  function baixarFoto() {
    if (!fotoUrl) return
    const a = document.createElement("a")
    a.href = fotoUrl
    a.download = fotoNome || "foto-transmissao.jpg"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success("Download da foto iniciado!")
  }

  function abrirWhatsappCliente(tel: string, id: string, nome: string) {
    const link = linkWhatsapp(tel, mensagem.trim())
    if (!link) {
      toast.error(`Telefone de ${nome} inválido para WhatsApp.`)
      return
    }
    window.open(link, "_blank")
    setEnviadosManuais((prev) => new Set(prev).add(id))
  }

  function abrirProximo() {
    if (!proximoPendente) {
      toast.success("Todos os contatos selecionados já foram abertos!")
      return
    }
    abrirWhatsappCliente(proximoPendente.telefone, proximoPendente.id, proximoPendente.nome)
  }

  async function enviarAutomaticoApi() {
    if (!mensagem.trim() && !fotoUrl) {
      toast.error("Digite uma mensagem ou anexe uma foto antes de enviar.")
      return
    }
    if (selecionados.size === 0) {
      toast.error("Selecione ao menos um cliente.")
      return
    }

    const telefones = listaSelecionados.map((c) => c.telefone.trim())

    setEnviando(true)
    setResultado(null)

    try {
      const res = await fetch("/api/transmissao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagem: mensagem.trim(),
          telefones,
          imagem: fotoUrl || undefined,
        }),
      })
      const dados = (await res.json()) as { enviados: number; falhas: number }
      setResultado(dados)
      if (dados.falhas === 0) {
        toast.success(`Transmissão concluída para ${dados.enviados} cliente(s)!`)
      } else {
        toast.warning(`${dados.enviados} enviados, ${dados.falhas} falharam.`)
      }
    } catch {
      toast.error("Erro ao enviar via API. Use a opção de Disparo Manual.")
    } finally {
      setEnviando(false)
    }
  }

  const todosFiltradosSelecionados =
    clientesFiltrados.length > 0 &&
    clientesFiltrados.every((c) => selecionados.has(c.id))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">📡 Transmissão</h1>
          <p className="text-sm text-muted-foreground">
            Envie comunicados, campanhas de Natal ou promoções para vários clientes pelo WhatsApp.
          </p>
        </div>
        <Badge variant="outline" className="w-fit text-xs px-3 py-1">
          {clientesComTelefone.length} clientes com telefone
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mensagem e Mídia */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Mensagem e Mídia</span>
              {fotoUrl && (
                <Badge className="bg-emerald-600/10 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-500/20 text-xs">
                  Foto anexada
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Foto Anexada */}
            {fotoUrl ? (
              <div className="relative rounded-lg border border-border bg-muted/40 p-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fotoUrl}
                  alt="Prévia da foto"
                  className="h-20 w-20 rounded-md object-cover border border-border shrink-0 bg-background"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{fotoNome || "Foto selecionada"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Será enviada junto com o texto como legenda.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={copiarFotoParaClipboard}
                    >
                      <Copy className="h-3 w-3" /> Copiar Foto
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-500/10 gap-1"
                      onClick={removerFoto}
                    >
                      <Trash2 className="h-3 w-3" /> Remover
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={handleFotoChange}
                  disabled={uploadingFoto || enviando}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed h-20 flex flex-col items-center justify-center gap-1.5 hover:bg-accent/60"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFoto || enviando}
                >
                  {uploadingFoto ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Carregando foto...</span>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <ImageIcon className="h-4 w-4 text-primary" />
                        <span>Anexar Foto (Natal, Promoção, Banners)</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        PNG, JPG ou WebP de até 20 MB
                      </span>
                    </>
                  )}
                </Button>
              </div>
            )}

            <Textarea
              placeholder="Digite a mensagem que será enviada para todos os clientes selecionados..."
              className="min-h-36 resize-none"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              disabled={enviando}
            />

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{mensagem.length} caracteres</span>
              <span>{selecionados.size} cliente(s) selecionado(s)</span>
            </div>

            {resultado && (
              <div className="flex gap-3">
                <div className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  {resultado.enviados} enviados
                </div>
                {resultado.falhas > 0 && (
                  <div className="flex items-center gap-1.5 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                    <XCircle className="h-4 w-4" />
                    {resultado.falhas} falharam
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              {/* Botão Principal: Disparo Manual */}
              <Button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm gap-2"
                onClick={() => setModalManualAberto(true)}
                disabled={selecionados.size === 0 || (!mensagem.trim() && !fotoUrl)}
              >
                <Smartphone className="h-4 w-4" />
                Disparo Manual no WhatsApp ({selecionados.size})
              </Button>

              {/* Botão Secundário: Robô Evolution API */}
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 text-muted-foreground hover:text-foreground"
                onClick={enviarAutomaticoApi}
                disabled={enviando || (!mensagem.trim() && !fotoUrl) || selecionados.size === 0}
              >
                {enviando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Disparando via Robô...
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4" />
                    Disparar via Robô (Evolution API)
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Clientes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span>Destinatários</span>
                <Badge variant="outline">
                  {selecionados.size} / {clientesComTelefone.length}
                </Badge>
              </CardTitle>
              <button
                type="button"
                onClick={todosFiltradosSelecionados ? deselecionarTodos : selecionarTodos}
                className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
              >
                {todosFiltradosSelecionados ? (
                  <>
                    <Square className="h-3.5 w-3.5" /> Desmarcar todos
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-3.5 w-3.5" /> Marcar todos
                  </>
                )}
              </button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente por nome ou telefone..."
                className="pl-9"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>

            <div className="flex max-h-96 flex-col gap-1 overflow-y-auto pr-1">
              {clientesFiltrados.map((cliente) => {
                const ativo = selecionados.has(cliente.id)
                return (
                  <button
                    key={cliente.id}
                    type="button"
                    onClick={() => toggleCliente(cliente.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all border",
                      ativo
                        ? "bg-primary/10 border-primary/30 text-foreground shadow-xs"
                        : "border-transparent hover:bg-accent text-muted-foreground"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                        ativo
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {ativo && <span className="text-[10px] font-bold">✓</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{cliente.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{cliente.telefone}</p>
                    </div>
                  </button>
                )
              })}
              {clientesFiltrados.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum cliente encontrado com telefone.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Disparo Manual no WhatsApp */}
      <Dialog open={modalManualAberto} onOpenChange={setModalManualAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-border">
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <MessageCircle className="h-5 w-5 text-emerald-600" />
                Disparo Manual no WhatsApp
              </DialogTitle>
              <Badge variant="outline" className="text-xs">
                {qtdEnviadosManuais} de {listaSelecionados.length} abertos
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Abra a conversa de cada cliente no WhatsApp Web ou App. O texto já vai preenchido na mensagem!
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Aviso sobre a foto anexada */}
            {fotoUrl && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fotoUrl}
                    alt="Foto da campanha"
                    className="h-12 w-12 rounded object-cover border border-emerald-500/30 shrink-0"
                  />
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      Foto anexada para a campanha
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Clique em <b>Copiar Foto</b> e aperte <b>Ctrl + V</b> na conversa do WhatsApp para colar a imagem junto com o texto.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                    onClick={copiarFotoParaClipboard}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar Foto
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1"
                    onClick={baixarFoto}
                  >
                    <Download className="h-3.5 w-3.5" /> Baixar
                  </Button>
                </div>
              </div>
            )}

            {/* Progresso e Ação de Avanço Rápido */}
            <div className="rounded-lg border border-border bg-muted/30 p-3.5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">
                  Progresso do envio: {qtdEnviadosManuais} / {listaSelecionados.length} ({progressoPercent}%)
                </span>
                {enviadosManuais.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setEnviadosManuais(new Set())}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" /> Reiniciar contagem
                  </button>
                )}
              </div>
              <Progress value={progressoPercent} className="h-2" />

              {proximoPendente && (
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate max-w-[240px]">
                    Próximo: <b className="text-foreground">{proximoPendente.nome}</b>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs gap-1.5"
                    onClick={abrirProximo}
                  >
                    Abrir Próximo ({proximoPendente.nome})
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Lista de Contatos */}
            <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
              {listaSelecionados.map((cliente, index) => {
                const enviado = enviadosManuais.has(cliente.id)
                return (
                  <div
                    key={cliente.id}
                    className={cn(
                      "flex items-center justify-between p-3 gap-3 transition-colors",
                      enviado ? "bg-muted/20" : "bg-card hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-muted-foreground w-6 text-right shrink-0">
                        #{index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{cliente.nome}</p>
                          {enviado && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                              ✓ Aberto
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{cliente.telefone}</p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant={enviado ? "outline" : "default"}
                      className={cn(
                        "h-8 text-xs shrink-0 gap-1.5",
                        enviado
                          ? "text-muted-foreground hover:text-foreground"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white"
                      )}
                      onClick={() => abrirWhatsappCliente(cliente.telefone, cliente.id, cliente.nome)}
                    >
                      {enviado ? (
                        <>
                          <ExternalLink className="h-3 w-3" /> Reabrir
                        </>
                      ) : (
                        <>
                          <ExternalLink className="h-3 w-3" /> Abrir WhatsApp
                        </>
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border bg-muted/20 flex items-center justify-between sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {qtdEnviadosManuais === listaSelecionados.length
                ? "🎉 Todos os contatos foram abertos!"
                : `${listaSelecionados.length - qtdEnviadosManuais} contato(s) restante(s)`}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalManualAberto(false)}
            >
              Concluir / Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
