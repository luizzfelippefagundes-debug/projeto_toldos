"use client"

import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CreditCard, Copy, Check, Calculator, Sparkles, TrendingUp } from "lucide-react"
import { formatarMoeda } from "@/lib/format"
import {
  simularParcelasMercadoPago,
  formatarSimulacaoParaWhatsapp,
  type ModoSimulacaoTaxa,
} from "@/lib/mercadopago-taxas"
import { toast } from "sonner"

interface Props {
  valorInicial?: number
  nomeCliente?: string
  trigger?: React.ReactElement
}

export function SimuladorMercadoPagoDialog({
  valorInicial = 0,
  nomeCliente,
  trigger,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [valorCustomizado, setValorCustomizado] = useState(
    valorInicial > 0 ? String(valorInicial) : ""
  )
  const [modo, setModo] = useState<ModoSimulacaoTaxa>("repassar")
  const [copiado, setCopiado] = useState(false)

  const valor = Number(valorCustomizado) || valorInicial || 0
  const parcelas = useMemo(() => simularParcelasMercadoPago(valor, modo), [valor, modo])

  const copiarMensagemWhatsapp = async () => {
    if (parcelas.length === 0) return
    const texto = formatarSimulacaoParaWhatsapp(valor, parcelas, modo, nomeCliente)
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      toast.success("Condições de parcelamento copiadas! É só colar no WhatsApp do cliente.")
      setTimeout(() => setCopiado(false), 3000)
    } catch {
      toast.error("Não foi possível copiar automaticamente.")
    }
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v)
        if (v && valorInicial > 0) {
          setValorCustomizado(String(valorInicial))
        }
      }}
    >
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
              Simular Cartão (Mercado Pago)
            </Button>
          }
        />
      )}

      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-2 border-b border-border/60">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black tracking-tight">
                  Simulador de Parcelas (Mercado Pago)
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Cálculo oficial de juros do comprador (1x a 12x) para passar no WhatsApp.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="secondary" className="text-[10px] uppercase font-bold shrink-0">
              Taxas MP
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
          {/* Campo para editar o valor simulado caso deseje testar outro valor */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <Label htmlFor="valorSimular" className="text-xs font-bold text-muted-foreground">
                Valor a ser parcelado:
              </Label>
              <div className="text-lg font-black text-foreground mt-0.5">
                {formatarMoeda(valor)}
              </div>
            </div>

            <div className="w-full sm:w-44">
              <Label htmlFor="valorInput" className="text-[11px] text-muted-foreground block mb-1">
                Alterar valor (R$):
              </Label>
              <Input
                id="valorInput"
                type="number"
                step="0.01"
                min="1"
                value={valorCustomizado}
                onChange={(e) => setValorCustomizado(e.target.value)}
                placeholder="Ex: 1500"
                className="h-9 text-xs font-bold rounded-lg"
              />
            </div>
          </div>

          {/* Seletor do Modo de Cálculo */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/50 rounded-xl border border-border/60">
            <button
              type="button"
              onClick={() => setModo("repassar")}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                modo === "repassar"
                  ? "bg-background text-blue-600 dark:text-blue-400 shadow-xs border border-border/80 font-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
              <span>Com Juros (Cliente assume)</span>
            </button>
            <button
              type="button"
              onClick={() => setModo("absorver")}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                modo === "absorver"
                  ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs border border-border/80 font-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
              <span>Sem Juros (Gráfica assume)</span>
            </button>
          </div>

          {/* Grid de parcelas de 1x a 12x */}
          {valor > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {parcelas.map((p) => {
                const destaque = p.parcelas === 1 || p.parcelas === 6 || p.parcelas === 12
                return (
                  <div
                    key={p.parcelas}
                    className={`rounded-xl border p-2.5 flex items-center justify-between transition-colors ${
                      destaque
                        ? "border-blue-500/40 bg-blue-500/5 dark:bg-blue-950/20"
                        : "border-border/70 bg-card"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-sm text-foreground">
                          {p.parcelas}x de {formatarMoeda(p.valorParcela)}
                        </span>
                        {p.parcelas === 1 ? (
                          <span className="rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-black px-1.5 py-0.5">
                            À vista
                          </span>
                        ) : p.temJuros ? (
                          <span className="rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px] font-black px-1.5 py-0.5">
                            +{p.taxaPercentual}%
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-black px-1.5 py-0.5">
                            Sem juros
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground block">
                        Total: {formatarMoeda(p.valorTotal)}
                        {p.temJuros && p.valorTaxaDescontada > 0
                          ? ` (+${formatarMoeda(p.valorTaxaDescontada)})`
                          : ""}
                      </span>
                    </div>

                    <span className="text-xs font-black text-muted-foreground/60">
                      #{p.parcelas}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Digite um valor acima de R$ 0,00 para ver as parcelas.
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 pt-2 border-t border-border/60 flex flex-col sm:flex-row gap-2 sm:justify-between items-center">
          <Button
            type="button"
            onClick={copiarMensagemWhatsapp}
            disabled={valor <= 0}
            className="w-full sm:w-auto font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          >
            {copiado ? (
              <>
                <Check className="h-4 w-4" />
                Copiado com Sucesso!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copiar Tabela para WhatsApp 📲
              </>
            )}
          </Button>

          <Button variant="outline" onClick={() => setAberto(false)} className="w-full sm:w-auto">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
