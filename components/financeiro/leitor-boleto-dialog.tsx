"use client"

import { Button } from "@/components/ui/button"
import { LancamentoFormDialog } from "@/components/financeiro/lancamento-form-dialog"
import { ScanLine } from "lucide-react"

export function LeitorBoletoDialog() {
  return (
    <LancamentoFormDialog
      inicial={{ formaPagamento: "boleto" }}
      trigger={
        <Button
          variant="outline"
          className="w-full sm:w-auto font-bold border-border/80 hover:bg-muted text-foreground gap-1.5 text-xs sm:text-sm h-10 px-2 sm:px-4 shadow-2xs transition-colors cursor-pointer"
        >
          <ScanLine className="h-4 w-4 shrink-0 text-primary" />
          <span>Ler Boleto</span>
        </Button>
      }
    />
  )
}
