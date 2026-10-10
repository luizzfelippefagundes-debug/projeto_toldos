"use client"

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react"
import type { Papel } from "@/lib/types"

interface PapelAtivoContextValue {
  // Visão atual — o dono pode simular a visão dos outros papéis.
  papel: Papel
  setPapel: (papel: Papel) => void
  // Papel de verdade da conta, vindo do Clerk.
  papelReal: Papel
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
    <PapelAtivoContext.Provider value={{ papel, setPapel, papelReal: papelInicial }}>
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
