"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { useData } from "@/context/data-context"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/brand/logo"
import { formatarData, formatarMoeda } from "@/lib/format"
import { formatarNumeroOrcamento, gerarLinhasOrcamento } from "@/lib/orcamento-pdf"
import { calcularOrcamentoSalvo } from "@/lib/orcamento-itens"
import { linkWhatsapp } from "@/lib/whatsapp"
import { ArrowLeft, MessageCircle, Printer } from "lucide-react"

export default function OrdemDeServicoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { orcamentos, clientes, materiais, servicos, acabamentos } = useData()

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

  const unidadeMaterial = orcamento.materialFechado?.unidade ?? material?.unidade
  const nomeMaterial = orcamento.materialFechado?.nome ?? material?.nome ?? "Material removido"
  const validadeAte = new Date(orcamento.criadoEm)
  validadeAte.setDate(validadeAte.getDate() + (orcamento.validadeDias ?? 7))

  const totalFinal = orcamento.totalFechado ?? resultado?.total ?? 0
  const hoje = new Date()
  const [enviando, setEnviando] = useState(false)
  const numeroFormatado = formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)

  const adicionaisParaPdf = (orcamento.item.itensAdicionais ?? []).map((extra) => {
    const materialExtra = materiais.find((m) => m.id === extra.materialId)
    return {
      item: extra,
      nomeMaterial: extra.materialFechado?.nome ?? materialExtra?.nome ?? "Material",
      unidadeMaterial: (extra.materialFechado?.unidade ?? materialExtra?.unidade ?? "un") as any,
    }
  })

  const linhas = resultado
    ? gerarLinhasOrcamento({
        item: orcamento.item,
        nomeMaterial,
        unidadeMaterial: (unidadeMaterial as any) ?? "un",
        acabamentosDisponiveis: acabamentos,
        resultado,
        total: totalFinal,
        adicionais: adicionaisParaPdf,
      })
    : []

  async function handleEnviarWhatsapp() {
    if (!orcamento) return
    if (!cliente?.telefone) {
      toast.error("Cliente não possui telefone cadastrado.")
      return
    }
    setEnviando(true)
    try {
      let linkAssinatura = ""
      try {
        const resToken = await fetch("/api/assinar/criar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orcamentoId: orcamento.id }),
        })
        if (resToken.ok) {
          const dadosToken = await resToken.json()
          linkAssinatura = dadosToken.url
        }
      } catch (e) {
        console.warn("Falha gerando token de assinatura:", e)
      }

      const mensagem = `Olá, ${cliente.nome.split(" ")[0]}! Segue a Ordem de Serviço nº ${numeroFormatado} da Toldos Print.${linkAssinatura ? `\n\nVocê pode assinar digitalmente pelo link abaixo:\n${linkAssinatura}` : ""}`

      // Envia PDF pelo bot
      await fetch("/api/whatsapp/enviar-os", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orcamentoId: orcamento.id, telefone: cliente.telefone }),
      }).catch(() => {})

      // Envia notificação com link de assinatura
      await fetch("/api/whatsapp/enviar-notificacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefone: cliente.telefone,
          mensagem,
          clienteId: cliente.id,
          clienteNome: cliente.nome,
        }),
      }).catch(() => {})

      // Abre WhatsApp web/app
      const linkWa = linkWhatsapp(cliente.telefone, mensagem)
      if (linkWa) {
        window.open(linkWa, "_blank")
      }

      toast.success("Ordem de Serviço enviada para o WhatsApp!")
    } catch {
      toast.error("Erro ao preparar envio da OS.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      {/* Barra de ações — só na tela, some ao imprimir */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" onClick={() => router.push("/orcamentos")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div className="flex flex-wrap gap-2">
          {cliente?.telefone ? (
            <Button
              variant="outline"
              onClick={handleEnviarWhatsapp}
              disabled={enviando}
              className="border-emerald-600/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              {enviando ? "Enviando..." : "Enviar OS pelo WhatsApp"}
            </Button>
          ) : (
            <Button variant="outline" disabled title="Cliente sem telefone cadastrado">
              <MessageCircle className="mr-2 h-4 w-4" />
              Cliente sem telefone
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => router.push(`/orcamentos/${orcamento.id}/orcamento`)}
          >
            Ver orçamento (PDF)
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir OS
          </Button>
        </div>
      </div>

      {/* Documento imprimível */}
      <div
        id="os-print"
        className="mx-auto max-w-2xl rounded-xl border border-border bg-white p-8 shadow-sm print:mx-0 print:w-full print:max-w-none print:rounded-none print:border-none print:shadow-none print:p-0"
        style={{ fontFamily: "'Segoe UI', Arial, sans-serif", color: "#111" }}
      >
        {/* ──────────── CABEÇALHO ──────────── */}
        <div className="flex items-center justify-between border-b-2 border-gray-800 pb-5">
          <Logo className="w-44 rounded-lg" />
          <div className="text-right">
            <p className="text-2xl font-bold tracking-tight text-gray-800">ORDEM DE SERVIÇO</p>
            <p className="mt-1 text-lg font-semibold text-gray-600">Nº {String(orcamento.numero).padStart(4, "0")}</p>
            <p className="mt-1 text-xs text-gray-500">
              Emitida em {formatarData(hoje.toISOString())}
            </p>
          </div>
        </div>

        {/* ──────────── DADOS DO CLIENTE ──────────── */}
        <div className="mt-5 rounded-lg bg-gray-50 p-4" style={{ border: "1px solid #e5e7eb" }}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Dados do cliente
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div>
              <span className="text-gray-500">Nome: </span>
              <span className="font-semibold">{cliente?.nome ?? "—"}</span>
            </div>
            {cliente?.telefone && (
              <div>
                <span className="text-gray-500">Telefone: </span>
                <span className="font-semibold">{cliente.telefone}</span>
              </div>
            )}
            {cliente?.email && (
              <div className="col-span-2">
                <span className="text-gray-500">E-mail: </span>
                <span className="font-semibold">{cliente.email}</span>
              </div>
            )}
            <div>
              <span className="text-gray-500">Orçamento criado em: </span>
              <span className="font-semibold">{formatarData(orcamento.criadoEm)}</span>
            </div>
            <div>
              <span className="text-gray-500">Válido até: </span>
              <span className="font-semibold">{formatarData(validadeAte.toISOString())}</span>
            </div>
          </div>
        </div>

        {/* ──────────── DESCRIÇÃO DO SERVIÇO ──────────── */}
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Descrição do serviço
          </p>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#1f2937", color: "#fff" }}>
                <th className="px-3 py-2 text-left font-semibold">Item / Descrição</th>
                <th className="px-3 py-2 text-center font-semibold">Qtd</th>
                <th className="px-3 py-2 text-right font-semibold">Vl. Unit.</th>
                <th className="px-3 py-2 text-right font-semibold">Vl. Total</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length > 0 ? (
                linhas.map((l, i) => (
                  <tr key={`${l.nome}-${i}`} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td className="px-3 py-2 font-medium">
                      {l.nome}
                    </td>
                    <td className="px-3 py-2 text-center text-gray-600">
                      {l.quantidade} {l.unidade}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {formatarMoeda(l.valorUnitario)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatarMoeda(l.valorTotal)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td className="px-3 py-2 font-medium">{nomeMaterial}</td>
                  <td className="px-3 py-2 text-center text-gray-600">1 un</td>
                  <td className="px-3 py-2 text-right text-gray-600">{formatarMoeda(totalFinal)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatarMoeda(totalFinal)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: "#1f2937", color: "#fff" }}>
                <td colSpan={3} className="px-3 py-3 text-base font-bold">
                  TOTAL
                </td>
                <td className="px-3 py-3 text-right text-base font-bold">
                  {formatarMoeda(totalFinal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ──────────── GARANTIA ──────────── */}
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-600">
          <span className="font-semibold text-gray-800">Garantia: </span>
          Este serviço possui garantia de 3 (três) meses contra defeitos de fabricação, contados a partir da data de entrega.
        </div>

        {/* Anexo */}
        {orcamento.anexoNome && (
          <div className="mt-4 text-sm">
            <span className="text-gray-500">Anexo de referência: </span>
            {orcamento.anexoUrl ? (
              <a
                href={orcamento.anexoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                {orcamento.anexoNome}
              </a>
            ) : (
              <span className="font-medium">{orcamento.anexoNome}</span>
            )}
          </div>
        )}

        {/* ──────────── ASSINATURAS ──────────── */}
        <div className="mt-10 grid grid-cols-2 gap-8">
          <div className="flex flex-col items-center gap-1">
            <div style={{ borderTop: "1.5px solid #374151", width: "100%" }} />
            <p className="text-xs text-gray-500">Assinatura do cliente</p>
            <p className="text-xs text-gray-400">{cliente?.nome ?? ""}</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div style={{ borderTop: "1.5px solid #374151", width: "100%" }} />
            <p className="text-xs text-gray-500">Responsável pela empresa</p>
            <p className="text-xs text-gray-400">Toldos Print</p>
          </div>
        </div>

        {/* ──────────── RODAPÉ ──────────── */}
        <div className="mt-6 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
          <p className="font-semibold text-gray-600">Toldos Print · Toldos e Comunicação Visual</p>
          <p className="mt-0.5">
            (27) 99748-9714 · (27) 99612-5835 · @toldosprint
          </p>
          <p className="mt-0.5">Documento gerado em {formatarData(hoje.toISOString())}</p>
        </div>
      </div>

      <style>{`
        @page {
          size: A4;
          margin: 1.5cm;
        }
        @media print {
          html, body {
            background: white !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          script, style, link, noscript { display: none !important; }
          #os-print {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: none !important;
            font-size: 13pt !important;
          }
          #os-print p, #os-print td, #os-print th, #os-print span, #os-print div {
            font-size: inherit;
          }
          #os-print .text-2xl { font-size: 22pt !important; }
          #os-print .text-lg  { font-size: 16pt !important; }
          #os-print .text-base { font-size: 13pt !important; }
          #os-print .text-sm  { font-size: 11pt !important; }
          #os-print .text-xs  { font-size: 9pt  !important; }
          #os-print .text-\\[10px\\] { font-size: 8pt !important; }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}</style>
    </>
  )
}
