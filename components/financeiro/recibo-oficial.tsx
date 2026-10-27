"use client"

import { formatarData, formatarMoeda } from "@/lib/format"
import { valorPorExtenso } from "@/lib/extenso"
import { EMPRESA_ORCAMENTO } from "@/lib/orcamento-pdf"

// Recibo de pagamento no mesmo padrão visual do orçamento oficial (A4, em pt).
const cinzaTitulo = "#666"
const linhaClara = "#d9d9d9"

export interface DadosRecibo {
  numero: string
  clienteNome: string
  valor: number
  // Frase depois de "referente a": "entrada de 50% do orçamento nº 1001-26"
  referente: string
  formaPagamento?: string
  pagoEm: string
  // Só em recibo de orçamento: situação do pagamento total.
  resumo?: {
    totalOrcamento: number
    totalPago: number
    saldo: number
    vencimentoSaldo?: string
  }
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]

function dataPorExtenso(data: Date) {
  return `${data.getDate()} de ${MESES[data.getMonth()]} de ${data.getFullYear()}`
}

export function ReciboOficial({ dados, dataEmissao }: { dados: DadosRecibo; dataEmissao: Date }) {
  const { resumo } = dados

  return (
    <>
      <div
        id="recibo-print"
        className="mx-auto bg-white shadow-sm print:shadow-none"
        style={{
          width: "210mm",
          minHeight: "297mm",
          boxSizing: "border-box",
          padding: "21pt 30pt 30pt",
          fontFamily: "Arial, Helvetica, sans-serif",
          color: "#000",
        }}
      >
        {/* Cabeçalho */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "13pt" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-orcamento.png"
              alt="Toldos Print"
              style={{ width: "108pt", height: "60pt", objectFit: "cover" }}
            />
            <div>
              <div style={{ fontSize: "13pt", fontWeight: 700 }}>{EMPRESA_ORCAMENTO.nome}</div>
              <div style={{ fontSize: "8.5pt", lineHeight: 1.25 }}>
                <div style={{ whiteSpace: "pre" }}>{EMPRESA_ORCAMENTO.cnpj}</div>
                {EMPRESA_ORCAMENTO.endereco.map((l) => (
                  <div key={l}>{l}</div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ fontSize: "8.5pt", textAlign: "right", lineHeight: 1.25 }}>
            <div>{EMPRESA_ORCAMENTO.email}</div>
            <div>Contato: {EMPRESA_ORCAMENTO.contato}</div>
          </div>
        </div>

        <div
          style={{
            background: "#8a8a8a",
            color: "#fff",
            textAlign: "center",
            fontSize: "13pt",
            padding: "1.5pt 0",
            marginTop: "22pt",
          }}
        >
          RECIBO Nº {dados.numero}
        </div>

        {/* Valor em destaque */}
        <div
          style={{
            margin: "22pt 0 6pt",
            padding: "10pt 14pt",
            border: `1px solid ${linhaClara}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <span style={{ fontSize: "11pt", color: cinzaTitulo }}>Valor recebido</span>
          <span style={{ fontSize: "20pt", fontWeight: 700 }}>{formatarMoeda(dados.valor)}</span>
        </div>

        <p style={{ fontSize: "11pt", lineHeight: 1.6, margin: "16pt 2pt 0", textAlign: "justify" }}>
          Recebemos de <strong>{dados.clienteNome}</strong> a quantia de{" "}
          <strong>{formatarMoeda(dados.valor)}</strong> (
          {valorPorExtenso(dados.valor)}), referente a {dados.referente}
          {dados.formaPagamento ? `, pago via ${dados.formaPagamento}` : ""}, em{" "}
          {formatarData(dados.pagoEm)}.
        </p>

        {resumo && (
          <>
            <div
              style={{
                fontSize: "11pt",
                color: cinzaTitulo,
                borderBottom: `1px solid ${linhaClara}`,
                paddingBottom: "2pt",
                marginTop: "22pt",
              }}
            >
              Situação do pagamento
            </div>
            <div style={{ fontSize: "9.5pt", marginTop: "8pt", lineHeight: 1.9 }}>
              {[
                ["Valor do orçamento", formatarMoeda(resumo.totalOrcamento), false],
                ["Total pago até agora", formatarMoeda(resumo.totalPago), false],
                [
                  resumo.saldo > 0 ? "Saldo restante" : "Situação",
                  resumo.saldo > 0 ? formatarMoeda(resumo.saldo) : "Quitado",
                  true,
                ],
              ].map(([rotulo, valor, destaque]) => (
                <div
                  key={String(rotulo)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "0 2pt",
                    fontWeight: destaque ? 700 : 400,
                  }}
                >
                  <span>{rotulo}</span>
                  <span>{valor}</span>
                </div>
              ))}
              {resumo.saldo > 0 && resumo.vencimentoSaldo && (
                <div style={{ padding: "0 2pt", fontSize: "8.5pt", color: "#444" }}>
                  Saldo com vencimento em {formatarData(resumo.vencimentoSaldo)}.
                </div>
              )}
            </div>
          </>
        )}

        <p style={{ fontSize: "10pt", margin: "36pt 2pt 0" }}>
          Águia Branca/ES, {dataPorExtenso(dataEmissao)}.
        </p>

        {/* Assinatura */}
        <div style={{ marginTop: "34pt", textAlign: "center" }}>
          <div style={{ width: "131pt", margin: "0 auto", borderBottom: "1px solid #999" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/assinatura-kaio.png"
              alt="Assinatura"
              style={{ height: "25pt", display: "block", margin: "0 auto" }}
            />
          </div>
          <div style={{ fontSize: "9pt", fontWeight: 700, marginTop: "12pt" }}>
            {EMPRESA_ORCAMENTO.nome}
          </div>
          <div style={{ fontSize: "9pt" }}>{EMPRESA_ORCAMENTO.contato}</div>
        </div>
      </div>

      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          script, style, link, noscript { display: none !important; }
          #recibo-print { margin: 0 !important; width: 100% !important; }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </>
  )
}
