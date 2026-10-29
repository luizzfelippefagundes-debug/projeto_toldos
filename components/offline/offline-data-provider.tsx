"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { DataContext, type DataContextValue } from "@/context/data-context"
import { armazenamentoLocal } from "@/lib/offline/armazenamento"
import { lerCatalogo, type CatalogoLocal } from "@/lib/offline/catalogo"
import { listarFila } from "@/lib/offline/fila"
import type { Cliente } from "@/lib/types"

type Estado =
  | { situacao: "carregando" }
  | { situacao: "sem-copia" }
  | { situacao: "pronto"; catalogo: CatalogoLocal; clientesDaFila: Cliente[] }

// Alimenta a tela de orçamento com a cópia local (clientes, materiais, serviços)
// e com os clientes cadastrados offline que ainda estão na fila. Só implementa o
// que o orçamento novo usa; qualquer outra função chamada por engano falha alto.
export function OfflineDataProvider({
  children,
  aoCarregar,
}: {
  children: (estado: { situacao: Estado["situacao"]; atualizadoEm?: string }) => ReactNode
  aoCarregar?: () => void
}) {
  const [estado, setEstado] = useState<Estado>({ situacao: "carregando" })
  const [clientesNovos, setClientesNovos] = useState<Cliente[]>([])

  useEffect(() => {
    let ativo = true
    ;(async () => {
      try {
        const arm = armazenamentoLocal()
        const catalogo = await lerCatalogo(arm)
        const fila = await listarFila(arm)
        if (!ativo) return
        if (!catalogo) {
          setEstado({ situacao: "sem-copia" })
          return
        }
        const clientesDaFila = fila.flatMap((i) => (i.clienteNovo ? [i.clienteNovo] : []))
        setEstado({ situacao: "pronto", catalogo, clientesDaFila })
        aoCarregar?.()
      } catch {
        if (ativo) setEstado({ situacao: "sem-copia" })
      }
    })()
    return () => {
      ativo = false
    }
  }, [aoCarregar])

  const addCliente = useCallback<DataContextValue["addCliente"]>((dados, id) => {
    const novo: Cliente = { id: id ?? `cli-offline-${Math.random().toString(36).slice(2, 10)}`, ...dados }
    setClientesNovos((atual) => [...atual, novo])
    return novo
  }, [])

  const valor = useMemo(() => {
    if (estado.situacao !== "pronto") return null
    const clientes = [
      ...estado.catalogo.clientes,
      ...estado.clientesDaFila.filter((c) => !estado.catalogo.clientes.some((x) => x.id === c.id)),
      ...clientesNovos.filter((c) => !estado.clientesDaFila.some((x) => x.id === c.id)),
    ]
    const usado: Partial<DataContextValue> = {
      materiais: estado.catalogo.materiais,
      servicos: estado.catalogo.servicos,
      clientes,
      orcamentos: [],
      rascunho: null,
      carregado: true,
      consumirRascunho: () => {},
      updateOrcamento: () => false,
      addCliente,
    }
    // Funções que o orçamento novo não usa: falham alto se alguém chamar.
    return new Proxy(usado, {
      get(alvo, chave) {
        if (chave in alvo) return alvo[chave as keyof typeof alvo]
        return () => {
          throw new Error(`"${String(chave)}" não está disponível offline`)
        }
      },
    }) as unknown as DataContextValue
  }, [estado, clientesNovos, addCliente])

  const ctx = { situacao: estado.situacao, atualizadoEm: estado.situacao === "pronto" ? estado.catalogo.atualizadoEm : undefined }
  if (!valor) return <>{children(ctx)}</>
  return <DataContext.Provider value={valor}>{children(ctx)}</DataContext.Provider>
}
