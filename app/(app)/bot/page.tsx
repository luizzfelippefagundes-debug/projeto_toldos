"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import Link from "next/link"
import { useData } from "@/context/data-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { formatarDataHora, formatarMoeda } from "@/lib/format"
import { linkWhatsapp } from "@/lib/whatsapp"
import { cn } from "@/lib/utils"
import {
  Bot,
  User,
  KeyRound,
  Smartphone,
  Copy,
  Loader2,
  Check,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  MessageSquare,
  FilePlus2,
  ExternalLink,
  Users,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  HelpCircle,
} from "lucide-react"
import { toast } from "sonner"
import type { MensagemBot } from "@/lib/types"

interface ContatoBot {
  id: string
  telefone: string
  nome: string
  clienteId?: string
  statusConversao: "fechado" | "aberto" | "nao_fechou"
  valorTotalFechado: number
  valorTotalAberto: number
  qtdOrcamentos: number
  qtdPedidos: number
  ultimoContato: Date
  ultimaMensagem: MensagemBot
  mensagens: MensagemBot[]
}

function normalizarTel(tel?: string): string {
  if (!tel) return ""
  return tel.replace(/\D/g, "").slice(-8)
}

export default function BotPage() {
  const { mensagensBot, clientes, orcamentos, pedidosRapidos } = useData()

  // Conexão por código de pareamento
  const [numeroPareamento, setNumeroPareamento] = useState("27997489714")
  const [gerandoCodigo, setGerandoCodigo] = useState(false)
  const [codigoPareamento, setCodigoPareamento] = useState<string | null>(null)
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [statusConexao, setStatusConexao] = useState<{
    checando: boolean
    conectado: boolean | null
    estado: string | null
  }>({
    checando: false,
    conectado: null,
    estado: null,
  })

  const verificarStatus = useCallback(async (silencioso = false) => {
    if (!silencioso) setStatusConexao((prev) => ({ ...prev, checando: true }))
    try {
      const res = await fetch("/api/bot/pareamento")
      const dados = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        conectado?: boolean
        estado?: string
      }
      setStatusConexao({
        checando: false,
        conectado: Boolean(dados.conectado),
        estado: dados.estado || "close",
      })
      if (!silencioso) {
        if (dados.conectado) {
          toast.success("WhatsApp está conectado e pronto para uso!")
        } else {
          toast.info("WhatsApp ainda não está conectado.")
        }
      }
    } catch {
      setStatusConexao({ checando: false, conectado: false, estado: "desconhecido" })
    }
  }, [])

  useEffect(() => {
    verificarStatus(true)
    const interval = setInterval(() => {
      verificarStatus(true)
    }, 20000)
    return () => clearInterval(interval)
  }, [verificarStatus])

  // Filtros do levantamento
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "fechado" | "aberto" | "nao_fechou">("todos")
  const [busca, setBusca] = useState("")

  // Modal de histórico da conversa com o bot
  const [conversaAberta, setConversaAberta] = useState<ContatoBot | null>(null)

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
        toast.warning("Código não gerado. Verifique se a instância está conectada.")
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

  // Agrupamento de contatos do bot com cruzamento de orçamentos e pedidos
  const contatosBot = useMemo<ContatoBot[]>(() => {
    const mapa = new Map<string, MensagemBot[]>()

    // Agrupa mensagens por telefone normalizado
    for (const m of mensagensBot) {
      const chave = normalizarTel(m.telefone) || m.clienteId || m.clienteNome
      if (!mapa.has(chave)) mapa.set(chave, [])
      mapa.get(chave)!.push(m)
    }

    const lista: ContatoBot[] = []

    for (const [chave, msgs] of mapa.entries()) {
      const msgsOrdenadas = [...msgs].sort(
        (a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime()
      )
      const ultima = msgsOrdenadas[msgsOrdenadas.length - 1]
      const primeira = msgsOrdenadas[0]

      // Localiza o cliente cadastrado (por id ou telefone)
      const cliente =
        clientes.find((c) => c.id === ultima.clienteId) ||
        clientes.find((c) => normalizarTel(c.telefone) === chave)

      const nome =
        cliente?.nome ||
        (ultima.clienteNome && ultima.clienteNome !== "Cliente" ? ultima.clienteNome : null) ||
        (primeira.clienteNome && primeira.clienteNome !== "Cliente" ? primeira.clienteNome : null) ||
        `Contato ${ultima.telefone}`

      const tel = cliente?.telefone || ultima.telefone

      // Orçamentos e pedidos desse contato
      const orcsDoCliente = cliente ? orcamentos.filter((o) => o.clienteId === cliente.id) : []
      const pedsDoCliente = pedidosRapidos.filter(
        (p) =>
          normalizarTel(p.clienteTelefone) === chave ||
          (cliente && p.clienteNome.toLowerCase().trim() === cliente.nome.toLowerCase().trim())
      )

      const orcsFechados = orcsDoCliente.filter((o) => o.status === "fechado")
      const orcsAbertos = orcsDoCliente.filter((o) => o.status === "aberto")
      const pedsValidos = pedsDoCliente

      const valorFechado =
        orcsFechados.reduce((acc, o) => acc + (o.totalFechado || 0), 0) +
        pedsValidos.reduce((acc, p) => acc + p.total, 0)

      const valorAberto = orcsAbertos.reduce((acc, o) => acc + (o.totalFechado || 0), 0)

      let statusConversao: "fechado" | "aberto" | "nao_fechou" = "nao_fechou"
      if (orcsFechados.length > 0 || pedsValidos.length > 0) {
        statusConversao = "fechado"
      } else if (orcsAbertos.length > 0) {
        statusConversao = "aberto"
      }

      lista.push({
        id: cliente?.id || chave,
        telefone: tel,
        nome,
        clienteId: cliente?.id,
        statusConversao,
        valorTotalFechado: valorFechado,
        valorTotalAberto: valorAberto,
        qtdOrcamentos: orcsDoCliente.length,
        qtdPedidos: pedsDoCliente.length,
        ultimoContato: new Date(ultima.criadoEm),
        ultimaMensagem: ultima,
        mensagens: msgsOrdenadas,
      })
    }

    // Ordena pelo último contato mais recente
    return lista.sort((a, b) => b.ultimoContato.getTime() - a.ultimoContato.getTime())
  }, [mensagensBot, clientes, orcamentos, pedidosRapidos])

  // Métricas de funil
  const totalContatos = contatosBot.length
  const fechados = useMemo(() => contatosBot.filter((c) => c.statusConversao === "fechado"), [contatosBot])
  const abertos = useMemo(() => contatosBot.filter((c) => c.statusConversao === "aberto"), [contatosBot])
  const naoFecharam = useMemo(() => contatosBot.filter((c) => c.statusConversao === "nao_fechou"), [contatosBot])

  const valorTotalConvertido = useMemo(
    () => fechados.reduce((acc, c) => acc + c.valorTotalFechado, 0),
    [fechados]
  )

  const valorTotalEmAberto = useMemo(
    () => abertos.reduce((acc, c) => acc + c.valorTotalAberto, 0),
    [abertos]
  )

  const taxaConversao = totalContatos > 0 ? Math.round((fechados.length / totalContatos) * 100) : 0

  // Filtros de busca e status
  const contatosFiltrados = useMemo(() => {
    return contatosBot.filter((c) => {
      if (filtroStatus !== "todos" && c.statusConversao !== filtroStatus) return false
      if (!busca.trim()) return true
      const termo = busca.toLowerCase().trim()
      return (
        c.nome.toLowerCase().includes(termo) ||
        c.telefone.includes(termo) ||
        c.ultimaMensagem.texto.toLowerCase().includes(termo)
      )
    })
  }, [contatosBot, filtroStatus, busca])

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <span>Central do Bot & WhatsApp</span>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              Ao vivo
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Levantamento dos contatos que chamaram no robô: quem fechou orçamento e quem ainda não fechou.
          </p>
        </div>
      </div>

      {/* Card Conectar por Código de Pareamento */}
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
            <KeyRound className="h-5 w-5 text-emerald-600" />
            Conectar WhatsApp à Distância (Código de 8 Dígitos — Sem QR Code)
          </CardTitle>
          <div className="flex items-center gap-2">
            {statusConexao.conectado === true ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                WhatsApp Conectado
              </span>
            ) : statusConexao.conectado === false ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                Desconectado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Verificando...
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs gap-1 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10"
              onClick={() => verificarStatus(false)}
              disabled={statusConexao.checando}
              title="Verificar se o WhatsApp já conectou"
            >
              <RefreshCw className={cn("h-3 w-3", statusConexao.checando && "animate-spin")} />
              Verificar Status
            </Button>
          </div>
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

              {/* Dica para erro do WhatsApp no iPhone */}
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3.5 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold">
                  <HelpCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Se aparecer &quot;Não é possível conectar novos dispositivos no momento&quot; no celular:</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  <li><b>Limite de 4 aparelhos:</b> No WhatsApp do dono, abra <i>Aparelhos Conectados</i> e desconecte computadores/sessões antigas que não usa mais.</li>
                  <li><b>Bloqueio temporário:</b> Feche o app do WhatsApp no iPhone de verdade (arraste para cima na troca de apps) e aguarde 5 a 10 minutos.</li>
                  <li><b>Oscilação de Wi-Fi:</b> Se ele estiver no Wi-Fi, peça para desligar o Wi-Fi e tentar pelos dados móveis (4G/5G).</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards de Métricas / Funil de Vendas do WhatsApp */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total de Contatos */}
        <Card className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Contatos via Bot</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold">{totalContatos}</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Pessoas que iniciaram conversa no WhatsApp
            </p>
          </div>
        </Card>

        {/* Fecharam Orçamento / Vendas */}
        <Card className="p-4 flex flex-col justify-between border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
            <span>Fecharam Venda (Clientes)</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {fechados.length}
              </span>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                ({taxaConversao}% de conversão)
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Total fechado: <b className="text-foreground">{formatarMoeda(valorTotalConvertido)}</b>
            </p>
          </div>
        </Card>

        {/* Orçamentos em Aberto */}
        <Card className="p-4 flex flex-col justify-between border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 text-xs font-semibold">
            <span>Orçamentos em Aberto</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                {abertos.length}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Negociando: <b className="text-foreground">{formatarMoeda(valorTotalEmAberto)}</b>
            </p>
          </div>
        </Card>

        {/* Não Fecharam / Apenas Dúvidas */}
        <Card className="p-4 flex flex-col justify-between border-slate-500/20 bg-muted/20">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Não Fecharam / Apenas Dúvidas</span>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">
                {naoFecharam.length}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Oportunidades para reativar e orçar
            </p>
          </div>
        </Card>
      </div>

      {/* Levantamento de Contatos com Filtros */}
      <Card>
        <CardHeader className="p-4 sm:p-5 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={filtroStatus === "todos" ? "default" : "outline"}
                className="h-8 text-xs rounded-lg"
                onClick={() => setFiltroStatus("todos")}
              >
                Todos ({totalContatos})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={filtroStatus === "fechado" ? "default" : "outline"}
                className={cn(
                  "h-8 text-xs rounded-lg",
                  filtroStatus === "fechado" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                )}
                onClick={() => setFiltroStatus("fechado")}
              >
                Fecharam ({fechados.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={filtroStatus === "aberto" ? "default" : "outline"}
                className={cn(
                  "h-8 text-xs rounded-lg",
                  filtroStatus === "aberto" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""
                )}
                onClick={() => setFiltroStatus("aberto")}
              >
                Em Aberto ({abertos.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={filtroStatus === "nao_fechou" ? "default" : "outline"}
                className="h-8 text-xs rounded-lg"
                onClick={() => setFiltroStatus("nao_fechou")}
              >
                Não Fecharam ({naoFecharam.length})
              </Button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone..."
                className="pl-8 h-8 text-xs"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-border overflow-hidden">
            {contatosFiltrados.map((contato) => {
              const linkWhats = linkWhatsapp(contato.telefone, "")
              return (
                <div
                  key={contato.id}
                  className="flex flex-col lg:flex-row lg:items-center justify-between p-4 gap-4 hover:bg-muted/40 transition-colors"
                >
                  {/* Identificação e Telefone */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-sm">
                      {contato.nome.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {contato.nome}
                        </span>
                        {contato.statusConversao === "fechado" && (
                          <Badge className="bg-emerald-600/10 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-500/20 text-[11px] h-5">
                            ✓ Fechou Venda ({formatarMoeda(contato.valorTotalFechado)})
                          </Badge>
                        )}
                        {contato.statusConversao === "aberto" && (
                          <Badge className="bg-amber-600/10 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border-amber-500/20 text-[11px] h-5">
                            ⏳ Orçamento Aberto ({formatarMoeda(contato.valorTotalAberto)})
                          </Badge>
                        )}
                        {contato.statusConversao === "nao_fechou" && (
                          <Badge variant="outline" className="text-muted-foreground text-[11px] h-5">
                            ⚪ Apenas Contato (Sem Venda)
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{contato.telefone}</span>
                        <span>·</span>
                        <span>Último contato: {formatarDataHora(contato.ultimoContato.toISOString())}</span>
                      </div>

                      {/* Prévia da última mensagem */}
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1.5 bg-muted/30 px-2 py-1 rounded border border-border/40">
                        <strong className="text-foreground">
                          {contato.ultimaMensagem.autor === "cliente" ? "Cliente: " : "Robô: "}
                        </strong>
                        {contato.ultimaMensagem.texto}
                      </p>
                    </div>
                  </div>

                  {/* Ações Rápidas */}
                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => setConversaAberta(contato)}
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-primary" />
                      Ver Conversa ({contato.mensagens.length})
                    </Button>

                    {contato.statusConversao === "nao_fechou" && (
                      <Link
                        href={contato.clienteId ? `/orcamentos/novo?clienteId=${contato.clienteId}` : `/orcamentos/novo`}
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-emerald-500/30 text-xs font-medium text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                      >
                        <FilePlus2 className="h-3.5 w-3.5" />
                        Novo Orçamento
                      </Link>
                    )}

                    {linkWhats && (
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        onClick={() => window.open(linkWhats, "_blank")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        WhatsApp
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}

            {contatosFiltrados.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Nenhum contato encontrado com esse filtro.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal Histórico da Conversa com o Bot */}
      <Dialog open={!!conversaAberta} onOpenChange={(aberto) => !aberto && setConversaAberta(null)}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl rounded-2xl">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-card">
            <div className="flex items-center justify-between pr-8">
              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold truncate flex items-center gap-2">
                  <span>{conversaAberta?.nome}</span>
                  {conversaAberta?.statusConversao === "fechado" && (
                    <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                      Fechou Venda
                    </Badge>
                  )}
                  {conversaAberta?.statusConversao === "nao_fechou" && (
                    <Badge variant="outline" className="text-muted-foreground text-[10px]">
                      Não Fechou
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {conversaAberta?.telefone} · {conversaAberta?.mensagens.length} mensagem(ns) com o robô
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-muted/10">
            {conversaAberta?.mensagens.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  m.autor === "cliente" ? "justify-start" : "justify-end"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] sm:max-w-md rounded-2xl px-4 py-2.5 text-xs sm:text-sm shadow-xs",
                    m.autor === "cliente"
                      ? "bg-card border border-border/80 text-foreground rounded-tl-xs"
                      : "bg-emerald-600 text-white rounded-tr-xs"
                  )}
                >
                  <div
                    className={cn(
                      "mb-1 flex items-center gap-1.5 text-[10px] font-medium",
                      m.autor === "cliente" ? "text-muted-foreground" : "text-emerald-100"
                    )}
                  >
                    {m.autor === "cliente" ? (
                      <>
                        <User className="h-3 w-3" />
                        <span>{conversaAberta.nome}</span>
                      </>
                    ) : (
                      <>
                        <Bot className="h-3 w-3" />
                        <span>Robô Toldos Print</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{formatarDataHora(m.criadoEm)}</span>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.texto}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-border bg-card flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {conversaAberta?.statusConversao === "fechado"
                ? `Total comprado: ${formatarMoeda(conversaAberta.valorTotalFechado)}`
                : "Ainda não realizou compra ou pedido"}
            </span>
            <div className="flex items-center gap-2">
              {conversaAberta && linkWhatsapp(conversaAberta.telefone, "") && (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  onClick={() => window.open(linkWhatsapp(conversaAberta.telefone, "")!, "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir no WhatsApp
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setConversaAberta(null)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
