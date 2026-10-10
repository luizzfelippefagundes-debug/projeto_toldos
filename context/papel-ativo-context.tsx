"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { Papel } from "@/lib/types"

const PapelAtivoContext = createContext<{ papel: Papel } | null>(null)

export function PapelAtivoProvider({
  children,
  papelInicial,
}: {
  children: ReactNode
  papelInicial: Papel
}) {
  return (
    <PapelAtivoContext.Provider value={{ papel: papelInicial }}>
      {children}
    </PapelAtivoContext.Provider>
  )
}

export function usePapelAtivo() {
  const ctx = useContext(PapelAtivoContext)
  if (!ctx) {
    throw new Error("usePapelAtivo deve ser usado dentro de PapelAtivoProvider")
  }
  return ctx
}
