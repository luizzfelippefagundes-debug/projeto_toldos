"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useData } from "@/context/data-context"
import { armazenamentoLocal } from "@/lib/offline/armazenamento"
import {
  listarFila,
  precisaAtencao,
  registrarFalha,
  removerDaFila,
  type ItemFila,
} from "@/lib/offline/fila"
import { sincronizarFila } from "@/lib/offline/sincronizar"
import { formatarMoeda } from "@/lib/format"

async function existeNoServidor(id: string): Promise<boolean> {
  // O fecharOrcamento grava em segundo plano: dá uns segundos pra aparecer.
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const res = await fetch("/api/orcamentos", { cache: "no-store" })
    if (res.ok) {
      const lista = (await res.json()) as { id: string }[]
      if (lista.some((o) => o.id === id)) return true
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

async function enviarArquivo(arquivo: { nome: string; dados: Blob }): Promise<string> {
  const form = new FormData()
  form.append("file", new File([arquivo.dados], arquivo.nome))
  const res = await fetch("/api/upload", { method: "POST", body: form })
  if (!res.ok) throw new Error(`Falha ao enviar ${arquivo.nome}`)
  const { url } = await res.json()
  return url as string
}

// Dentro da área logada: manda a fila de orçamentos feitos offline quando há
// internet (ao abrir o app, quando o sinal volta ou no botão "Enviar agora") e
// mostra quantos estão esperando.
export function SincronizadorOffline() {
  const { carregado, clientes, fecharOrcamento, addCliente } = useData()
  const [fila, setFila] = useState<ItemFila[]>([])
  const [enviando, setEnviando] = useState(false)
  const rodando = useRef(false)
  // As funções do contexto mudam a cada alteração dos dados; guardá-las em refs
  // evita reenviar a fila toda vez que algo muda e sempre usa a versão mais nova.
  const clientesRef = useRef(clientes)
  const fecharOrcamentoRef = useRef(fecharOrcamento)
  const addClienteRef = useRef(addCliente)
  useEffect(() => {
    clientesRef.current = clientes
    fecharOrcamentoRef.current = fecharOrcamento
    addClienteRef.current = addCliente
  }, [clientes, fecharOrcamento, addCliente])

  const atualizarFila = useCallback(async () => {
    try {
      setFila(await listarFila(armazenamentoLocal()))
    } catch {
      setFila([])
    }
  }, [])

  const enviar = useCallback(
    async (forcar = false) => {
      if (rodando.current || !carregado || !navigator.onLine) return
      rodando.current = true
      setEnviando(true)
      try {
        const arm = armazenamentoLocal()
        const resultado = await sincronizarFila(
          {
            listar: () => listarFila(arm),
            remover: (id) => removerDaFila(arm, id),
            registrarFalha: (id, mensagem) => registrarFalha(arm, id, mensagem),
            existeNoServidor,
            clienteExiste: (id) => clientesRef.current.some((c) => c.id === id),
            criarCliente: async (c) => {
              addClienteRef.current({ nome: c.nome, telefone: c.telefone, email: c.email }, c.id)
              // Espera a tela "enxergar" o cliente novo: o fechamento procura o
              // nome dele (descrição das parcelas e mensagem ao cliente).
              for (let i = 0; i < 60 && !clientesRef.current.some((x) => x.id === c.id); i++) {
                await new Promise((r) => setTimeout(r, 50))
              }
            },
            enviarArquivo,
            fecharOrcamento: (dados) => fecharOrcamentoRef.current(dados),
          },
          { forcar }
        )
        if (resultado.enviados.length > 0) {
          toast.success(
            resultado.enviados.length === 1
              ? "1 orçamento feito offline foi enviado."
              : `${resultado.enviados.length} orçamentos feitos offline foram enviados.`
          )
        }
        for (const m of resultado.mudancas) {
          toast.warning(
            `Orçamento #${m.numero}: o valor mudou de ${formatarMoeda(m.de)} para ${formatarMoeda(m.para)}.`
          )
        }
        for (const f of resultado.falhas) {
          toast.error(`Não foi possível enviar um orçamento: ${f.erro}`)
        }
      } catch {
        // Sem IndexedDB ou rede: tenta de novo na próxima oportunidade.
      } finally {
        rodando.current = false
        setEnviando(false)
        atualizarFila()
      }
    },
    [carregado, atualizarFila]
  )

  // Leitura inicial da fila (o estado só muda quando a leitura assíncrona termina).
  useEffect(() => {
    let ativo = true
    Promise.resolve()
      .then(() => listarFila(armazenamentoLocal()))
      .then((itens) => {
        if (ativo) setFila(itens)
      })
      .catch(() => {
        // Sem IndexedDB: nada na fila.
      })
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    if (!carregado) return
    enviar()
    const aoVoltarSinal = () => enviar()
    window.addEventListener("online", aoVoltarSinal)
    return () => window.removeEventListener("online", aoVoltarSinal)
  }, [carregado, enviar])

  if (fila.length === 0) return null
  const precisamAtencao = fila.filter(precisaAtencao).length

  // No celular fica logo abaixo do cabeçalho: embaixo ele ficava atrás do aviso
  // "Instale o app" e não era visto.
  return (
    <div className="fixed inset-x-3 top-[4.75rem] z-30 flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-card p-3 shadow-lg md:top-auto md:bottom-4 md:left-auto md:w-96 print:hidden">
      <p className="text-sm font-medium">
        {fila.length === 1
          ? "1 orçamento aguardando envio"
          : `${fila.length} orçamentos aguardando envio`}
      </p>
      {precisamAtencao > 0 && (
        <p className="text-xs text-red-600 dark:text-red-300">
          {precisamAtencao} precisa de atenção (falhou várias vezes). Toque em “Enviar agora”.
        </p>
      )}
      <Button size="sm" disabled={enviando} onClick={() => enviar(true)}>
        {enviando ? "Enviando…" : "Enviar agora"}
      </Button>
    </div>
  )
}
