"use client"

import { createContext, useContext } from "react"

// Verdadeiro dentro da tela /offline: o orçamento não grava no servidor, vai
// pra fila do aparelho.
export const ModoOfflineContext = createContext(false)

export function useModoOffline() {
  return useContext(ModoOfflineContext)
}
