"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { useData } from "@/context/data-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatarData, formatarMoeda } from "@/lib/format"
import { formatarNumeroOrcamento } from "@/lib/orcamento-pdf"
import {
  entraNoQuadro,
  linkWhatsApp,
  retornoDoOrcamento,
  situacaoContato,
  somarDias,
  type SituacaoContato,
} from "@/lib/retornos"
import type { Cliente, EtapaRetorno, Orcamento, RetornoOrcamento } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  CalendarClock,
  FileText,
  MessageCircle,
  Search,
  StickyNote,
  UserRound,
} from "lucide-react"

const colunas: {
  etapa: EtapaRetorno
  titulo: string
  cor: string
  corFundo: string
  corTexto: string
  corBorda: string
}[] = [
  { etapa: "aguardando", titulo: "Aguardando retorno", cor: "bg-amber-500", corFundo: "bg-amber-500/10", corTexto: "text-amber-600 dark:text-amber-400", corBorda: "ring-amber-500/50" },
  { etapa: "negociacao", titulo: "Em negociação", cor: "bg-blue-500", corFundo: "bg-blue-500/10", corTexto: "text-blue-600 dark:text-blue-400", corBorda: "ring-blue-500/50" },
  { etapa: "aprovado", titulo: "Aprovado", cor: "bg-emerald-500", corFundo: "bg-emerald-500/10", corTexto: "text-emerald-600 dark:text-emerald-400", corBorda: "ring-emerald-500/50" },
  { etapa: "perdido", titulo: "Perdido", cor: "bg-slate-500", corFundo: "bg-slate-500/10", corTexto: "text-slate-600 dark:text-slate-400", corBorda: "ring-slate-500/50" },
]

// Aprovados e perdidos antigos saem do quadro pra ele não virar arquivo morto.
const DIAS_VISIVEL_FINALIZADO = 30
const UM_DIA_MS = 24 * 60 * 60 * 1000

interface CardRetorno {
  orcamento: Orcamento
  cliente: Cliente | undefined
  retorno: RetornoOrcamento
  situacao: SituacaoContato | null
}

function mensagemWhatsApp(card: CardRetorno) {
  const nome = card.cliente?.nome?.split(" ")[0] ?? ""
  const numero = formatarNumeroOrcamento(card.orcamento.numero, card.orcamento.criadoEm)
  const total = formatarMoeda(card.orcamento.totalFechado ?? 0)
  return `Olá${nome ? `, ${nome}` : ""}! Aqui é da Toldos Print. Passando pra saber se você conseguiu ver o orçamento nº ${numero} (${total}). Ficou alguma dúvida?`
}

export default function RetornosPage() {
  const { orcamentos, clientes, atualizarRetorno } = useData()
  const [busca, setBusca] = useState("")
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // `new Date()` só depois de montar (mesmo cuidado de hydration do dashboard).
  const [hoje, setHoje] = useState<Date | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHoje(new Date())
  }, [])

  const cards = useMemo<CardRetorno[]>(() => {
    if (!hoje) return []
    const termo = busca.trim().toLowerCase()
    return orcamentos
      .filter(entraNoQuadro)
      .map((orcamento) => {
        const retorno = retornoDoOrcamento(orcamento)
        return {
          orcamento,
          cliente: clientes.find((c) => c.id === orcamento.clienteId),
          retorno,
          situacao: situacaoContato(retorno, hoje),
        }
      })
      .filter((card) => {
        const finalizado = card.retorno.etapa === "aprovado" || card.retorno.etapa === "perdido"
        if (finalizado) {
          const idade = hoje.getTime() - new Date(card.retorno.atualizadoEm).getTime()
          if (idade > DIAS_VISIVEL_FINALIZADO * UM_DIA_MS) return false
        }
        if (!termo) return true
        return (
          (card.cliente?.nome ?? "").toLowerCase().includes(termo) ||
          String(card.orcamento.numero).includes(termo) ||
          (card.retorno.anotacao ?? "").toLowerCase().includes(termo)
        )
      })
      .sort((a, b) =>
        (a.retorno.proximoContato ?? "9999").localeCompare(b.retorno.proximoContato ?? "9999")
      )
  }, [orcamentos, clientes, busca, hoje])

  const paraHoje = cards.filter((c) => c.situacao === "hoje").length
  const atrasados = cards.filter((c) => c.situacao === "atrasado").length
  const aprovados = cards.filter((c) => c.retorno.etapa === "aprovado").length
  const perdidos = cards.filter((c) => c.retorno.etapa === "perdido").length
  const taxa = aprovados + perdidos > 0 ? Math.round((aprovados / (aprovados + perdidos)) * 100) : null

  const cardArrastando = cards.find((c) => c.orcamento.id === arrastandoId) ?? null
  const cardEditando = cards.find((c) => c.orcamento.id === editandoId) ?? null

  function moverPara(card: CardRetorno, etapa: EtapaRetorno) {
    if (card.retorno.etapa === etapa) return
    atualizarRetorno(card.orcamento.id, {
      etapa,
      proximoContato: card.retorno.proximoContato,
      anotacao: card.retorno.anotacao,
      responsavel: card.retorno.responsavel,
    })
  }

  function handleDragStart(e: DragStartEvent) {
    setArrastandoId(String(e.active.id))
  }

  function handleDragEnd(e: DragEndEvent) {
    setArrastandoId(null)
    const card = cards.find((c) => c.orcamento.id === e.active.id)
    if (card && e.over) moverPara(card, e.over.id as EtapaRetorno)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Retornos</h1>
          <p className="text-sm text-muted-foreground">
            Orçamentos emitidos pra acompanhar com o cliente até fechar. Arraste
            o card entre as colunas e marque quando entrar em contato de novo.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente, nº ou anotação"
            className="pl-8"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Resumo
          destaque={atrasados > 0 ? "erro" : undefined}
          rotulo="Contatos atrasados"
          valor={atrasados}
        />
        <Resumo destaque={paraHoje > 0 ? "aviso" : undefined} rotulo="Pra contatar hoje" valor={paraHoje} />
        <Resumo
          rotulo={`Taxa de fechamento (${DIAS_VISIVEL_FINALIZADO} dias)`}
          valor={taxa === null ? "—" : `${taxa}%`}
        />
      </div>

      {/* Celular: lista por etapa, troca de etapa pelo card */}
      <div className="flex flex-col gap-5 md:hidden">
        {colunas.map((col) => {
          const daColuna = cards.filter((c) => c.retorno.etapa === col.etapa)
          return (
            <section key={col.etapa} className="flex flex-col gap-2">
              <TituloColuna coluna={col} quantidade={daColuna.length} />
              {daColuna.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Vazio
                </p>
              ) : (
                daColuna.map((card) => (
                  <CardConteudo key={card.orcamento.id} card={card} onAbrir={() => setEditandoId(card.orcamento.id)} />
                ))
              )}
            </section>
          )
        })}
      </div>

      {/* Desktop: kanban com arrastar e soltar */}
      <div className="hidden md:block">
        <DndContext sensors={sensores} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-4 gap-3">
            {colunas.map((col) => {
              const daColuna = cards.filter((c) => c.retorno.etapa === col.etapa)
              return (
                <ColunaDroppable key={col.etapa} coluna={col}>
                  <TituloColuna coluna={col} quantidade={daColuna.length} />
                  <div className="flex flex-col gap-2 p-2">
                    {daColuna.length === 0 && (
                      <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                        Vazio
                      </div>
                    )}
                    {daColuna.map((card) => (
                      <CardArrastavel key={card.orcamento.id} id={card.orcamento.id}>
                        <CardConteudo card={card} onAbrir={() => setEditandoId(card.orcamento.id)} />
                      </CardArrastavel>
                    ))}
                  </div>
                </ColunaDroppable>
              )
            })}
          </div>
          <DragOverlay>
            {cardArrastando ? (
              <div className="rotate-2 opacity-90 shadow-xl">
                <CardConteudo card={cardArrastando} onAbrir={() => {}} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {cardEditando && hoje && (
        <EditarRetornoDialog
          key={cardEditando.orcamento.id}
          card={cardEditando}
          hoje={hoje}
          onFechar={() => setEditandoId(null)}
          onSalvar={(retorno) => {
            atualizarRetorno(cardEditando.orcamento.id, retorno)
            setEditandoId(null)
          }}
        />
      )}
    </div>
  )
}

function Resumo({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string
  valor: ReactNode
  destaque?: "erro" | "aviso"
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2",
        destaque === "erro" && "border-destructive/40 bg-destructive/10",
        destaque === "aviso" && "border-amber-500/40 bg-amber-500/10"
      )}
    >
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="font-semibold">{valor}</span>
    </div>
  )
}

function TituloColuna({
  coluna,
  quantidade,
}: {
  coluna: (typeof colunas)[number]
  quantidade: number
}) {
  return (
    <div className={cn("flex items-center justify-between rounded-t-lg px-3 py-2", coluna.corFundo)}>
      <div className="flex items-center gap-2">
        <div className={cn("h-2 w-2 rounded-full", coluna.cor)} />
        <span className={cn("text-xs font-bold uppercase tracking-wide", coluna.corTexto)}>
          {coluna.titulo}
        </span>
      </div>
      <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", coluna.corFundo, coluna.corTexto)}>
        {quantidade}
      </span>
    </div>
  )
}

function ColunaDroppable({
  coluna,
  children,
}: {
  coluna: (typeof colunas)[number]
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.etapa })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-40 flex-col rounded-lg border border-border bg-muted/30 transition-colors",
        isOver && `${coluna.corFundo} ring-2 ring-inset ${coluna.corBorda}`
      )}
    >
      {children}
    </div>
  )
}

function CardArrastavel({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn("cursor-grab touch-none active:cursor-grabbing", isDragging && "opacity-30")}
    >
      {children}
    </div>
  )
}

function BadgeContato({ retorno, situacao }: { retorno: RetornoOrcamento; situacao: SituacaoContato | null }) {
  if (!retorno.proximoContato || situacao === null) return null
  if (situacao === "atrasado") {
    return (
      <Badge variant="destructive" className="gap-1 px-1.5 py-0 text-[10px]">
        <AlertTriangle className="h-3 w-3" />
        {formatarData(retorno.proximoContato)}
      </Badge>
    )
  }
  if (situacao === "hoje") {
    return (
      <Badge className="gap-1 bg-amber-500 px-1.5 py-0 text-[10px] text-white hover:bg-amber-500">
        <CalendarClock className="h-3 w-3" />
        Hoje
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
      <CalendarClock className="h-3 w-3" />
      {formatarData(retorno.proximoContato)}
    </Badge>
  )
}

function CardConteudo({ card, onAbrir }: { card: CardRetorno; onAbrir: () => void }) {
  const whatsapp = card.cliente?.telefone ? linkWhatsApp(card.cliente.telefone, mensagemWhatsApp(card)) : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.key === "Enter") onAbrir()
      }}
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-3 text-left text-sm shadow-sm transition-colors hover:bg-accent/40",
        card.situacao === "atrasado" ? "border-destructive/50" : card.situacao === "hoje" ? "border-amber-500/60" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-bold text-muted-foreground">
          #{formatarNumeroOrcamento(card.orcamento.numero, card.orcamento.criadoEm)}
        </span>
        <BadgeContato retorno={card.retorno} situacao={card.situacao} />
      </div>

      <div>
        <p className="truncate font-medium leading-tight">{card.cliente?.nome ?? "Cliente removido"}</p>
        <p className="text-xs text-muted-foreground">{formatarMoeda(card.orcamento.totalFechado ?? 0)}</p>
      </div>

      {card.retorno.anotacao && (
        <p className="line-clamp-2 flex gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
          <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
          {card.retorno.anotacao}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground">
          {card.retorno.responsavel && (
            <>
              <UserRound className="h-3 w-3 shrink-0" />
              {card.retorno.responsavel}
            </>
          )}
        </span>
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </a>
        )}
      </div>
    </div>
  )
}

function EditarRetornoDialog({
  card,
  hoje,
  onFechar,
  onSalvar,
}: {
  card: CardRetorno
  hoje: Date
  onFechar: () => void
  onSalvar: (retorno: Omit<RetornoOrcamento, "atualizadoEm">) => void
}) {
  const { user } = useUser()
  const [etapa, setEtapa] = useState<EtapaRetorno>(card.retorno.etapa)
  const [proximoContato, setProximoContato] = useState(card.retorno.proximoContato ?? "")
  const [anotacao, setAnotacao] = useState(card.retorno.anotacao ?? "")
  const [responsavel, setResponsavel] = useState(
    card.retorno.responsavel ?? user?.firstName ?? ""
  )
  const finalizado = etapa === "aprovado" || etapa === "perdido"
  const whatsapp = card.cliente?.telefone ? linkWhatsApp(card.cliente.telefone, mensagemWhatsApp(card)) : null

  const atalhos: { rotulo: string; dias: number }[] = [
    { rotulo: "Hoje", dias: 0 },
    { rotulo: "Amanhã", dias: 1 },
    { rotulo: "+3 dias", dias: 3 },
    { rotulo: "+1 semana", dias: 7 },
  ]

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {card.cliente?.nome ?? "Cliente"} — #{formatarNumeroOrcamento(card.orcamento.numero, card.orcamento.criadoEm)}
          </DialogTitle>
          <DialogDescription>
            {formatarMoeda(card.orcamento.totalFechado ?? 0)}
            {card.cliente?.telefone ? ` · ${card.cliente.telefone}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Etapa</Label>
            <div className="grid grid-cols-2 gap-2">
              {colunas.map((col) => (
                <button
                  key={col.etapa}
                  type="button"
                  onClick={() => setEtapa(col.etapa)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                    etapa === col.etapa
                      ? cn("border-transparent ring-2", col.corBorda, col.corFundo, col.corTexto, "font-medium")
                      : "border-border hover:bg-accent"
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", col.cor)} />
                  {col.titulo}
                </button>
              ))}
            </div>
          </div>

          {!finalizado && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="proximo-contato">Próximo contato</Label>
              <Input
                id="proximo-contato"
                type="date"
                value={proximoContato}
                onChange={(e) => setProximoContato(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5">
                {atalhos.map((a) => (
                  <Button
                    key={a.rotulo}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setProximoContato(somarDias(undefined, a.dias, hoje))}
                  >
                    {a.rotulo}
                  </Button>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={() => setProximoContato("")}>
                  Sem data
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="anotacao">Anotação</Label>
            <Textarea
              id="anotacao"
              value={anotacao}
              onChange={(e) => setAnotacao(e.target.value)}
              placeholder="Ex: cliente pediu desconto, vai decidir até sexta"
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="responsavel">Responsável</Label>
            <Input
              id="responsavel"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Quem vai falar com o cliente"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {whatsapp && (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<a href={whatsapp} target="_blank" rel="noopener noreferrer" />}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Chamar no WhatsApp
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/orcamentos/${card.orcamento.id}/orcamento`} />}
            >
              <FileText className="mr-2 h-4 w-4" />
              Ver orçamento
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onSalvar({
                etapa,
                proximoContato: finalizado ? undefined : proximoContato || undefined,
                anotacao: anotacao.trim() || undefined,
                responsavel: responsavel.trim() || undefined,
              })
            }
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
