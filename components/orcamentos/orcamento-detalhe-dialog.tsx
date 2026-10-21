"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useData } from "@/context/data-context"
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
import { Button } from "@/components/ui/button"
import { OrcamentoDetalhes } from "@/components/orcamentos/orcamento-detalhes"
import { Printer, Pencil, Copy, RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"

export function OrcamentoDetalheDialog({
  orcamentoId,
  onOpenChange,
}: {
  orcamentoId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const { orcamentos, reabrirOrcamento, duplicarOrcamento, removeOrcamento } = useData()
  const router = useRouter()
  const [confirmarRemocao, setConfirmarRemocao] = useState(false)

  const orcamento = orcamentos.find((o) => o.id === orcamentoId)

  function handleReabrir() {
    if (!orcamento) return
    if (!reabrirOrcamento(orcamento.id)) {
      toast.error(
        "Não é possível reabrir: o orçamento já foi pago ou não foi encontrado."
      )
      return
    }
    toast.success("Orçamento reaberto; estoque e financeiro foram estornados.")
    onOpenChange(false)
  }

  function handleDuplicar() {
    if (!orcamento) return
    duplicarOrcamento(orcamento.id)
    onOpenChange(false)
    router.push("/orcamentos/novo")
  }

  function handleRemover() {
    if (!orcamento) return
    removeOrcamento(orcamento.id)
    toast.success("Orçamento removido.")
    setConfirmarRemocao(false)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={Boolean(orcamento)} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Detalhes do orçamento</DialogTitle>
          </DialogHeader>
          {orcamento && (
            <div className="flex flex-col gap-5">
              <OrcamentoDetalhes orcamento={orcamento} />

              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/orcamentos/novo?editar=${orcamento.id}`} />}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/orcamentos/${orcamento.id}/os`} />}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir OS
                </Button>
                <Button variant="outline" size="sm" onClick={handleDuplicar}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicar
                </Button>
                {orcamento.status !== "aberto" && (
                  <Button variant="outline" size="sm" onClick={handleReabrir}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reabrir
                  </Button>
                )}
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
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarRemocao} onOpenChange={setConfirmarRemocao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {orcamento?.status === "fechado"
                ? "O orçamento será removido e o estoque/financeiro serão estornados. Esta ação não pode ser desfeita."
                : "O orçamento será removido permanentemente. Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemover}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
