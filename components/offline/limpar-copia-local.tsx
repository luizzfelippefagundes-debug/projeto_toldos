"use client"

import { useEffect } from "react"
import { armazenamentoLocal } from "@/lib/offline/armazenamento"
import { limparCatalogo } from "@/lib/offline/catalogo"

// Quem chega na tela de login não está logado: tira do aparelho a cópia de
// clientes/materiais/serviços (a fila de orçamentos pendentes é mantida).
export function LimparCopiaLocal() {
  useEffect(() => {
    try {
      limparCatalogo(armazenamentoLocal()).catch(() => {})
    } catch {
      // Sem IndexedDB: nada a limpar.
    }
  }, [])
  return null
}
