"use client"

import { useState, useMemo } from "react"
import {
  simularParcelasMercadoPago,
  formatarSimulacaoParaWhatsapp,
  type ModoSimulacaoTaxa,
} from "@/lib/mercadopago-taxas"
import { formatarMoeda } from "@/lib/format"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Calculator,
  Copy,
  Check,
  CreditCard,
  Percent,
  TrendingDown,
  TrendingUp,
  MessageCircle,
  ExternalLink,
  HelpCircle,
  Sparkles,
} from "lucide-react"

interface SimuladorTaxasCardProps {
  valorInicial?: number
  onGerarLink?: (valor: number, parcelas: number) => void
}

export function SimuladorTaxasCard({ valorInicial = 560 }: SimuladorTaxasCardProps) {
  const [valorInput, setValorInput] = useState<string>(String(valorInicial || 560))
  const [modo, setModo] = useState<ModoSimulacaoTaxa>("repassar")
  const [parcelaSelecionada, setParcelaSelecionada] = useState<number>(3) // Padrão 3x como Kaio mencionou
  const [copiado, setCopiado] = useState(false)
  const [telefoneWhatsapp, setTelefoneWhatsapp] = useState("")
  const [nomeCliente, setNomeCliente] = useState("")
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState(false)
  const [gerandoLink, setGerandoLink] = useState(false)
  const [linkGerado, setLinkGerado] = useState<string | null>(null)

  const valorNumerico = useMemo(() => {
    const limpo = valorInput.replace(/[^\d.,]/g, "").replace(",", ".")
    const num = parseFloat(limpo)
    return isNaN(num) || num <= 0 ? 0 : num
  }, [valorInput])

  const simulacoes = useMemo(() => {
    return simularParcelasMercadoPago(valorNumerico, modo)
  }, [valorNumerico, modo])

  const parcelaFoco = useMemo(() => {
    return simulacoes.find((s) => s.parcelas === parcelaSelecionada) || simulacoes[2] || simulacoes[0]
  }, [simulacoes, parcelaSelecionada])

  const simulacaoRepassando = useMemo(() => {
    return simularParcelasMercadoPago(valorNumerico, "repassar").find((s) => s.parcelas === parcelaSelecionada)
  }, [valorNumerico, parcelaSelecionada])

  const simulacaoAbsorvendo = useMemo(() => {
    return simularParcelasMercadoPago(valorNumerico, "absorver").find((s) => s.parcelas === parcelaSelecionada)
  }, [valorNumerico, parcelaSelecionada])

  const handleCopiarSimulacao = () => {
    if (valorNumerico <= 0) {
      toast.error("Informe um valor válido para simular.")
      return
    }
    const texto = formatarSimulacaoParaWhatsapp(valorNumerico, simulacoes, modo, nomeCliente)
    navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
    toast.success("Condições de parcelamento copiadas para colar no WhatsApp!")
  }

  const handleEnviarWhatsapp = async () => {
    if (valorNumerico <= 0) {
      toast.error("Informe um valor válido.")
      return
    }
    if (!telefoneWhatsapp) {
      toast.error("Digite o número de WhatsApp do cliente.")
      return
    }

    setEnviandoWhatsapp(true)
    try {
      const texto = formatarSimulacaoParaWhatsapp(valorNumerico, simulacoes, modo, nomeCliente)
      const res = await fetch("/api/whatsapp/enviar-notificacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefone: telefoneWhatsapp,
          mensagem: texto,
          clienteNome: nomeCliente || "Cliente",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        throw new Error(data.erro || "Falha no envio automático do robô")
      }
      toast.success("Simulação de parcelamento enviada no WhatsApp do cliente!")
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar mensagem pelo robô.")
    } finally {
      setEnviandoWhatsapp(false)
    }
  }

  const handleGerarLink = async () => {
    if (valorNumerico <= 0) {
      toast.error("Informe um valor válido.")
      return
    }
    setGerandoLink(true)
    try {
      const res = await fetch("/api/mercadopago/criar-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valor: parcelaFoco?.valorTotalCliente || valorNumerico,
          descricao: `Pedido Toldos Print - Cartão em até ${parcelaSelecionada}x`,
          clienteNome: nomeCliente || "Cliente",
          clienteTelefone: telefoneWhatsapp || undefined,
          parcelasMaximas: parcelaSelecionada,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.linkPagamento) {
        throw new Error(data.erro || "Falha ao gerar link no Mercado Pago")
      }
      setLinkGerado(data.linkPagamento)
      toast.success("Link Mercado Pago gerado com sucesso!")
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar link.")
    } finally {
      setGerandoLink(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho da Ferramenta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
            <Calculator className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground flex items-center gap-2">
              <span>Simulador de Cartão & Taxas Mercado Pago</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300">
                Oficial Point & Link
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Calcule na hora quanto fica a parcela em 3x (ou até 12x), quanto a gráfica recebe limpo e evite cobrar juros em dobro do cliente.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopiarSimulacao}
            className="text-xs font-bold gap-1.5 cursor-pointer shadow-xs"
          >
            {copiado ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiado ? "Copiado!" : "Copiar Tabela (Zap)"}</span>
          </Button>
        </div>
      </div>

      {/* Bloco de Entrada de Valor e Seleção de Modo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Lado Esquerdo: Valor e Modos */}
        <div className="lg:col-span-5 flex flex-col gap-4 p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-2xs">
          <div>
            <Label htmlFor="valor-simular" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Valor Base do Orçamento (R$)
            </Label>
            <div className="relative mt-1.5">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                R$
              </span>
              <Input
                id="valor-simular"
                type="number"
                step="0.01"
                min="1"
                value={valorInput}
                onChange={(e) => setValorInput(e.target.value)}
                placeholder="Ex: 560,00"
                className="pl-10 text-xl font-black h-12 rounded-xl"
              />
            </div>

            {/* Sugestões rápidas de valores */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[10px] font-semibold text-muted-foreground mr-1">Rápido:</span>
              {[150, 300, 560, 1000, 2500].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setValorInput(String(v))}
                  className={cn(
                    "text-[11px] font-bold px-2 py-0.5 rounded-md border transition-all cursor-pointer",
                    valorNumerico === v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground border-border/80"
                  )}
                >
                  R$ {v}
                </button>
              ))}
            </div>
          </div>

          {/* Seleção do Modo de Cobrança */}
          <div className="flex flex-col gap-2 pt-2 border-t border-border/70">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Como você combinou com o cliente?</span>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </Label>

            <div className="grid grid-cols-1 gap-2">
              {/* Opção 1 (Padrão): Repassar juros / Somar taxa do Mercado Pago */}
              <button
                type="button"
                onClick={() => setModo("repassar")}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5",
                  modo === "repassar"
                    ? "border-blue-500 bg-blue-500/10 text-foreground ring-1 ring-blue-500"
                    : "border-border/80 bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                )}
              >
                <div className="mt-0.5 p-1 rounded-md bg-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>Repassar Taxa do Mercado Pago para o Cliente (Com Juros)</span>
                    <span className="text-[10px] bg-blue-600 text-white font-black px-1.5 py-0.2 rounded">Recomendado</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {formatarMoeda(valorNumerico)} é o preço à vista. O sistema <strong>adiciona as taxas de parcelamento do Mercado Pago</strong> no valor que o cliente paga, para a gráfica receber o valor integral.
                  </div>
                </div>
              </button>

              {/* Opção 2: Valor já inclui juros (Absorver) */}
              <button
                type="button"
                onClick={() => setModo("absorver")}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5",
                  modo === "absorver"
                    ? "border-emerald-500 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500"
                    : "border-border/80 bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                )}
              >
                <div className="mt-0.5 p-1 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">
                    Preço Já Fechado no Cartão (Gráfica Absorve a Taxa / Sem Juros pro Cliente)
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    Você já passou <strong>{formatarMoeda(valorNumerico)}</strong> fechado. O cliente paga esse valor exato dividido em parcelas e a gráfica assume o desconto cobrado pelo Mercado Pago.
                  </div>
                </div>
              </button>

              {/* Opção 3: Cálculo Reverso */}
              <button
                type="button"
                onClick={() => setModo("reverso")}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5",
                  modo === "reverso"
                    ? "border-amber-500 bg-amber-500/10 text-foreground ring-1 ring-amber-500"
                    : "border-border/80 bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                )}
              >
                <div className="mt-0.5 p-1 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                  <Percent className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">
                    Quero Receber {formatarMoeda(valorNumerico)} Líquido (Cálculo Reverso)
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    Calcula exatamente quanto você deve cobrar para sobrar exatos <strong>{formatarMoeda(valorNumerico)}</strong> na conta da empresa após descontar a taxa MP.
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Lado Direito: Card em Destaque da Parcela Selecionada (ex: 3x) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Seletor Rápido de Parcelas (1x a 12x) */}
          <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Selecione as Parcelas para Ver o Resultado:
            </span>
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setParcelaSelecionada(n)}
                  className={cn(
                    "py-2 rounded-xl text-xs font-black transition-all cursor-pointer border",
                    parcelaSelecionada === n
                      ? "bg-primary text-primary-foreground border-primary shadow-xs scale-105"
                      : "bg-muted/40 hover:bg-muted text-foreground border-border/80"
                  )}
                >
                  {n}x
                </button>
              ))}
            </div>
          </div>

          {/* Destaque Principal da Parcela (ex: 3x de R$ 186,67) */}
          {parcelaFoco && (
            <div className="p-5 rounded-2xl border-2 border-primary/30 bg-primary/5 dark:bg-primary/10 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    Opção Selecionada:
                  </span>
                  <div className="text-3xl font-black text-foreground tracking-tight flex items-baseline gap-2 mt-0.5">
                    <span>{parcelaFoco.parcelas}x de</span>
                    <span className="text-primary">{formatarMoeda(parcelaFoco.valorParcela)}</span>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[11px] font-bold text-muted-foreground block">Total Pago pelo Cliente</span>
                  <span className="text-xl font-black text-foreground">
                    {formatarMoeda(parcelaFoco.valorTotalCliente)}
                  </span>
                </div>
              </div>

              {/* Métricas Detalhadas: Taxa vs Líquido na Conta */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-card border border-border/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    {modo === "repassar" ? "Taxa do Parcelamento" : "Taxa Mercado Pago"}
                  </span>
                  <div className="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 shrink-0" />
                    <span>{parcelaFoco.taxaPercentual > 0 ? `+${parcelaFoco.taxaPercentual.toFixed(2)}%` : "0.00%"}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-0.5 block">
                    {modo === "repassar" ? "Juros pago pelo cliente" : modo === "absorver" ? "Descontado da gráfica" : "Taxa embutida"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    {modo === "repassar" ? "Acréscimo de Juros" : "Desconto em R$"}
                  </span>
                  <div className={cn("text-base font-black mt-0.5", modo === "repassar" ? "text-blue-600 dark:text-blue-400" : "text-destructive")}>
                    {modo === "repassar" ? `+ ${formatarMoeda(parcelaFoco.valorTaxaDescontada)}` : `− ${formatarMoeda(parcelaFoco.valorTaxaDescontada)}`}
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-0.5 block">
                    {modo === "repassar" ? "Adicionado no total" : "Retido pelo MP"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                    Líquido na sua Conta
                  </span>
                  <div className="text-base font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {formatarMoeda(parcelaFoco.valorLiquidoReceber)}
                  </div>
                  <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 block font-medium">
                    {modo === "repassar" ? "Valor integral à vista" : "Dinheiro limpo"}
                  </span>
                </div>
              </div>

              {/* Comparativo Imediato: Repassando vs Absorvendo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-card border border-border/80 shadow-2xs">
                <div
                  onClick={() => setModo("repassar")}
                  className={cn("p-2.5 rounded-lg border transition-all cursor-pointer", modo === "repassar" ? "border-blue-500/60 bg-blue-500/10 ring-1 ring-blue-500/30" : "border-border/60 bg-muted/20 hover:bg-muted/40")}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">Opção 1: Cliente paga os juros</span>
                    {modo === "repassar" && <span className="text-[9px] bg-blue-600 text-white font-black px-1.5 py-0.5 rounded">Ativo</span>}
                  </div>
                  <div className="text-sm font-black text-foreground mt-0.5">
                    {parcelaSelecionada}x de {formatarMoeda(simulacaoRepassando?.valorParcela || 0)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Total: <strong>{formatarMoeda(simulacaoRepassando?.valorTotalCliente || 0)}</strong> • Gráfica recebe {formatarMoeda(valorNumerico)} limpo
                  </div>
                </div>

                <div
                  onClick={() => setModo("absorver")}
                  className={cn("p-2.5 rounded-lg border transition-all cursor-pointer", modo === "absorver" ? "border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/30" : "border-border/60 bg-muted/20 hover:bg-muted/40")}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Opção 2: Gráfica absorve a taxa</span>
                    {modo === "absorver" && <span className="text-[9px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded">Ativo</span>}
                  </div>
                  <div className="text-sm font-black text-foreground mt-0.5">
                    {parcelaSelecionada}x de {formatarMoeda(simulacaoAbsorvendo?.valorParcela || 0)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Total: <strong>{formatarMoeda(simulacaoAbsorvendo?.valorTotalCliente || 0)}</strong> • Gráfica recebe {formatarMoeda(simulacaoAbsorvendo?.valorLiquidoReceber || 0)}
                  </div>
                </div>
              </div>

              {/* Botões de Ação Rápida */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <Button
                  type="button"
                  onClick={handleGerarLink}
                  disabled={gerandoLink}
                  className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 text-xs h-10 shadow-xs cursor-pointer"
                >
                  <CreditCard className="h-4 w-4 shrink-0" />
                  <span>{gerandoLink ? "Gerando Link..." : `Gerar Link de ${parcelaFoco.parcelas}x no Mercado Pago`}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopiarSimulacao}
                  className="w-full sm:w-auto font-bold text-xs h-10 gap-1.5 cursor-pointer shadow-xs"
                >
                  <Copy className="h-4 w-4" />
                  <span>Copiar Proposta</span>
                </Button>
              </div>

              {/* Exibição do Link Gerado se houver */}
              {linkGerado && (
                <div className="p-3 rounded-xl border border-blue-500/40 bg-blue-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
                  <div className="truncate text-xs">
                    <span className="font-bold text-blue-700 dark:text-blue-300 block">Link de Pagamento Criado:</span>
                    <a
                      href={linkGerado}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline font-medium truncate block max-w-sm"
                    >
                      {linkGerado}
                    </a>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(linkGerado)
                        toast.success("Link copiado!")
                      }}
                      className="h-8 text-xs font-bold gap-1"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copiar
                    </Button>
                    <a
                      href={linkGerado}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center h-8 px-3 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
                    >
                      Abrir ↗
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Disparo Direto no WhatsApp do Cliente */}
      <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-500/10 text-green-600 shrink-0">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Enviar Condições de Parcelamento no WhatsApp</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              O robô envia a tabela completa com as parcelas de 1x a 12x para o WhatsApp do cliente.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <Input
            placeholder="Nome do cliente (opcional)"
            value={nomeCliente}
            onChange={(e) => setNomeCliente(e.target.value)}
            className="text-xs h-9 w-full sm:w-44"
          />
          <Input
            placeholder="(27) 99999-9999"
            value={telefoneWhatsapp}
            onChange={(e) => setTelefoneWhatsapp(e.target.value)}
            className="text-xs h-9 w-full sm:w-36 font-medium"
          />
          <Button
            type="button"
            onClick={handleEnviarWhatsapp}
            disabled={enviandoWhatsapp}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-bold text-xs h-9 gap-1.5 shadow-xs cursor-pointer"
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            <span>{enviandoWhatsapp ? "Enviando..." : "Enviar Simulação"}</span>
          </Button>
        </div>
      </div>

      {/* Tabela Completa de 1x a 12x */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-border/80 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <span className="text-xs sm:text-sm font-bold text-foreground">
              Tabela Completa de Parcelamento no Cartão (1x a 12x)
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground font-medium">
            Valor base: {formatarMoeda(valorNumerico)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
                <th className="py-2.5 px-4">Parcelas</th>
                <th className="py-2.5 px-4">Valor da Parcela</th>
                <th className="py-2.5 px-4">Total Cliente</th>
                <th className="py-2.5 px-4">Taxa MP</th>
                <th className="py-2.5 px-4">Desconto MP</th>
                <th className="py-2.5 px-4 font-black text-emerald-700 dark:text-emerald-400">
                  Líquido Toldos Print
                </th>
                <th className="py-2.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {simulacoes.map((s) => {
                const ehSelecionada = s.parcelas === parcelaSelecionada
                return (
                  <tr
                    key={s.parcelas}
                    onClick={() => setParcelaSelecionada(s.parcelas)}
                    className={cn(
                      "transition-colors cursor-pointer",
                      ehSelecionada
                        ? "bg-primary/10 font-bold"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-black",
                        ehSelecionada ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      )}>
                        {s.parcelas}x
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-bold text-foreground whitespace-nowrap">
                      {formatarMoeda(s.valorParcela)}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-foreground whitespace-nowrap">
                      {formatarMoeda(s.valorTotalCliente)}
                    </td>
                    <td className="py-2.5 px-4 text-amber-700 dark:text-amber-400 font-bold whitespace-nowrap">
                      {s.taxaPercentual > 0 ? `${s.taxaPercentual.toFixed(2)}%` : "0% (à vista)"}
                    </td>
                    <td className="py-2.5 px-4 text-destructive font-medium whitespace-nowrap">
                      − {formatarMoeda(s.valorTaxaDescontada)}
                    </td>
                    <td className="py-2.5 px-4 font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {formatarMoeda(s.valorLiquidoReceber)}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setParcelaSelecionada(s.parcelas)
                          const msg = `• Em ${s.parcelas}x de ${formatarMoeda(s.valorParcela)} (Total: ${formatarMoeda(s.valorTotalCliente)}) no cartão Mercado Pago.`
                          navigator.clipboard.writeText(msg)
                          toast.success(`Opção de ${s.parcelas}x copiada!`)
                        }}
                        className="py-1 px-2.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-[11px] font-bold border border-border/80 transition-all active:scale-95 cursor-pointer"
                      >
                        Copiar {s.parcelas}x
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
