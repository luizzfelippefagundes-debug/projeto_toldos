"use client"

import { useEffect, useState } from "react"
import { formatarDataHora } from "@/lib/format"
import type { ExclusaoRegistrada } from "@/lib/historico-exclusoes"

const rotuloTabela: Record<ExclusaoRegistrada["tabela"], string> = {
  orcamentos: "Orçamento",
  clientes: "Cliente",
  lancamentos_financeiros: "Financeiro",
}

type Estado =
  | { situacao: "carregando" }
  | { situacao: "erro"; mensagem: string }
  | { situacao: "pronto"; itens: ExclusaoRegistrada[] }

export default function ExclusoesPage() {
  const [estado, setEstado] = useState<Estado>({ situacao: "carregando" })
  const [aberto, setAberto] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    fetch("/api/exclusoes", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 403) throw new Error("Só o dono pode ver o histórico de exclusões.")
        if (!res.ok) throw new Error("Não foi possível carregar o histórico.")
        return (await res.json()) as ExclusaoRegistrada[]
      })
      .then((itens) => ativo && setEstado({ situacao: "pronto", itens }))
      .catch((e: Error) => ativo && setEstado({ situacao: "erro", mensagem: e.message }))
    return () => {
      ativo = false
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Histórico de exclusões</h1>
        <p className="text-sm text-muted-foreground">
          Orçamentos, clientes e lançamentos financeiros apagados: quem apagou, quando e o
          conteúdo completo, para conferir ou refazer se foi sem querer.
        </p>
      </div>

      {estado.situacao === "carregando" && (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      )}
      {estado.situacao === "erro" && (
        <p className="text-sm text-red-600 dark:text-red-300">{estado.mensagem}</p>
      )}
      {estado.situacao === "pronto" && estado.itens.length === 0 && (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Nada foi apagado desde que o histórico começou a ser guardado.
        </p>
      )}
      {estado.situacao === "pronto" && estado.itens.length > 0 && (
        <ul className="flex flex-col gap-3">
          {estado.itens.map((item) => (
            <li key={item.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{rotuloTabela[item.tabela]}</p>
                  <p className="break-words font-medium">{item.resumo}</p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {formatarDataHora(item.excluidoEm)}
                </p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Apagado por {item.excluidoPorNome ?? "usuário desconhecido"}
              </p>
              <button
                type="button"
                className="mt-2 text-xs text-primary underline-offset-2 hover:underline"
                onClick={() => setAberto(aberto === item.id ? null : item.id)}
              >
                {aberto === item.id ? "Esconder conteúdo" : "Ver conteúdo completo"}
              </button>
              {aberto === item.id && (
                <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-muted/40 p-3 text-xs">
                  {JSON.stringify(item.dados, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
