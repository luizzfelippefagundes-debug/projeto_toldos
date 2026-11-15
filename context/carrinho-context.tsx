"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

export interface ItemCarrinho {
  id: string
  produtoId: string
  nome: string
  variacao?: string
  precoUnitario: number
  quantidade: number
  imagem: string
  medidas?: { largura: number; altura: number; m2: number }
}

interface CarrinhoContextType {
  itens: ItemCarrinho[]
  adicionarItem: (item: Omit<ItemCarrinho, "id">) => void
  removerItem: (id: string) => void
  atualizarQuantidade: (id: string, quantidade: number) => void
  limparCarrinho: () => void
  totalItens: number
  valorTotal: number
  carrinhoAberto: boolean
  setCarrinhoAberto: (aberto: boolean) => void
}

const CarrinhoContext = createContext<CarrinhoContextType | undefined>(undefined)

export function CarrinhoProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([])
  const [carrinhoAberto, setCarrinhoAberto] = useState(false)

  // Carregar do localStorage
  useEffect(() => {
    try {
      const salvo = localStorage.getItem("toldosprint_carrinho")
      if (salvo) setItens(JSON.parse(salvo))
    } catch {}
  }, [])

  // Salvar no localStorage
  useEffect(() => {
    try {
      localStorage.setItem("toldosprint_carrinho", JSON.stringify(itens))
    } catch {}
  }, [itens])

  const adicionarItem = (novo: Omit<ItemCarrinho, "id">) => {
    setItens((atuais) => {
      const index = atuais.findIndex(
        (i) => i.produtoId === novo.produtoId && i.variacao === novo.variacao
      )
      if (index >= 0) {
        const clonados = [...atuais]
        clonados[index].quantidade += novo.quantidade
        return clonados
      }
      return [...atuais, { ...novo, id: `${novo.produtoId}-${Date.now()}` }]
    })
    setCarrinhoAberto(true)
  }

  const removerItem = (id: string) => {
    setItens((atuais) => atuais.filter((i) => i.id !== id))
  }

  const atualizarQuantidade = (id: string, qtd: number) => {
    if (qtd <= 0) {
      removerItem(id)
      return
    }
    setItens((atuais) =>
      atuais.map((i) => (i.id === id ? { ...i, quantidade: qtd } : i))
    )
  }

  const limparCarrinho = () => setItens([])

  const totalItens = itens.reduce((acc, i) => acc + i.quantidade, 0)
  const valorTotal = itens.reduce((acc, i) => acc + i.precoUnitario * i.quantidade, 0)

  return (
    <CarrinhoContext.Provider
      value={{
        itens,
        adicionarItem,
        removerItem,
        atualizarQuantidade,
        limparCarrinho,
        totalItens,
        valorTotal,
        carrinhoAberto,
        setCarrinhoAberto,
      }}
    >
      {children}
    </CarrinhoContext.Provider>
  )
}

export function useCarrinho() {
  const context = useContext(CarrinhoContext)
  if (!context) throw new Error("useCarrinho deve ser usado dentro de CarrinhoProvider")
  return context
}
