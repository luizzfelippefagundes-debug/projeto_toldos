"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { vendedoresSeed } from "@/lib/seed-data"
import { lerArmazenamento, salvarArmazenamento } from "@/lib/storage"

interface VendedorAtivoContextValue {
  vendedorId: string
  setVendedorId: (id: string) => void
}

const VendedorAtivoContext = createContext<VendedorAtivoContextValue | null>(
  null
)

export function VendedorAtivoProvider({ children }: { children: ReactNode }) {
  // Mesmo cuidado de hidratação do resto do app: começa sempre com o
  // primeiro vendedor (igual no servidor e no primeiro render do cliente) e
  // só lê o que estava salvo depois de montar.
  const [vendedorId, setVendedorIdState] = useState(vendedoresSeed[0].id)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVendedorIdState(
      lerArmazenamento("toldosprint.vendedorAtivo", vendedoresSeed[0].id)
    )
  }, [])

  function setVendedorId(id: string) {
    setVendedorIdState(id)
    salvarArmazenamento("toldosprint.vendedorAtivo", id)
  }

  return (
    <VendedorAtivoContext.Provider value={{ vendedorId, setVendedorId }}>
      {children}
    </VendedorAtivoContext.Provider>
  )
}

export function useVendedorAtivo() {
  const ctx = useContext(VendedorAtivoContext)
  if (!ctx) {
    throw new Error(
      "useVendedorAtivo deve ser usado dentro de VendedorAtivoProvider"
    )
  }
  return ctx
}
