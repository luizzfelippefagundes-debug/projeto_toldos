"use client"

import { useUser } from "@clerk/nextjs"

const COMISSAO_PERCENT = 5

// O vendedor é quem está logado: os pedidos ficam ligados ao id da conta.
export function useVendedorAtivo() {
  const { user } = useUser()
  return {
    vendedorId: user?.id ?? "",
    nome: user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? "",
    comissaoPercent: COMISSAO_PERCENT,
  }
}
