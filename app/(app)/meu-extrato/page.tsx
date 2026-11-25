"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Coins,
  Receipt,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  FileText,
  BadgePercent,
  Sparkles,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatarMoeda, formatarData } from "@/lib/format"

interface ExtratoData {
  colaborador: {
    id: string
    nome: string
    email: string | null
  }
  resumo: {
    totalPendente: number
    totalPago: number
    totalGeral: number
    pecasPendentes: number
    pecasPagas: number
    totalPecas: number
  }
  itensPendentes: Array<{
    id: string
    numero: string
    cliente_nome: string
    produto_nome: string
    valor_pedido: number
    comissao_percent: number
    valor_comissao: number
    status: string
    criado_em: string
  }>
  recibos: Array<{
    id: string
    numero_recibo: string
    valor_total: number
    forma_pagamento: string
    tipo_assinatura: string
    assinado_em: string | null
    criado_em: string
    pago_por: string | null
  }>
  historicoRecente: Array<{
    id: string
    numero: string
    cliente_nome: string
    produto_nome: string
    valor_pedido: number
    comissao_percent: number
    valor_comissao: number
    status: string
    pago_em: string | null
    recibo_id: string | null
    criado_em: string
  }>
}

export default function MeuExtratoPage() {
  const [dados, setDados] = useState<ExtratoData | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [abaAtiva, setAbaAtiva] = useState("semana")

  const carregarExtrato = async () => {
    try {
      setCarregando(true)
      const res = await fetch("/api/comissoes/meu-extrato")
      if (!res.ok) throw new Error("Erro ao carregar extrato pessoal")
      const json = await res.json()
      setDados(json)
    } catch (err: any) {
      setErro(err.message || "Erro de conexão")
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarExtrato()
  }, [])

  if (carregando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-bold text-muted-foreground">Carregando seu extrato...</p>
        </div>
      </div>
    )
  }

  if (erro || !dados) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-bold text-destructive">{erro || "Não foi possível carregar os dados"}</p>
        <Button onClick={carregarExtrato} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
        </Button>
      </div>
    )
  }

  const { colaborador, resumo, itensPendentes, recibos, historicoRecente } = dados

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Cabeçalho da Visão do Colaborador */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🪙</span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Meu Extrato & Comissões
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Olá, <strong>{colaborador.nome}</strong>! Acompanhe em tempo real suas bonificações de produção e comprovantes de repasse.
          </p>
        </div>

        <Button
          onClick={carregarExtrato}
          variant="outline"
          size="sm"
          className="self-start sm:self-auto gap-1.5 font-bold"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar Extrato
        </Button>
      </div>

      {/* Cards de Métricas do Colaborador */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: A Receber Esta Semana */}
        <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent relative overflow-hidden shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-amber-700 dark:text-amber-400 font-bold uppercase text-[11px] tracking-wider flex items-center justify-between">
              <span>A Receber Esta Semana</span>
              <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl font-black text-amber-950 dark:text-amber-100 mt-1">
              {formatarMoeda(resumo.totalPendente)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground font-medium">
              <strong>{resumo.pecasPendentes} peças</strong> concluídas prontas para o repasse do fim de semana
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total Já Recebido */}
        <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-emerald-700 dark:text-emerald-400 font-bold uppercase text-[11px] tracking-wider flex items-center justify-between">
              <span>Total Já Recebido</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl font-black text-emerald-950 dark:text-emerald-100 mt-1">
              {formatarMoeda(resumo.totalPago)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground font-medium">
              <strong>{recibos.length} recibos</strong> de pagamento quitados com a empresa
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Total de Peças Produzidas */}
        <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-transparent shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-blue-700 dark:text-blue-400 font-bold uppercase text-[11px] tracking-wider flex items-center justify-between">
              <span>Peças Produzidas</span>
              <CalendarCheck className="h-4 w-4 text-blue-500" />
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl font-black text-blue-950 dark:text-blue-100 mt-1">
              {resumo.totalPecas} un
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground font-medium">
              Acumulado geral de serviços finalizados por você
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Seletor de Abas Estilo Pills */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border w-fit">
        <button
          type="button"
          onClick={() => setAbaAtiva("semana")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            abaAtiva === "semana"
              ? "bg-background text-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Semana ({itensPendentes.length})
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva("recibos")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            abaAtiva === "recibos"
              ? "bg-background text-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Recibos ({recibos.length})
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva("historico")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            abaAtiva === "historico"
              ? "bg-background text-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Histórico
        </button>
      </div>

      {/* Aba 1: Produção Desta Semana (A Receber) */}
      {abaAtiva === "semana" && (
        <Card className="border shadow-xs">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-black flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-500" />
                Peças Concluídas nesta Semana (A Receber)
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Estes valores serão somados e repassados no fechamento do fim de semana.
              </CardDescription>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                Total da Semana:
              </span>
              <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                {formatarMoeda(resumo.totalPendente)}
              </span>
            </div>
          </CardHeader>

          <CardContent>
            {itensPendentes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Coins className="h-10 w-10 stroke-[1.5] mb-2 opacity-30 text-amber-500" />
                <p className="text-sm font-bold">Nenhuma peça concluída pendente nesta semana</p>
                <p className="text-xs opacity-75 mt-0.5">
                  Assim que você finalizar e aprovar peças no Controle de Qualidade da produção, elas aparecem aqui na hora!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-[10px] uppercase font-black text-muted-foreground border-b">
                    <tr>
                      <th className="py-2.5 px-3">Data / Hora</th>
                      <th className="py-2.5 px-3">OS / Pedido</th>
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Serviço / Produto</th>
                      <th className="py-2.5 px-3 text-right">Valor da OS</th>
                      <th className="py-2.5 px-3 text-right">Seu Bônus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {itensPendentes.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 text-muted-foreground font-medium">
                          {formatarData(item.criado_em)}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-foreground">
                          OS #{item.numero}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-foreground">
                          {item.cliente_nome}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {item.produto_nome}
                        </td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground">
                          {formatarMoeda(Number(item.valor_pedido) || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-amber-600 dark:text-amber-400 text-sm">
                          +{formatarMoeda(Number(item.valor_comissao) || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aba 2: Meus Recibos Anteriores */}
      {abaAtiva === "recibos" && (
        <Card className="border shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-500" />
              Meus Recibos de Pagamento
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Histórico oficial de comprovantes e repasses efetuados pela administração.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {recibos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Receipt className="h-10 w-10 stroke-[1.5] mb-2 opacity-30 text-emerald-500" />
                <p className="text-sm font-bold">Nenhum recibo emitido ainda</p>
                <p className="text-xs opacity-75 mt-0.5">
                  Seus comprovantes oficiais com assinatura aparecerão aqui assim que o fechamento for pago.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recibos.map((rec) => {
                  const rotuloForma =
                    rec.forma_pagamento === "pix" ? "PIX" :
                    rec.forma_pagamento === "dinheiro" ? "Dinheiro" :
                    rec.forma_pagamento === "deposito" ? "Depósito" : "Outro"

                  return (
                    <div
                      key={rec.id}
                      className="rounded-xl border p-4 bg-card hover:border-primary/50 transition-all flex flex-col justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground block">
                            Recibo Oficial
                          </span>
                          <span className="font-black text-base text-foreground">
                            {rec.numero_recibo}
                          </span>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Pago em {formatarData(rec.criado_em)} • via {rotuloForma}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-base font-black text-emerald-600 dark:text-emerald-400 block">
                            {formatarMoeda(Number(rec.valor_total) || 0)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                            <ShieldCheck className="h-3 w-3 text-emerald-500" />
                            {rec.assinado_em ? "Assinado" : "Aguardando Assinatura"}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">
                          Repassado por: <strong>{rec.pago_por || "Administração"}</strong>
                        </span>

                        <Link
                          href={`/equipe/recibo/${rec.id}`}
                          className={buttonVariants({ variant: "outline", size: "sm", className: "h-7 text-xs font-bold gap-1" })}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Ver Recibo
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aba 3: Histórico Completo de Peças */}
      {abaAtiva === "historico" && (
        <Card className="border shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" />
              Histórico Recente de Produção
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Últimas peças registradas no seu nome com status de repasse.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {historicoRecente.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                Nenhum registro histórico encontrado
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-[10px] uppercase font-black text-muted-foreground border-b">
                    <tr>
                      <th className="py-2 px-3">Data</th>
                      <th className="py-2 px-3">OS</th>
                      <th className="py-2 px-3">Cliente</th>
                      <th className="py-2 px-3">Produto</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3 text-right">Bônus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {historicoRecente.map((h) => (
                      <tr key={h.id} className="hover:bg-muted/20">
                        <td className="py-2 px-3 text-muted-foreground">{formatarData(h.criado_em)}</td>
                        <td className="py-2 px-3 font-bold">OS #{h.numero}</td>
                        <td className="py-2 px-3 font-medium">{h.cliente_nome}</td>
                        <td className="py-2 px-3 text-muted-foreground">{h.produto_nome}</td>
                        <td className="py-2 px-3">
                          {h.status === "pago" ? (
                            <span className="rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-black uppercase">
                              Pago
                            </span>
                          ) : (
                            <span className="rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[10px] font-black uppercase">
                              Pendente
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-foreground">
                          {formatarMoeda(Number(h.valor_comissao) || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
