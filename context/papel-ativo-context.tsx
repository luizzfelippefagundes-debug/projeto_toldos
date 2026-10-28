"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import type { Papel } from "@/lib/types"

const STORAGE_KEY = "papel-visto"

interface PapelAtivoValue {
  // Papel usado pra montar o menu. Pro dono, pode ser um papel de "prévia".
  papel: Papel
  papelReal: Papel
  previa: boolean
  // Só o dono pode ver como outro papel. É só visual: o acesso real não muda.
  verComo: (papel: Papel | null) => void
}

const PapelAtivoContext = createContext<PapelAtivoValue | null>(null)

export function PapelAtivoProvider({
  children,
  papelInicial,
}: {
  children: ReactNode
  papelInicial: Papel
}) {
  const [papelVisto, setPapelVisto] = useState<Papel | null>(null)

  useEffect(() => {
    if (papelInicial !== "dono") return
    try {
      const salvo = sessionStorage.getItem(STORAGE_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (salvo) setPapelVisto(salvo as Papel)
    } catch { /* ignorar */ }
  }, [papelInicial])

  function verComo(papel: Papel | null) {
    if (papelInicial !== "dono") return
    setPapelVisto(papel)
    try {
      if (papel) sessionStorage.setItem(STORAGE_KEY, papel)
      else sessionStorage.removeItem(STORAGE_KEY)
    } catch { /* ignorar */ }
  }

  const papel = papelInicial === "dono" && papelVisto ? papelVisto : papelInicial

  return (
    <PapelAtivoContext.Provider
      value={{ papel, papelReal: papelInicial, previa: papel !== papelInicial, verComo }}
    >
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
