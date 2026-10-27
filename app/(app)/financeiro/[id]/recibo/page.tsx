"use client"

import { useParams, useRouter } from "next/navigation"
import { useData } from "@/context/data-context"
import { Button } from "@/components/ui/button"
import { ReciboOficial, type DadosRecibo } from "@/components/financeiro/recibo-oficial"
import { formatarMoeda } from "@/lib/format"
import { formatarNumeroOrcamento } from "@/lib/orcamento-pdf"
import { linkWhatsApp } from "@/lib/retornos"
import { ArrowLeft, MessageCircle, Printer } from "lucide-react"

const rotuloForma: Record<string, string> = {
  boleto: "boleto",
  pix: "Pix",
  dinheiro: "dinheiro",
  cartao: "cartão",
  transferencia: "transferência",
}

export default function ReciboPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { lancamentos, clientes, orcamentos } = useData()

  const lancamento = lancamentos.find((l) => l.id === id)

  if (!lancamento || lancamento.tipo !== "receita" || lancamento.status !== "pago") {
    return (
      <div className="flex flex-col gap-4 p-8">
        <p className="text-sm text-muted-foreground">
          {lancamento && lancamento.status !== "pago"
            ? "Este lançamento ainda não foi pago. O recibo é gerado depois de marcar como pago."
            : "Recibo não encontrado."}
        </p>
        <Button variant="outline" className="self-start" onClick={() => router.push("/financeiro")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao financeiro
        </Button>
      </div>
    )
  }

  const cliente = clientes.find((c) => c.id === lancamento.clienteId)
  const orcamento =
    lancamento.origem === "orcamento"
      ? orcamentos.find((o) => o.id === lancamento.origemId)
      : undefined
  const numeroOrcamento = orcamento
    ? formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)
    : null

  const sufixo =
    lancamento.parcela === "entrada" ? "E" : lancamento.parcela === "restante" ? "R" : "U"

  let referente = lancamento.descricao
  if (numeroOrcamento) {
    if (lancamento.parcela === "entrada") {
      const pct = /Entrada (\d+(?:[.,]\d+)?)%/.exec(lancamento.descricao)?.[1]
      referente = `entrada${pct ? ` de ${pct}%` : ""} do orçamento nº ${numeroOrcamento}`
    } else if (lancamento.parcela === "restante") {
      referente = `saldo restante do orçamento nº ${numeroOrcamento}`
    } else {
      referente = `pagamento do orçamento nº ${numeroOrcamento}`
    }
  }

  let resumo: DadosRecibo["resumo"]
  if (orcamento) {
    const irmaos = lancamentos.filter(
      (l) => l.origem === "orcamento" && l.origemId === orcamento.id
    )
    const totalOrcamento = irmaos.reduce((soma, l) => soma + l.valor, 0)
    const totalPago = irmaos
      .filter((l) => l.status === "pago")
      .reduce((soma, l) => soma + l.valor, 0)
    const saldo = Math.round((totalOrcamento - totalPago) * 100) / 100
    resumo = {
      totalOrcamento,
      totalPago,
      saldo,
      vencimentoSaldo: irmaos.find((l) => l.status !== "pago")?.vencimento,
    }
  }

  const dados: DadosRecibo = {
    numero: numeroOrcamento ? `${numeroOrcamento}/${sufixo}` : lancamento.id.slice(-6).toUpperCase(),
    clienteNome: cliente?.nome ?? "Cliente",
    valor: lancamento.valor,
    referente,
    formaPagamento: lancamento.formaPagamento ? rotuloForma[lancamento.formaPagamento] : undefined,
    pagoEm: lancamento.pagoEm ?? lancamento.criadoEm,
    resumo,
  }

  const mensagem =
    `Olá${cliente ? `, ${cliente.nome.split(" ")[0]}` : ""}! Recebemos seu pagamento de ${formatarMoeda(lancamento.valor)} ` +
    `(${referente}). Segue o recibo em anexo. ` +
    (resumo && resumo.saldo > 0 ? `Saldo restante: ${formatarMoeda(resumo.saldo)}. ` : resumo ? "Orçamento quitado! " : "") +
    "Obrigado pela confiança! — Toldos Print"
  const whatsapp = cliente?.telefone ? linkWhatsApp(cliente.telefone, mensagem) : null

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" onClick={() => router.push("/financeiro")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {whatsapp && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={whatsapp} target="_blank" rel="noopener noreferrer" />}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Abrir WhatsApp do cliente
            </Button>
          )}
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / salvar PDF
          </Button>
        </div>
      </div>
      {whatsapp && (
        <p className="mb-4 text-xs text-muted-foreground print:hidden">
          Dica: salve o recibo em PDF primeiro e anexe na conversa do WhatsApp — o link já abre
          com a mensagem pronta.
        </p>
      )}

      <div className="overflow-x-auto print:overflow-visible">
        <ReciboOficial dados={dados} dataEmissao={new Date()} />
      </div>
    </>
  )
}
