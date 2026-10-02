"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import type { Papel } from "@/lib/types"
import { lerArmazenamento, salvarArmazenamento } from "@/lib/storage"

interface PapelAtivoContextValue {
  papel: Papel
  setPapel: (papel: Papel) => void
}

const PapelAtivoContext = createContext<PapelAtivoContextValue | null>(null)

export function PapelAtivoProvider({ children }: { children: ReactNode }) {
  // Mesmo cuidado de hidratação do resto do app: começa sempre como "dono"
  // (igual no servidor e no primeiro render do cliente) e só lê o que estava
  // salvo depois de montar.
  const [papel, setPapelState] = useState<Papel>("dono")

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPapelState(lerArmazenamento<Papel>("toldosprint.papelAtivo", "dono"))
  }, [])

  function setPapel(novo: Papel) {
    setPapelState(novo)
    salvarArmazenamento("toldosprint.papelAtivo", novo)
  }

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
