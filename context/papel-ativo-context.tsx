"use client"

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react"
import type { Papel } from "@/lib/types"

interface PapelAtivoContextValue {
  papel: Papel
  setPapel: (papel: Papel) => void
}

const PapelAtivoContext = createContext<PapelAtivoContextValue | null>(null)

export function PapelAtivoProvider({
  children,
  papelInicial,
}: {
  children: ReactNode
  papelInicial: Papel
}) {
  const [papel, setPapel] = useState<Papel>(papelInicial)

  return (
    <PapelAtivoContext.Provider value={{ papel, setPapel }}>
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
