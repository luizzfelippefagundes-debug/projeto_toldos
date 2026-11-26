"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CreditCard, Copy, Check, ExternalLink } from "lucide-react"
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
  const [linkPagamento, setLinkPagamento] = useState<string | null>(linkInicial ?? null)
  const [gerandoLink, setGerandoLink] = useState(false)
  const [copiadoLink, setCopiadoLink] = useState(false)
  const [opcaoValor, setOpcaoValor] = useState<"total" | "entrada">("total")

  const valorCobrar = opcaoValor === "entrada" ? Math.round((valorTotal / 2) * 100) / 100 : valorTotal

  // Gerar Link de Pagamento no Mercado Pago
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
              Link do Cartão (12x)
            </Button>
          }
        />
      )}

      <DialogContent className="max-w-md p-5 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-2 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black tracking-tight">
                Link de Cartão (Mercado Pago)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Gere o link seguro para o cliente pagar no Cartão em até 12x.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Seletor de Valor (Total vs Entrada 50%) */}
        <div className="rounded-xl border border-border/70 bg-muted/30 p-3 flex items-center justify-between gap-2 mt-2">
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

        {/* Card do Link de Pagamento */}
        <div className="space-y-3 pt-2">
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
                Abrir Checkout ↗
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
