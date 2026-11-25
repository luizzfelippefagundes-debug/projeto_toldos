"use client"

import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { CreditCard, Link as LinkIcon, Radio, Copy, Check, ExternalLink, RefreshCw, XCircle, CheckCircle2 } from "lucide-react"
import { formatarMoeda } from "@/lib/format"
import { toast } from "sonner"

interface Props {
  orcamentoId?: string
  numeroOrcamento?: number
  valorTotal: number
  nomeCliente?: string
  telefoneCliente?: string
  linkInicial?: string | null
  trigger?: React.ReactElement
}

interface Maquininha {
  id: string
  nomeAmigavel?: string
  operating_mode?: string
}

export function CobrancaCartaoDialog({
  orcamentoId,
  numeroOrcamento,
  valorTotal,
  nomeCliente,
  telefoneCliente,
  linkInicial,
  trigger,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [abaAtiva, setAbaAtiva] = useState<"link" | "maquininha">("link")

  // Link de Pagamento
  const [linkPagamento, setLinkPagamento] = useState<string | null>(linkInicial ?? null)
  const [gerandoLink, setGerandoLink] = useState(false)
  const [copiadoLink, setCopiadoLink] = useState(false)
  const [opcaoValor, setOpcaoValor] = useState<"total" | "entrada">("total")

  // Maquininha Point
  const [maquininhas, setMaquininhas] = useState<Maquininha[]>([])
  const [maquininhaSelecionada, setMaquininhaSelecionada] = useState<string>("")
  const [carregandoMaquininhas, setCarregandoMaquininhas] = useState(false)
  const [enviandoParaPoint, setEnviandoParaPoint] = useState(false)
  const [activeIntentId, setActiveIntentId] = useState<string | null>(null)
  const [pointStatus, setPointStatus] = useState<"IDLE" | "WAITING" | "APPROVED" | "CANCELLED">("IDLE")
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const valorCobrar = opcaoValor === "entrada" ? Math.round((valorTotal / 2) * 100) / 100 : valorTotal

  // Carrega lista de maquininhas ao abrir
  useEffect(() => {
    if (aberto && maquininhas.length === 0) {
      setCarregandoMaquininhas(true)
      fetch("/api/mercadopago/point")
        .then((r) => r.json())
        .then((d) => {
          if (d.ok && Array.isArray(d.maquininhas) && d.maquininhas.length > 0) {
            setMaquininhas(d.maquininhas)
            setMaquininhaSelecionada(d.maquininhas[0].id)
          }
        })
        .catch(() => {})
        .finally(() => setCarregandoMaquininhas(false))
    }
  }, [aberto, maquininhas.length])

  // Limpa polling se fechar
  useEffect(() => {
    if (!aberto && pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [aberto])

  // Gerar Link de Pagamento
  async function gerarOuCopiarLink() {
    if (linkPagamento) {
      navigator.clipboard.writeText(linkPagamento)
      setCopiadoLink(true)
      toast.success("Link de pagamento com Cartão copiado! (Até 12x)")
      setTimeout(() => setCopiadoLink(false), 3000)
      return
    }

    setGerandoLink(true)
    try {
      const res = await fetch("/api/mercadopago/criar-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orcamentoId,
          valor: valorCobrar,
          descricao: `Orçamento #${numeroOrcamento || ""} - Toldos Print`,
        }),
      })
      const data = await res.json()
      if (data.ok && data.linkPagamento) {
        setLinkPagamento(data.linkPagamento)
        navigator.clipboard.writeText(data.linkPagamento)
        setCopiadoLink(true)
        toast.success("Link de Cartão gerado e copiado! É só colar no WhatsApp do cliente.")
        setTimeout(() => setCopiadoLink(false), 3000)
      } else {
        toast.error(data.erro || "Não foi possível gerar link no Mercado Pago")
      }
    } catch {
      toast.error("Erro ao gerar link de pagamento.")
    } finally {
      setGerandoLink(false)
    }
  }

  // Enviar cobrança para a Maquininha Point
  async function enviarParaMaquininha() {
    if (!maquininhaSelecionada) {
      toast.error("Nenhuma maquininha selecionada.")
      return
    }

    setEnviandoParaPoint(true)
    setPointStatus("WAITING")
    try {
      const res = await fetch("/api/mercadopago/point", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orcamentoId,
          deviceId: maquininhaSelecionada,
          valor: valorCobrar,
        }),
      })
      const data = await res.json()
      if (data.ok && data.intentId) {
        setActiveIntentId(data.intentId)
        toast.success(`Cobrança enviada para o visor da Maquininha! (${formatarMoeda(valorCobrar)})`)

        // Inicia polling a cada 2.5s para checar status
        if (pollingRef.current) clearInterval(pollingRef.current)
        pollingRef.current = setInterval(async () => {
          try {
            const resStatus = await fetch(`/api/mercadopago/point?intentId=${data.intentId}`)
            const jsonStatus = await resStatus.json()
            if (jsonStatus.ok && jsonStatus.dados) {
              const st = jsonStatus.dados.status
              if (st === "PROCESSED") {
                setPointStatus("APPROVED")
                if (pollingRef.current) clearInterval(pollingRef.current)
                toast.success("🎉 Cartão Aprovado na Maquininha com Sucesso!")
              } else if (st === "CANCELED" || st === "ABANDONED") {
                setPointStatus("CANCELLED")
                if (pollingRef.current) clearInterval(pollingRef.current)
                toast.info("Cobrança cancelada na maquininha.")
              }
            }
          } catch {}
        }, 2500)
      } else {
        setPointStatus("IDLE")
        toast.error(data.erro || "Falha ao enviar cobrança para a maquininha")
      }
    } catch {
      setPointStatus("IDLE")
      toast.error("Erro de comunicação com a maquininha.")
    } finally {
      setEnviandoParaPoint(false)
    }
  }

  // Cancelar cobrança ativa na Maquininha
  async function cancelarNaMaquininha() {
    if (!activeIntentId || !maquininhaSelecionada) return
    try {
      await fetch("/api/mercadopago/point", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: maquininhaSelecionada,
          intentId: activeIntentId,
        }),
      })
      if (pollingRef.current) clearInterval(pollingRef.current)
      setPointStatus("IDLE")
      setActiveIntentId(null)
      toast.info("Cobrança cancelada na maquininha.")
    } catch {
      toast.error("Erro ao cancelar.")
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      {trigger ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 font-bold text-xs h-9 rounded-xl border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300"
            >
              <CreditCard className="h-4 w-4" />
              Cobrar no Cartão (Link / Maquininha)
            </Button>
          }
        />
      )}

      <DialogContent className="max-w-lg p-5 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-2 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black tracking-tight">
                Cobrança por Cartão (Mercado Pago)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Escolha se o cliente paga pelo celular à distância ou na Maquininha física do balcão.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Seletor de Valor (Total vs Entrada 50%) */}
        <div className="rounded-xl border border-border/70 bg-muted/30 p-3 flex items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground uppercase block">
              Valor da Cobrança:
            </span>
            <span className="text-base font-black text-foreground">
              {formatarMoeda(valorCobrar)}
            </span>
          </div>

          <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setOpcaoValor("total")
                setLinkPagamento(null)
              }}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                opcaoValor === "total"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Total ({formatarMoeda(valorTotal)})
            </button>
            <button
              type="button"
              onClick={() => {
                setOpcaoValor("entrada")
                setLinkPagamento(null)
              }}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                opcaoValor === "entrada"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Entrada 50% ({formatarMoeda(valorTotal / 2)})
            </button>
          </div>
        </div>

        {/* Abas: Opção 1 (Link Celular) vs Opção 3 (Maquininha Balcão) */}
        <div className="flex rounded-xl bg-muted/60 p-1 border border-border/70">
          <button
            type="button"
            onClick={() => setAbaAtiva("link")}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              abaAtiva === "link"
                ? "bg-background text-foreground shadow-2xs border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LinkIcon className="h-3.5 w-3.5" />
            1. Link Celular (WhatsApp)
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva("maquininha")}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              abaAtiva === "maquininha"
                ? "bg-background text-foreground shadow-2xs border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            2. Maquininha Física (Point)
          </button>
        </div>

        {/* ABA 1: LINK DE PAGAMENTO (CELULAR / WHATSAPP) */}
        {abaAtiva === "link" && (
          <div className="space-y-3 pt-1">
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Link de Pagamento Oficial
                </span>
                <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300">
                  Até 12x no Cartão
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                O cliente abre no celular dele e paga no <strong>Cartão de Crédito em até 12x</strong> ou <strong>Débito</strong>. O sistema reconhece a baixa automaticamente!
              </p>

              {linkPagamento && (
                <div className="p-2 rounded-lg bg-background border border-border text-[11px] font-mono break-all select-all text-muted-foreground">
                  {linkPagamento}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <Button
                type="button"
                onClick={gerarOuCopiarLink}
                disabled={gerandoLink}
                className="flex-1 font-bold gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
              >
                {copiadoLink ? (
                  <>
                    <Check className="h-4 w-4" />
                    Link Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    {linkPagamento ? "Copiar Link de Cartão" : "Gerar Link de Cartão (12x)"}
                  </>
                )}
              </Button>

              {linkPagamento && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.open(linkPagamento, "_blank")}
                  className="font-bold gap-1.5"
                >
                  <ExternalLink className="h-4 w-4" />
                  Testar / Abrir Checkout ↗
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ABA 2: MAQUININHA FÍSICA POINT (BALCÃO) */}
        {abaAtiva === "maquininha" && (
          <div className="space-y-3 pt-1">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <Radio className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Terminal Físico na Fábrica / Loja
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              {carregandoMaquininhas ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                  Buscando maquininhas conectadas...
                </div>
              ) : maquininhas.length > 0 ? (
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-muted-foreground">
                    Maquininha Detectada:
                  </Label>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                    <span className="text-xs font-bold text-foreground">
                      📱 {maquininhas[0].nomeAmigavel || maquininhas[0].id}
                    </span>
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                      Online
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200">
                  Nenhuma maquininha Point encontrada no momento. Verifique se o aparelho está ligado.
                </div>
              )}

              {/* Status ao vivo da Maquininha */}
              {pointStatus === "WAITING" && (
                <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-3 flex items-center gap-3 animate-pulse">
                  <RefreshCw className="h-5 w-5 text-blue-600 animate-spin shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold text-blue-900 dark:text-blue-200">
                      Cobrança enviada para o visor da Maquininha!
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      Aguardando cliente inserir ou aproximar o cartão...
                    </p>
                  </div>
                </div>
              )}

              {pointStatus === "APPROVED" && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-3 flex items-center gap-2.5 text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div className="text-xs">
                    <p className="font-bold text-sm">✓ Cartão Aprovado com Sucesso!</p>
                    <p className="text-[11px]">O pedido e o financeiro já foram atualizados.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              {pointStatus === "WAITING" ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={cancelarNaMaquininha}
                  className="w-full font-bold gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar Cobrança na Maquininha
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={enviarParaMaquininha}
                  disabled={enviandoParaPoint || maquininhas.length === 0}
                  className="w-full font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  <Radio className="h-4 w-4" />
                  {enviandoParaPoint
                    ? "Enviando..."
                    : `Cobrar ${formatarMoeda(valorCobrar)} na Maquininha Point`}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
