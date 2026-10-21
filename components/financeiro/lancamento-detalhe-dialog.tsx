"use client"

import { useState } from "react"
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
import type { LancamentoFinanceiro } from "@/lib/types"
import { MessageCircle, Pencil, Trash2, CheckCircle2, Clock } from "lucide-react"
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
  const { clientes, marcarLancamentoStatus, removeLancamento, addMensagemBot } = useData()
  const [confirmarRemocao, setConfirmarRemocao] = useState(false)
  const [editAberto, setEditAberto] = useState(false)

  if (!lancamento) return null

  const cliente = clientes.find((c) => c.id === lancamento.clienteId)
  const vencido = hoje ? estaLancamentoVencido(lancamento, hoje) : false

  function alternarStatus() {
    if (!lancamento) return
    marcarLancamentoStatus(
      lancamento.id,
      lancamento.status === "pago" ? "pendente" : "pago"
    )
    onOpenChange(false)
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{lancamento.descricao}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {/* Valor destaque */}
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
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
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
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
              <div>
                <p className="text-xs text-muted-foreground">Origem</p>
                <p className="capitalize">{lancamento.origem}</p>
              </div>
            </div>

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

              {lancamento.status === "pendente" && cliente && (
                <Button variant="outline" size="sm" onClick={mandarLembrete}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Lembrete
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
