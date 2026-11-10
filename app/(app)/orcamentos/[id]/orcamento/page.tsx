"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { useData } from "@/context/data-context"
import { Button } from "@/components/ui/button"
import { calcularOrcamentoSalvo } from "@/lib/orcamento-itens"
import { ehImagem, formatarNumeroOrcamento, gerarLinhasOrcamento } from "@/lib/orcamento-pdf"
import { textoCondicoesPagamento } from "@/lib/parcelas"
import { OrcamentoOficial } from "@/components/orcamentos/orcamento-oficial"
import { acabamentosSeed } from "@/lib/seed-data"
import { ArrowLeft, MessageCircle, Printer } from "lucide-react"
import { formatarData, formatarMoeda } from "@/lib/format"
import { linkWhatsapp, mensagemOrcamentoWhatsapp } from "@/lib/whatsapp"
import { gerarPdfOrcamento } from "@/lib/pdf-orcamento"
import { compartilharOuBaixarArquivo } from "@/lib/compartilhar"

export default function OrcamentoOficialPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { orcamentos, clientes, materiais, servicos } = useData()
  const [enviando, setEnviando] = useState(false)

  const orcamento = orcamentos.find((o) => o.id === id)

  if (!orcamento) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <p className="text-sm text-muted-foreground">Orçamento não encontrado.</p>
        <Button variant="outline" className="self-start" onClick={() => router.push("/orcamentos")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao histórico
        </Button>
      </div>
    )
  }

  const cliente = clientes.find((c) => c.id === orcamento.clienteId)
  const material = materiais.find((m) => m.id === orcamento.item.materialId)

  const resultado = calcularOrcamentoSalvo(orcamento, materiais, servicos)

  const total = orcamento.totalFechado ?? resultado?.total ?? 0
  const nomeMaterial = orcamento.materialFechado?.nome ?? material?.nome ?? "Material removido"
  const unidadeMaterial = orcamento.materialFechado?.unidade ?? material?.unidade ?? "unidade"

  const linhas = resultado
    ? gerarLinhasOrcamento({
        item: orcamento.item,
        nomeMaterial,
        unidadeMaterial,
        acabamentosDisponiveis: acabamentosSeed,
        resultado,
        total,
        adicionais: (orcamento.item.itensAdicionais ?? []).map((extra) => {
          const materialExtra = materiais.find((m) => m.id === extra.materialId)
          return {
            item: extra,
            nomeMaterial: extra.materialFechado?.nome ?? materialExtra?.nome ?? "Material removido",
            unidadeMaterial: extra.materialFechado?.unidade ?? materialExtra?.unidade ?? ("unidade" as const),
          }
        }),
      })
    : []

  const fotos = [
    ...(orcamento.anexoUrl && ehImagem(orcamento.anexoNome)
      ? [{ url: orcamento.anexoUrl, legenda: "" }]
      : []),
    ...(orcamento.item.fotos ?? []),
  ]
  const condicoes = orcamento.item.condicoesPagamento?.trim() || textoCondicoesPagamento(orcamento.item.entradaPercent)
  const numero = formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)

  const validoAte = new Date(orcamento.criadoEm)
  validoAte.setDate(validoAte.getDate() + (orcamento.validadeDias ?? 7))
  const mensagemWhatsapp = mensagemOrcamentoWhatsapp({
    clienteNome: cliente?.nome ?? "cliente",
    numero,
    total: formatarMoeda(total).replace(/\u00a0/g, " "),
    validoAte: formatarData(validoAte.toISOString()),
  })
  const linkDoWhatsapp = linkWhatsapp(cliente?.telefone ?? "", mensagemWhatsapp)

  async function handleEnviarWhatsapp() {
    if (!linkDoWhatsapp) return
    setEnviando(true)
    try {
      const arquivo = await gerarPdfOrcamento("orcamento-print", `Orcamento-${numero}.pdf`)
      const resultado = await compartilharOuBaixarArquivo(arquivo, mensagemWhatsapp)
      if (resultado === "compartilhado") {
        toast.success("Escolha o WhatsApp e o contato na tela de compartilhamento.")
      } else if (resultado === "baixado") {
        toast.success("PDF baixado. Abrindo o WhatsApp \u2014 \u00e9 s\u00f3 anexar o arquivo na conversa.")
        window.open(linkDoWhatsapp, "_blank")
      }
    } catch {
      toast.error("N\u00e3o consegui gerar o PDF. Abrindo o WhatsApp sem o anexo.")
      window.open(linkDoWhatsapp, "_blank")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" onClick={() => router.push("/orcamentos")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div className="flex flex-wrap gap-2">
          {linkDoWhatsapp ? (
            <Button variant="outline" onClick={handleEnviarWhatsapp} disabled={enviando}>
              <MessageCircle className="mr-2 h-4 w-4" />
              {enviando ? "Gerando PDF..." : "Enviar pelo WhatsApp"}
            </Button>
          ) : (
            <Button variant="outline" disabled title="O cliente não tem telefone cadastrado">
              <MessageCircle className="mr-2 h-4 w-4" />
              Cliente sem telefone
            </Button>
          )}
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / salvar PDF
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <OrcamentoOficial
          clienteNome={cliente?.nome ?? "—"}
          data={orcamento.criadoEm}
          numero={numero}
          linhas={linhas}
          total={total}
          condicoes={condicoes}
          entradaPercent={orcamento.item.entradaPercent}
          fotos={fotos}
        />
      </div>
    </>
  )
}
