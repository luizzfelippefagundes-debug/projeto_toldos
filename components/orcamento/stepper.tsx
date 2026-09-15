import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface StepperStep {
  numero: number
  titulo: string
}

interface StepperProps {
  passos: StepperStep[]
  atual: number
}

export function Stepper({ passos, atual }: StepperProps) {
  return (
    <div className="flex items-start print:hidden">
      {passos.map((passo, i) => (
        <div
          key={passo.numero}
          className={cn(
            "flex items-center",
            i < passos.length - 1 && "flex-1"
          )}
        >
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                passo.numero < atual
                  ? "border-primary bg-primary text-primary-foreground"
                  : passo.numero === atual
                    ? "border-primary text-primary"
                    : "border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {passo.numero < atual ? (
                <Check className="h-4 w-4" />
              ) : (
                passo.numero
              )}
            </div>
            <span
              className={cn(
                "whitespace-nowrap text-xs",
                passo.numero <= atual
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {passo.titulo}
            </span>
          </div>
          {i < passos.length - 1 && (
            <div
              className={cn(
                "mx-2 h-px flex-1",
                passo.numero < atual ? "bg-primary" : "bg-border"
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}
