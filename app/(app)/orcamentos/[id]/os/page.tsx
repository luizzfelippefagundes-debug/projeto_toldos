"use client"

import { useParams, useRouter } from "next/navigation"
import { useData } from "@/context/data-context"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/brand/logo"
import { calcularOrcamentoCompleto, quantidadeMaterialConsumida } from "@/lib/calculo"
import { formatarData, formatarMoeda } from "@/lib/format"
import { acabamentosSeed, equipamentosAcessoSeed } from "@/lib/seed-data"
import { ArrowLeft, Printer } from "lucide-react"

export default function OrdemDeServicoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { orcamentos, clientes, materiais, servicos } = useData()

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
  const servico = servicos.find((s) => s.id === orcamento.item.servicoId)

  const resultado = material
    ? calcularOrcamentoCompleto(
        orcamento.item,
        material,
        servico ?? null,
        orcamento.ajusteManual,
        acabamentosSeed,
        equipamentosAcessoSeed
      )
    : null

  const unidadeMaterial = orcamento.materialFechado?.unidade ?? material?.unidade
  const nomeMaterial = orcamento.materialFechado?.nome ?? material?.nome ?? "Material removido"
  const consumo =
    orcamento.materialFechado?.quantidade ??
    (material ? quantidadeMaterialConsumida(orcamento.item, material) : null)
  const servicoFoiEscolhido = Boolean(
    orcamento.item.servicoId && orcamento.item.servicoId !== "nenhum"
  )
  const nomeServico =
    orcamento.servicoFechado?.nome ??
    servico?.nome ??
    (servicoFoiEscolhido ? "Serviço removido" : "Nenhum")
  const ferramentas = orcamento.servicoFechado?.ferramentas ?? servico?.ferramentas

  const acabamentosSelecionados = (orcamento.item.acabamentos ?? [])
    .map((sel) => {
      const acabamento = acabamentosSeed.find((a) => a.id === sel.acabamentoId)
      return acabamento ? `${acabamento.nome} (${sel.quantidade} ${acabamento.unidade})` : null
    })
    .filter(Boolean)

  const instalacao = orcamento.item.instalacao
  const equipamento = equipamentosAcessoSeed.find((e) => e.id === instalacao?.equipamentoId)
  const deslocamento = orcamento.item.deslocamento
  const validadeAte = new Date(orcamento.criadoEm)
  validadeAte.setDate(validadeAte.getDate() + (orcamento.validadeDias ?? 7))
  const totalDeslocamento = deslocamento?.incluido
    ? deslocamento.distanciaKm * deslocamento.custoPorKm +
      deslocamento.pedagio +
      deslocamento.alimentacao
    : 0

  const totalFinal = orcamento.totalFechado ?? resultado?.total ?? 0
  const hoje = new Date()

  return (
    <>
      {/* Barra de ações — só na tela, some ao imprimir */}
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" onClick={() => router.push("/orcamentos")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimir OS
        </Button>
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
                <th className="px-3 py-2 text-left font-semibold">Item</th>
                <th className="px-3 py-2 text-left font-semibold">Especificação</th>
                <th className="px-3 py-2 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {/* Material */}
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td className="px-3 py-2 text-gray-500">Material</td>
                <td className="px-3 py-2 font-medium">
                  {nomeMaterial}
                  {consumo !== null && (
                    <span className="ml-2 text-gray-500">
                      ({unidadeMaterial === "m2"
                        ? `${orcamento.item.largura} × ${orcamento.item.altura} m = ${consumo.toFixed(2)} m²`
                        : `${orcamento.item.quantidadeUnidades} un`})
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {resultado ? formatarMoeda(resultado.subtotalMaterial) : "—"}
                </td>
              </tr>

              {/* Serviço */}
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td className="px-3 py-2 text-gray-500">Serviço / M.O.</td>
                <td className="px-3 py-2 font-medium">
                  {nomeServico}
                  {ferramentas?.trim() && (
                    <span className="ml-2 text-gray-400 text-xs">({ferramentas})</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {resultado ? formatarMoeda(resultado.subtotalMaoDeObra) : "—"}
                </td>
              </tr>

              {/* Acabamentos */}
              {acabamentosSelecionados.length > 0 && (
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td className="px-3 py-2 text-gray-500">Acabamentos</td>
                  <td className="px-3 py-2 font-medium">{acabamentosSelecionados.join(", ")}</td>
                  <td className="px-3 py-2 text-right">
                    {resultado ? formatarMoeda(resultado.subtotalAcabamentos) : "—"}
                  </td>
                </tr>
              )}

              {/* Instalação */}
              {instalacao?.incluida && (
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td className="px-3 py-2 text-gray-500">Instalação</td>
                  <td className="px-3 py-2 font-medium">
                    {instalacao.horas}h
                    {instalacao.numAjudantes > 0 ? ` · ${instalacao.numAjudantes} ajudante(s)` : ""}
                    {equipamento ? ` · ${equipamento.nome}` : ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {resultado ? formatarMoeda(resultado.subtotalInstalacao) : "—"}
                  </td>
                </tr>
              )}

              {/* Deslocamento */}
              {deslocamento?.incluido && (
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td className="px-3 py-2 text-gray-500">Deslocamento</td>
                  <td className="px-3 py-2 font-medium">
                    {deslocamento.distanciaKm} km · Pedágio: {formatarMoeda(deslocamento.pedagio)}
                  </td>
                  <td className="px-3 py-2 text-right">{formatarMoeda(totalDeslocamento)}</td>
                </tr>
              )}

              {/* Imposto */}
              {resultado && resultado.valorImposto > 0 && (
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td className="px-3 py-2 text-gray-500">Impostos</td>
                  <td className="px-3 py-2 text-gray-500">{orcamento.item.impostoPercent ?? 0}%</td>
                  <td className="px-3 py-2 text-right">{formatarMoeda(resultado.valorImposto)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: "#1f2937", color: "#fff" }}>
                <td colSpan={2} className="px-3 py-3 text-base font-bold">
                  TOTAL
                </td>
                <td className="px-3 py-3 text-right text-base font-bold">
                  {formatarMoeda(totalFinal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Ajuste manual */}
        {orcamento.ajusteManual !== 0 && orcamento.ajusteManual !== undefined && (
          <p className="mt-1 text-right text-xs text-gray-500">
            * Inclui ajuste de {orcamento.ajusteManual > 0 ? "+" : ""}{formatarMoeda(orcamento.ajusteManual)}
          </p>
        )}

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
          body > * {
            display: block !important;
            width: 100% !important;
          }
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
