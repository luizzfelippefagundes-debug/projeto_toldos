"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { useData } from "@/context/data-context"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/brand/logo"
import { formatarData, formatarMoeda } from "@/lib/format"
import { formatarNumeroOrcamento, gerarLinhasOrcamento } from "@/lib/orcamento-pdf"
import { calcularOrcamentoSalvo } from "@/lib/orcamento-itens"
import { linkWhatsapp } from "@/lib/whatsapp"
import { ArrowLeft, MessageCircle, Printer, FileCheck, QrCode, Copy, Check, RefreshCw, CreditCard } from "lucide-react"
import { CobrancaCartaoDialog } from "@/components/orcamentos/cobranca-cartao-dialog"

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
  const material = materiais.find((m) => m.id === orcamento.item?.materialId)

  const resultado = calcularOrcamentoSalvo(orcamento, materiais, servicos)

  const unidadeMaterial = orcamento.materialFechado?.unidade ?? material?.unidade
  const nomeMaterial = orcamento.materialFechado?.nome ?? material?.nome ?? "Material"
  const validadeAte = new Date(orcamento.criadoEm || Date.now())
  validadeAte.setDate(validadeAte.getDate() + (orcamento.validadeDias ?? 7))

  const totalFinal = orcamento.totalFechado != null && !isNaN(orcamento.totalFechado)
    ? orcamento.totalFechado
    : resultado?.total != null && !isNaN(resultado.total)
    ? resultado.total
    : 0
  const saldoEntrega = Math.round((totalFinal / 2) * 100) / 100
  const hoje = new Date()
  const [enviando, setEnviando] = useState(false)
  const [pixQrBase64, setPixQrBase64] = useState<string | null>(orcamento.pixQrCodeBase64 ?? null)
  const [pixCopiaCola, setPixCopiaCola] = useState<string | null>(orcamento.pixCopiaECola ?? null)
  const [linkCartao, setLinkCartao] = useState<string | null>((orcamento as any).link_pagamento ?? null)
  const [gerandoPix, setGerandoPix] = useState(false)
  const [copiadoPix, setCopiadoPix] = useState(false)
  const [opcaoValor, setOpcaoValor] = useState<"total" | "entrada">("total")
  const numeroFormatado = formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)

  async function handleGerarPix(tipo: "total" | "entrada" = opcaoValor) {
    if (!orcamento) return
    const valorCobrar = tipo === "entrada" ? saldoEntrega : totalFinal
    setGerandoPix(true)
    try {
      const res = await fetch("/api/mercadopago/criar-pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orcamentoId: orcamento.id,
          valor: valorCobrar,
          descricao: `OS #${numeroFormatado} (${tipo === "entrada" ? "Entrada 50%" : "Total"}) - Toldos Print`,
        }),
      })
      const data = await res.json()
      if (data.ok && data.pix?.sucesso) {
        setPixQrBase64(data.pix.qrCodeBase64 || null)
        setPixCopiaCola(data.pix.qrCode || null)
        toast.success(`Pix do Mercado Pago pronto! (${formatarMoeda(valorCobrar)})`)
      } else {
        toast.error(data.erro || "Não foi possível gerar o Pix do Mercado Pago")
      }
    } catch {
      toast.error("Erro ao gerar Pix do Mercado Pago.")
    } finally {
      setGerandoPix(false)
    }
  }

  // Se ainda não tiver Pix gerado na OS, gera automaticamente ao abrir
  useEffect(() => {
    if (!pixQrBase64 && totalFinal > 0 && orcamento?.id) {
      handleGerarPix("total")
    }
  }, [orcamento?.id])

  function handleCopiarPix() {
    if (!pixCopiaCola) return
    navigator.clipboard.writeText(pixCopiaCola)
    setCopiadoPix(true)
    toast.success("Código Pix Copia e Cola copiado!")
    setTimeout(() => setCopiadoPix(false), 2500)
  }

  const adicionaisParaPdf = (orcamento.item?.itensAdicionais ?? []).map((extra) => {
    const materialExtra = materiais.find((m) => m.id === extra.materialId)
    return {
      item: extra,
      nomeMaterial: extra.materialFechado?.nome ?? materialExtra?.nome ?? "Material",
      unidadeMaterial: (extra.materialFechado?.unidade ?? materialExtra?.unidade ?? "un") as any,
    }
  })

  const linhas = resultado
    ? gerarLinhasOrcamento({
        item: orcamento.item || ({} as any),
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

      const pixCopiaColaBloco = pixCopiaCola
        ? `\n\n📋 *Código Pix Copia e Cola:*\n\`\`\`${pixCopiaCola}\`\`\``
        : ""

      const dadosPix = `\n\n💳 *DADOS PARA PAGAMENTO VIA PIX:*
👉 *Chave Pix (CNPJ):* 09.141.206/0001-06
👉 *Chave para copiar (só números):* 09141206000106
👤 *Favorecido:* Toldos Print & Comunicação Visual${pixCopiaColaBloco}`

      // Busca ou gera link de pagamento com cartão se não tiver
      let linkCartaoParaEnvio = linkCartao
      if (!linkCartaoParaEnvio && orcamento?.id) {
        try {
          const resLink = await fetch("/api/mercadopago/criar-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orcamentoId: orcamento.id }),
          })
          if (resLink.ok) {
            const dLink = await resLink.json()
            if (dLink.linkPagamento) {
              linkCartaoParaEnvio = dLink.linkPagamento
              setLinkCartao(dLink.linkPagamento)
            }
          }
        } catch {}
      }

      const linkCartaoBloco = linkCartaoParaEnvio
        ? `\n\n2️⃣ *Cartão de Crédito (em até 12x no Mercado Pago):*\n👉 ${linkCartaoParaEnvio}`
        : ""

      const linkAssinaturaBloco = linkAssinatura
        ? `\n\n✍️ *Assinar Ordem de Serviço digitalmente:*\n👉 ${linkAssinatura}`
        : ""

      const mensagem =
        `Olá, ${cliente.nome.split(" ")[0]}! Segue a Ordem de Serviço nº ${numeroFormatado} da Toldos Print. 📄✨\n\n` +
        `💰 *Valor Total:* ${formatarMoeda(totalFinal)}\n\n` +
        `*Qual forma de pagamento você prefere?*\n\n` +
        `1️⃣ *Pix (à vista):*${dadosPix}` +
        linkCartaoBloco +
        linkAssinaturaBloco +
        `\n\nAssim que realizar o pagamento ou assinar, favor enviar o comprovante por aqui para iniciarmos a produção imediatamente! 🤝✨`

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
          <Button
            variant="outline"
            onClick={() => router.push(`/orcamentos/${orcamento.id}/contrato`)}
          >
            <FileCheck className="mr-2 h-4 w-4" />
            Ver contrato
          </Button>
          <CobrancaCartaoDialog
            orcamentoId={orcamento.id}
            numeroOrcamento={orcamento.numero}
            valorTotal={totalFinal}
            nomeCliente={cliente?.nome}
            telefoneCliente={cliente?.telefone}
            linkInicial={linkCartao}
          />
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
          <img src="/brand/logo-orcamento.png" alt="Toldos Print" className="h-12 max-w-[200px] object-contain" />
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
                      <div>{l.nome}</div>
                      {l.observacao && (
                        <div className="text-xs text-gray-500 italic font-normal mt-0.5">
                          Obs: {l.observacao}
                        </div>
                      )}
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

        {/* ──────────── PAGAMENTO VIA PIX (MERCADO PAGO) ──────────── */}
        <div className="mt-5 rounded-lg border-2 border-sky-600/30 bg-sky-50/40 p-4 print:border-gray-400 print:bg-white print:p-3">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* QR Code */}
            <div className="flex flex-col items-center justify-center shrink-0">
              {pixQrBase64 ? (
                <div className="rounded-lg border border-sky-200 bg-white p-2 shadow-xs print:border-gray-500 print:p-1">
                  <img
                    src={`data:image/png;base64,${pixQrBase64}`}
                    alt="QR Code Pix Mercado Pago"
                    className="h-28 w-28 object-contain print:h-24 print:w-24"
                  />
                </div>
              ) : (
                <div className="flex h-28 w-28 flex-col items-center justify-center rounded-lg border border-dashed border-sky-300 bg-white text-center p-2">
                  <QrCode className="h-8 w-8 text-sky-500 mb-1" />
                  <span className="text-[10px] text-gray-500">
                    {gerandoPix ? "Gerando..." : "Pix Mercado Pago"}
                  </span>
                </div>
              )}
              <span className="mt-1 text-[9px] font-semibold text-sky-800 uppercase tracking-wider print:text-gray-700">
                Pague via Pix
              </span>
            </div>

            {/* Informações de Pagamento */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800 print:border print:border-gray-400 print:bg-white print:text-gray-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-600"></span>
                  PAGAMENTO VIA PIX · MERCADO PAGO
                </span>
                {orcamento.pagoEm && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    ✓ PAGO VIA PIX
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-700 mt-1">
                Aponte a câmera do celular ou app do banco para o QR Code ao lado ou utilize a chave oficial:
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <div>
                  <span className="text-gray-500">Chave Pix (CNPJ): </span>
                  <span className="font-bold text-gray-900 select-all">09.141.206/0001-06</span>
                </div>
                <div>
                  <span className="text-gray-500">Beneficiário: </span>
                  <span className="font-semibold text-gray-800">Toldos Print</span>
                </div>
                <div>
                  <span className="text-gray-500">Valor {opcaoValor === "entrada" ? "Entrada (50%)" : "Total"}: </span>
                  <span className="font-bold text-sky-700 print:text-gray-900">
                    {formatarMoeda(opcaoValor === "entrada" ? saldoEntrega : totalFinal)}
                  </span>
                </div>
              </div>

              {/* Ações em tela */}
              <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
                {pixCopiaCola && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCopiarPix}
                    className="h-8 border-sky-300 text-sky-700 hover:bg-sky-100 text-xs"
                  >
                    {copiadoPix ? (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                        Código Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        Copiar Pix Copia e Cola
                      </>
                    )}
                  </Button>
                )}

                <div className="inline-flex items-center rounded-md border border-gray-200 bg-white p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setOpcaoValor("total")
                      handleGerarPix("total")
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                      opcaoValor === "total"
                        ? "bg-sky-600 text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Total ({formatarMoeda(totalFinal)})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpcaoValor("entrada")
                      handleGerarPix("entrada")
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                      opcaoValor === "entrada"
                        ? "bg-sky-600 text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Entrada 50% ({formatarMoeda(saldoEntrega)})
                  </button>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleGerarPix(opcaoValor)}
                  disabled={gerandoPix}
                  title="Atualizar cobrança Pix no Mercado Pago"
                  className="h-8 text-xs text-gray-500 hover:text-gray-800"
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${gerandoPix ? "animate-spin" : ""}`} />
                  {gerandoPix ? "Gerando..." : "Recarregar Pix"}
                </Button>

                <CobrancaCartaoDialog
                  orcamentoId={orcamento.id}
                  numeroOrcamento={orcamento.numero}
                  valorTotal={opcaoValor === "entrada" ? saldoEntrega : totalFinal}
                  nomeCliente={cliente?.nome}
                  telefoneCliente={cliente?.telefone}
                  linkInicial={linkCartao}
                  trigger={
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 border-blue-400 text-blue-700 bg-blue-50/70 hover:bg-blue-100 text-xs font-bold gap-1.5"
                    >
                      <CreditCard className="h-3.5 w-3.5 text-blue-600" />
                      Cobrar no Cartão (Link / Maquininha)
                    </Button>
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* ──────────── FOTO DA PEÇA FINALIZADA (COMPROVAÇÃO DE PRODUÇÃO) ──────────── */}
        {orcamento.fotoProntoUrl && (
          <div className="mt-6 rounded-lg border-2 border-emerald-500/40 bg-emerald-50/50 p-4 print:border-gray-400">
            <div className="flex items-center gap-2 mb-2 text-emerald-800 font-bold text-xs uppercase tracking-wider">
              <span>📸</span>
              <span>Comprovação de Produção (Peça Finalizada na Fábrica)</span>
            </div>
            <div className="max-h-64 rounded-md overflow-hidden bg-white border border-emerald-300 flex items-center justify-center p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={orcamento.fotoProntoUrl}
                alt="Foto da Peça Pronta"
                className="max-h-60 max-w-full object-contain"
              />
            </div>
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
