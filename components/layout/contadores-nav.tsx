"use client"

import { useMemo } from "react"
import { useData } from "@/context/data-context"
import { contarOrcamentosLojaAbertos } from "@/lib/orcamentos-loja"
import type { ContadorNav } from "./nav-groups"

// Números que aparecem como bolinha ao lado dos itens do menu (sidebar e menu
// do celular), calculados a partir dos dados já carregados no DataProvider.
export function useContadoresNav(): Record<ContadorNav, number> {
  const { orcamentos } = useData()
  return useMemo(() => ({ orcamentosLojaAbertos: contarOrcamentosLojaAbertos(orcamentos) }), [orcamentos])
}

export function BolinhaContador({ valor, compacto }: { valor: number; compacto?: boolean }) {
  if (valor <= 0) return null
  const texto = valor > 99 ? "99+" : String(valor)
  if (compacto) {
    return (
      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[9px] font-semibold leading-none text-white">
        {texto}
      </span>
    )
  }
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500 px-1.5 text-[10px] font-semibold leading-none text-white">
      {texto}
    </span>
  )
}
