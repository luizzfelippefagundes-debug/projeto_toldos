"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LancamentoFormDialog } from "@/components/financeiro/lancamento-form-dialog"
import { useData } from "@/context/data-context"
import { formatarData, formatarMoeda } from "@/lib/format"
import { estaLancamentoVencido } from "@/lib/financeiro"
import { resumirSerie } from "@/lib/series"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { LancamentoFinanceiro } from "@/lib/types"
import { MessageCircle, Pencil, Receipt, Trash2, CheckCircle2, Clock, DollarSign } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const rotuloFormaPagamento: Record<string, string> = {
  boleto: "Boleto",
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  transferencia: "Transferência",
}

export function LancamentoDetalheDialog({
  lancamento,
  onOpenChange,
  hoje,
}: {
  lancamento: LancamentoFinanceiro | null
  onOpenChange: (open: boolean) => void
  hoje: Date | null
}) {
  const { clientes, lancamentos, updateLancamento, addLancamento, marcarLancamentoStatus, removeLancamento, addMensagemBot } = useData()
  const router = useRouter()
  const [confirmarRemocao, setConfirmarRemocao] = useState(false)
  const [editAberto, setEditAberto] = useState(false)
  const [quantasPagas, setQuantasPagas] = useState("")
  const [modoBaixaFlexivel, setModoBaixaFlexivel] = useState(false)
  const [valorRecebido, setValorRecebido] = useState("")
  const [formaPagamentoRecebida, setFormaPagamentoRecebida] = useState<string>("pix")

  if (!lancamento) return null

  const cliente = clientes.find((c) => c.id === lancamento.clienteId)
  const vencido = hoje ? estaLancamentoVencido(lancamento, hoje) : false

  const outrosDoOrcamento =
    lancamento.origem === "orcamento" && lancamento.origemId
      ? lancamentos.filter(
          (l) => l.origem === "orcamento" && l.origemId === lancamento.origemId && l.id !== lancamento.id
        )
      : []
  const outroPendente = outrosDoOrcamento.find((l) => l.status !== "pago")

  function confirmarBaixaFlexivel() {
    if (!lancamento) return
    const v = Number(valorRecebido)
    if (!Number.isFinite(v) || v <= 0) {
      toast.error("Informe um valor válido maior que zero.")
      return
    }

    const agora = new Date().toISOString()
    const diff = Math.round((v - lancamento.valor) * 100) / 100

    if (outroPendente) {
      if (diff > 0) {
        // Pagou mais do que o previsto da entrada
        if (v >= Math.round((lancamento.valor + outroPendente.valor) * 100) / 100) {
          // Valor quita integralmente o orçamento!
          updateLancamento(lancamento.id, {
            ...lancamento,
            status: "pago",
            pagoEm: agora,
            formaPagamento: formaPagamentoRecebida as any,
          })
          updateLancamento(outroPendente.id, {
            ...outroPendente,
            status: "pago",
            pagoEm: agora,
            formaPagamento: formaPagamentoRecebida as any,
          })
          toast.success(`Orçamento quitado integralmente no valor de ${formatarMoeda(v)}!`)
        } else {
          // Abate o excesso do restante
          const novoRestante = Math.round((outroPendente.valor - diff) * 100) / 100
          updateLancamento(lancamento.id, {
            ...lancamento,
            valor: v,
            status: "pago",
            pagoEm: agora,
            formaPagamento: formaPagamentoRecebida as any,
          })
          updateLancamento(outroPendente.id, {
            ...outroPendente,
            valor: novoRestante,
          })
          toast.success(
            `Recebimento de ${formatarMoeda(v)} registrado! Saldo restante reduzido para ${formatarMoeda(novoRestante)}.`
          )
        }
      } else if (diff < 0) {
        // Pagou menos do que o previsto da entrada
        const falta = Math.abs(diff)
        const novoRestante = Math.round((outroPendente.valor + falta) * 100) / 100
        updateLancamento(lancamento.id, {
          ...lancamento,
          valor: v,
          status: "pago",
          pagoEm: agora,
          formaPagamento: formaPagamentoRecebida as any,
        })
        updateLancamento(outroPendente.id, {
          ...outroPendente,
          valor: novoRestante,
        })
        toast.success(
          `Recebimento parcial de ${formatarMoeda(v)} registrado! Saldo restante ajustado para ${formatarMoeda(novoRestante)}.`
        )
      } else {
        // Pagou o valor exato
        updateLancamento(lancamento.id, {
          ...lancamento,
          status: "pago",
          pagoEm: agora,
          formaPagamento: formaPagamentoRecebida as any,
        })
        toast.success(`Pagamento de ${formatarMoeda(v)} registrado.`)
      }
    } else {
      // Parcela única (sem outra parcela vinculada)
      if (diff < 0) {
        const restante = Math.round((lancamento.valor - v) * 100) / 100
        updateLancamento(lancamento.id, {
          ...lancamento,
          valor: v,
          status: "pago",
          pagoEm: agora,
          formaPagamento: formaPagamentoRecebida as any,
        })
        addLancamento({
          descricao: `${lancamento.descricao} · Saldo restante`,
          tipo: "receita",
          categoria: lancamento.categoria,
          valor: restante,
          vencimento: lancamento.vencimento,
          status: "pendente",
          clienteId: lancamento.clienteId,
          origem: lancamento.origem,
          origemId: lancamento.origemId,
          formaPagamento: lancamento.formaPagamento,
        })
        toast.success(
          `Recebimento parcial de ${formatarMoeda(v)} registrado! Nova parcela de ${formatarMoeda(restante)} criada para o saldo restante.`
        )
      } else {
        updateLancamento(lancamento.id, {
          ...lancamento,
          valor: v,
          status: "pago",
          pagoEm: agora,
          formaPagamento: formaPagamentoRecebida as any,
        })
        toast.success(`Recebimento de ${formatarMoeda(v)} registrado com sucesso!`)
      }
    }

    setModoBaixaFlexivel(false)
    onOpenChange(false)
  }

  function alternarStatus() {
    if (!lancamento) return
    const vaiPagar = lancamento.status !== "pago"
    marcarLancamentoStatus(lancamento.id, vaiPagar ? "pago" : "pendente")
    if (vaiPagar && lancamento.tipo === "receita") {
      const id = lancamento.id
      toast.success("Pagamento registrado.", {
        action: { label: "Gerar recibo", onClick: () => router.push(`/financeiro/${id}/recibo`) },
        duration: 10000,
      })
    }
    onOpenChange(false)
  }

  // Mesma categoria e despesa, ainda não paga: dá pra marcar a série toda de uma vez
  // (financiamento, parcelas) em vez de lançamento por lançamento.
  const mesmaCategoria =
    lancamento.tipo === "despesa"
      ? lancamentos.filter(
          (l) =>
            l.tipo === "despesa" &&
            l.categoria === lancamento.categoria &&
            Boolean(l.pessoal) === Boolean(lancamento.pessoal)
        )
      : []

  function alternarPessoal(todos: boolean) {
    if (!lancamento) return
    const novoValor = !lancamento.pessoal
    const alvos = todos ? mesmaCategoria : [lancamento]
    alvos.forEach((l) => {
      updateLancamento(l.id, { ...l, pessoal: novoValor ? true : undefined })
    })
    toast.success(
      novoValor
        ? `${alvos.length} lançamento${alvos.length === 1 ? "" : "s"} marcado${alvos.length === 1 ? "" : "s"} como pessoal.`
        : `${alvos.length} lançamento${alvos.length === 1 ? "" : "s"} voltou${alvos.length === 1 ? "" : "ram"} para a empresa.`
    )
    onOpenChange(false)
  }

  const serie = resumirSerie(lancamentos, lancamento)

  // Marca as N primeiras parcelas ainda pendentes da série como pagas, cada
  // uma na data do próprio vencimento (não "hoje").
  function marcarPrimeirasPagas() {
    if (!serie) return
    const n = Number(quantasPagas)
    if (!Number.isInteger(n) || n < 1 || n > serie.pendentes.length) {
      toast.error(`Informe de 1 a ${serie.pendentes.length}.`)
      return
    }
    serie.pendentes.slice(0, n).forEach((l) => {
      updateLancamento(l.id, {
        ...l,
        status: "pago",
        pagoEm: new Date(new Date(l.vencimento).getTime()).toISOString(),
      })
    })
    toast.success(`${n} parcela${n === 1 ? "" : "s"} marcada${n === 1 ? "" : "s"} como paga${n === 1 ? "" : "s"}.`)
    setQuantasPagas("")
  }

  function mandarLembrete() {
    if (!lancamento || !cliente) return
    addMensagemBot({
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      telefone: cliente.telefone,
      texto: `Lembrete: "${lancamento.descricao}" no valor de ${formatarMoeda(lancamento.valor)} ${vencido ? "venceu em" : "vence em"} ${formatarData(lancamento.vencimento)}.`,
      origem: "lembrete",
      autor: "bot",
    })
    toast.success(`Lembrete registrado pra ${cliente.nome}`)
    onOpenChange(false)
  }

  function handleRemover() {
    if (!lancamento) return
    removeLancamento(lancamento.id)
    toast.success("Lançamento removido.")
    setConfirmarRemocao(false)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={Boolean(lancamento)} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle className="text-base">{lancamento.descricao}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {/* Valor destaque */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-4 py-3">
              <span
                className={cn(
                  "text-2xl font-bold",
                  lancamento.tipo === "receita" ? "text-primary" : "text-destructive"
                )}
              >
                {lancamento.tipo === "receita" ? "+ " : "− "}
                {formatarMoeda(lancamento.valor)}
              </span>
              <Badge variant={lancamento.status === "pago" ? "secondary" : "default"}>
                {lancamento.status === "pago" ? "Pago" : "Pendente"}
              </Badge>
            </div>

            {/* Detalhes em grade */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 break-words text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Tipo</p>
                <p>{lancamento.tipo === "receita" ? "Receita" : "Despesa"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Categoria</p>
                <p>{lancamento.categoria}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vencimento</p>
                <p className={cn(vencido && lancamento.status !== "pago" && "text-destructive font-medium")}>
                  {formatarData(lancamento.vencimento)}
                  {vencido && lancamento.status !== "pago" && " (vencido)"}
                </p>
              </div>
              {lancamento.status === "pago" && (
                <div>
                  <p className="text-xs text-muted-foreground">Baixado em</p>
                  <p>
                    {lancamento.pagoEm
                      ? formatarData(lancamento.pagoEm)
                      : "Sem data registrada"}
                  </p>
                </div>
              )}
              {cliente && (
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p>{cliente.nome}</p>
                </div>
              )}
              {lancamento.formaPagamento && (
                <div>
                  <p className="text-xs text-muted-foreground">Forma de pagamento</p>
                  <p>{rotuloFormaPagamento[lancamento.formaPagamento]}</p>
                </div>
              )}
              {lancamento.numeroBoleto && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Número do boleto</p>
                  <p className="font-mono text-xs">{lancamento.numeroBoleto}</p>
                </div>
              )}
              {lancamento.pessoal && (
                <div>
                  <p className="text-xs text-muted-foreground">Tipo de despesa</p>
                  <p>Pessoal (fora dos totais)</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Origem</p>
                <p className="capitalize">{lancamento.origem}</p>
              </div>
            </div>

            {serie && (
              <div className="flex flex-col gap-3 rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <p className="font-medium">
                    {serie.nome}: {serie.pagas.length} de {serie.parcelas.length} pagas
                  </p>
                  <p className="text-xs text-muted-foreground">
                    quita em {formatarData(serie.quitaEm)}
                  </p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(serie.pagas.length / serie.parcelas.length) * 100}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Já pagou</p>
                    <p className="font-semibold">{formatarMoeda(serie.valorPago)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Falta ({serie.pendentes.length} parcela{serie.pendentes.length === 1 ? "" : "s"})
                    </p>
                    <p className="font-semibold text-destructive">{formatarMoeda(serie.valorRestante)}</p>
                  </div>
                </div>
                {serie.pendentes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <Input
                      type="number"
                      min="1"
                      max={serie.pendentes.length}
                      placeholder="Quantas?"
                      className="w-28"
                      value={quantasPagas}
                      onChange={(e) => setQuantasPagas(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 text-left"
                      onClick={marcarPrimeirasPagas}
                    >
                      Marcar as primeiras como pagas
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Bloco de Baixa com Valor Diferente */}
            {modoBaixaFlexivel && (
              <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/30 bg-emerald-50/50 p-3.5 text-sm dark:bg-emerald-950/20">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-emerald-800 dark:text-emerald-400">
                    Dar baixa com valor diferente
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setModoBaixaFlexivel(false)}
                  >
                    Cancelar
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="valorRecebido" className="text-xs">
                      Valor recebido (R$)
                    </Label>
                    <Input
                      id="valorRecebido"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={valorRecebido}
                      onChange={(e) => setValorRecebido(e.target.value)}
                      placeholder={String(lancamento.valor)}
                      className="bg-background"
                      autoFocus
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="formaRecebida" className="text-xs">
                      Forma de pagamento
                    </Label>
                    <Select
                      value={formaPagamentoRecebida}
                      onValueChange={(val) => setFormaPagamentoRecebida(val || "pix")}
                    >
                      <SelectTrigger id="formaRecebida" className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">Pix</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="cartao">Cartão</SelectItem>
                        <SelectItem value="boleto">Boleto</SelectItem>
                        <SelectItem value="transferencia">Transferência</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(() => {
                  const v = Number(valorRecebido) || 0
                  const diff = Math.round((v - lancamento.valor) * 100) / 100
                  if (v <= 0) return null
                  if (outroPendente) {
                    if (diff > 0) {
                      if (v >= Math.round((lancamento.valor + outroPendente.valor) * 100) / 100) {
                        return (
                          <div className="rounded bg-emerald-100 p-2 text-xs text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100">
                            🎉 <strong>Quitação total:</strong> Esse valor cobre tanto esta entrada quanto o saldo restante de {formatarMoeda(outroPendente.valor)}. Ambas as parcelas serão quitadas!
                          </div>
                        )
                      }
                      const novoRestante = Math.round((outroPendente.valor - diff) * 100) / 100
                      return (
                        <div className="rounded bg-emerald-100/70 p-2 text-xs text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100">
                          ✨ <strong>Abatimento automático:</strong> O cliente pagou +{formatarMoeda(diff)} a mais que o previsto. O saldo restante passará de {formatarMoeda(outroPendente.valor)} para <strong>{formatarMoeda(novoRestante)}</strong>.
                        </div>
                      )
                    }
                    if (diff < 0) {
                      const novoRestante = Math.round((outroPendente.valor + Math.abs(diff)) * 100) / 100
                      return (
                        <div className="rounded bg-amber-100/70 p-2 text-xs text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
                          ⚠️ <strong>Pagamento parcial:</strong> Faltam {formatarMoeda(Math.abs(diff))} desta entrada. Esse valor será somado ao restante, que passará para <strong>{formatarMoeda(novoRestante)}</strong>.
                        </div>
                      )
                    }
                    return null
                  }
                  if (diff < 0) {
                    return (
                      <div className="rounded bg-amber-100/70 p-2 text-xs text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
                        ⚠️ <strong>Pagamento parcial:</strong> Será criada uma nova parcela pendente de <strong>{formatarMoeda(lancamento.valor - v)}</strong> para o saldo restante.
                      </div>
                    )
                  }
                  return null
                })()}

                <Button
                  onClick={confirmarBaixaFlexivel}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Confirmar recebimento de {formatarMoeda(Number(valorRecebido) || 0)}
                </Button>
              </div>
            )}

            {/* Ações */}
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <Button variant="outline" size="sm" onClick={alternarStatus}>
                {lancamento.status === "pago" ? (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Marcar pendente
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Marcar pago
                  </>
                )}
              </Button>

              {lancamento.status === "pendente" && lancamento.tipo === "receita" && !modoBaixaFlexivel && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-emerald-600/40 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                  onClick={() => {
                    setValorRecebido(String(lancamento.valor))
                    setFormaPagamentoRecebida(lancamento.formaPagamento ?? "pix")
                    setModoBaixaFlexivel(true)
                  }}
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  Receber outro valor
                </Button>
              )}

              {lancamento.status === "pago" && lancamento.tipo === "receita" && (
                <Button
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/financeiro/${lancamento.id}/recibo`} />}
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  Gerar recibo
                </Button>
              )}

              {lancamento.status === "pendente" && cliente && (
                <Button variant="outline" size="sm" onClick={mandarLembrete}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Lembrete
                </Button>
              )}

              {lancamento.tipo === "despesa" && (
                <Button variant="outline" size="sm" onClick={() => alternarPessoal(false)}>
                  {lancamento.pessoal ? "Voltar pra empresa" : "Marcar como pessoal"}
                </Button>
              )}
              {mesmaCategoria.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 text-left"
                  onClick={() => alternarPessoal(true)}
                >
                  {lancamento.pessoal ? "Voltar" : "Marcar"} todas de “{lancamento.categoria}” ({mesmaCategoria.length})
                </Button>
              )}

              <LancamentoFormDialog
                lancamento={lancamento}
                open={editAberto}
                onOpenChange={setEditAberto}
                trigger={
                  <Button variant="outline" size="sm">
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                }
              />

              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmarRemocao(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remover
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarRemocao} onOpenChange={setConfirmarRemocao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{lancamento.descricao}&rdquo; será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemover}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
