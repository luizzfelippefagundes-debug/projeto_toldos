"use client"

import { formatarData, formatarMoeda } from "@/lib/format"
import { EMPRESA_ORCAMENTO, type LinhaOrcamento } from "@/lib/orcamento-pdf"
import type { FotoOrcamento } from "@/lib/types"

// Orçamento oficial da empresa (modelo Orcamento-0129-25.pdf). As medidas
// seguem o PDF original em pt; a folha A4 é desenhada igual na tela e na
// impressão. Usado na página do orçamento fechado e no "Gerar PDF" do
// formulário de Novo Orçamento.
const cinzaTitulo = "#666"
const linhaClara = "#d9d9d9"
const colunas = "48.3% 12% 9.4% 15% 15.3%"

function Secao({
  children,
  espacoAcima = "12pt",
}: {
  children: React.ReactNode
  espacoAcima?: string
}) {
  return (
    <div
      style={{
        fontSize: "11pt",
        color: cinzaTitulo,
        borderBottom: `1px solid ${linhaClara}`,
        paddingBottom: "2pt",
        marginTop: espacoAcima,
      }}
    >
      {children}
    </div>
  )
}

export function OrcamentoOficial({
  clienteNome,
  data,
  numero,
  linhas,
  total,
  condicoes,
  fotos,
}: {
  clienteNome: string
  data: string
  numero: string
  linhas: LinhaOrcamento[]
  total: number
  condicoes: string
  fotos: FotoOrcamento[]
}) {
  return (
    <>
        <div
          id="orcamento-print"
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
                <div style={{ fontSize: "13pt", fontWeight: 700 }}>
                  {EMPRESA_ORCAMENTO.nome}
                </div>
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

          <Secao>Dados do Cliente</Secao>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "11pt",
              margin: "9pt 2pt 8pt",
            }}
          >
            <span>{clienteNome}</span>
            <span>Data: {formatarData(data)}</span>
          </div>

          <div
            style={{
              background: "#8a8a8a",
              color: "#fff",
              textAlign: "center",
              fontSize: "13pt",
              padding: "1.5pt 0",
            }}
          >
            ORÇAMENTO Nº {numero}
          </div>

          <Secao>Serviços</Secao>
          <div style={{ marginTop: "10pt", fontSize: "9pt" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: colunas,
                background: "#dddddd",
                padding: "1.5pt 2pt",
              }}
            >
              <span>Nome</span>
              <span style={{ textAlign: "right" }}>Quantidade</span>
              <span style={{ textAlign: "right" }}>Unidade</span>
              <span style={{ textAlign: "right" }}>Valor Unitário</span>
              <span style={{ textAlign: "right" }}>Valor Total</span>
            </div>
            {linhas.map((l, i) => (
              <div
                key={`${l.nome}-${i}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: colunas,
                  padding: "2pt 2pt 0",
                  lineHeight: 1.3,
                }}
              >
                <span>{l.nome}</span>
                <span style={{ textAlign: "right" }}>{l.quantidade}</span>
                <span style={{ textAlign: "right" }}>{l.unidade}</span>
                <span style={{ textAlign: "right" }}>{formatarMoeda(l.valorUnitario)}</span>
                <span style={{ textAlign: "right" }}>{formatarMoeda(l.valorTotal)}</span>
              </div>
            ))}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: colunas,
                padding: "10pt 2pt 0",
              }}
            >
              <span style={{ gridColumn: "1 / 4" }} />
              <span style={{ textAlign: "right" }}>Total Serviços</span>
              <span style={{ textAlign: "right" }}>{formatarMoeda(total)}</span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: colunas,
                padding: "32pt 2pt 0",
              }}
            >
              <span style={{ gridColumn: "1 / 4" }} />
              <span style={{ textAlign: "right" }}>Subtotal</span>
              <span style={{ textAlign: "right" }}>{formatarMoeda(total)}</span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: colunas,
                padding: "3pt 2pt 0",
                fontWeight: 700,
              }}
            >
              <span style={{ gridColumn: "1 / 4" }} />
              <span style={{ textAlign: "right" }}>Total Orçamento</span>
              <span style={{ textAlign: "right" }}>{formatarMoeda(total)}</span>
            </div>
          </div>

          <Secao>Observações</Secao>
          <div style={{ marginTop: "9pt", fontSize: "9pt" }}>
            <span style={{ fontWeight: 700 }}>Condições de Pagamento:</span>{" "}
            <span style={{ fontSize: "7.5pt", color: "#444" }}>{condicoes}</span>
          </div>

          {fotos.length > 0 && (
            <>
              <Secao espacoAcima="19pt">Fotos</Secao>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16pt", marginTop: "9pt" }}>
                {fotos.map((f, i) => (
                  <div key={`${f.url}-${i}`} style={{ width: "121pt" }}>
                    <div
                      style={{
                        height: "91pt",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={f.url}
                        alt={f.legenda || "Foto do orçamento"}
                        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                      />
                    </div>
                    <div style={{ fontSize: "8.5pt", marginTop: "8pt" }}>{f.legenda}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Assinatura */}
          <div style={{ marginTop: "28pt", textAlign: "center" }}>
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
          #orcamento-print { margin: 0 !important; width: 100% !important; }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </>
  )
}
