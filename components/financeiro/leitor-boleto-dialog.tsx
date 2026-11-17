"use client"

import { useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { LancamentoFormDialog } from "@/components/financeiro/lancamento-form-dialog"
import { useData } from "@/context/data-context"
import { Camera, FileUp, ScanLine, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface CamposLidos {
  beneficiario?: string
  numeroBoleto?: string
  valor?: number
  vencimento?: string
  mesReferencia?: string
  numeroDocumento?: string
  pixCopiaECola?: string
  instrucoes?: string
  cnpjCpfBeneficiario?: string
  pagador?: string
}

function montarDescricao(campos?: CamposLidos): string {
  if (!campos) return "Boleto"
  const nome = campos.beneficiario ? campos.beneficiario.trim() : "Boleto"
  const detalhes: string[] = []
  if (campos.mesReferencia) detalhes.push(`Ref: ${campos.mesReferencia}`)
  if (campos.numeroDocumento) detalhes.push(`Doc #${campos.numeroDocumento}`)
  if (detalhes.length > 0) {
    return `${nome} (${detalhes.join(" — ")})`
  }
  return nome.toLowerCase().startsWith("boleto") ? nome : `Boleto — ${nome}`
}

function montarObservacoes(campos?: CamposLidos): string {
  if (!campos) return ""
  const itens: string[] = []
  if (campos.mesReferencia) itens.push(`Competência/Mês: ${campos.mesReferencia}`)
  if (campos.numeroDocumento) itens.push(`Nº do Documento/Fatura: ${campos.numeroDocumento}`)
  if (campos.cnpjCpfBeneficiario) itens.push(`CNPJ/CPF Beneficiário: ${campos.cnpjCpfBeneficiario}`)
  if (campos.pagador) itens.push(`Pagador: ${campos.pagador}`)
  if (campos.instrucoes) itens.push(`Instruções: ${campos.instrucoes}`)
  return itens.join("\n")
}

interface Leitura {
  campos: CamposLidos
  avisos: string[]
}

function inferirClassificacao(beneficiario?: string): { categoria: string; despesaFixa: boolean } {
  if (!beneficiario) return { categoria: "Fornecedor", despesaFixa: false }
  const b = beneficiario.toLowerCase()
  if (
    b.includes("edp") ||
    b.includes("enel") ||
    b.includes("luz") ||
    b.includes("energia") ||
    b.includes("cemig") ||
    b.includes("cpfl") ||
    b.includes("eletric")
  ) {
    return { categoria: "Energia Elétrica", despesaFixa: true }
  }
  if (
    b.includes("cesan") ||
    b.includes("agua") ||
    b.includes("água") ||
    b.includes("sanear") ||
    b.includes("sabesp") ||
    b.includes("saneamento")
  ) {
    return { categoria: "Água / Saneamento", despesaFixa: true }
  }
  if (
    b.includes("vivo") ||
    b.includes("claro") ||
    b.includes("tim") ||
    b.includes("oi") ||
    b.includes("internet") ||
    b.includes("fibra") ||
    b.includes("telecom")
  ) {
    return { categoria: "Internet / Telefone", despesaFixa: true }
  }
  if (
    b.includes("aluguel") ||
    b.includes("imobiliaria") ||
    b.includes("imobiliária") ||
    b.includes("locacao") ||
    b.includes("locação")
  ) {
    return { categoria: "Aluguel", despesaFixa: true }
  }
  if (b.includes("contabil") || b.includes("contabilidade") || b.includes("contador")) {
    return { categoria: "Contabilidade", despesaFixa: true }
  }
  return { categoria: "Fornecedor", despesaFixa: false }
}

async function reduzirImagem(arquivo: File): Promise<File> {
  if (!arquivo.type.startsWith("image/")) return arquivo
  if (arquivo.size <= 3 * 1024 * 1024) return arquivo
  try {
    const bitmap = await createImageBitmap(arquivo)
    const escala = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((ok) =>
      canvas.toBlob(ok, "image/jpeg", 0.92)
    )
    return blob ? new File([blob], "boleto.jpg", { type: "image/jpeg" }) : arquivo
  } catch {
    return arquivo
  }
}

export function LeitorBoletoDialog() {
  const { lancamentos } = useData()
  const [aberto, setAberto] = useState(false)
  const [lendo, setLendo] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const [erro, setErro] = useState("")
  const [leitura, setLeitura] = useState<Leitura | null>(null)
  const inputArquivo = useRef<HTMLInputElement>(null)
  const inputCamera = useRef<HTMLInputElement>(null)

  async function enviar(arquivo: File | undefined) {
    if (!arquivo) return
    setErro("")
    setLendo(true)
    try {
      const form = new FormData()
      form.append("file", await reduzirImagem(arquivo))
      const res = await fetch("/api/boleto/ler", { method: "POST", body: form })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json) {
        setErro(json?.erro ?? "Não foi possível ler o boleto. Tente novamente ou use outra foto.")
        return
      }
      const avisos: string[] = json.avisos ?? []
      const numero = json.campos?.numeroBoleto as string | undefined
      if (numero && lancamentos.some((l) => l.numeroBoleto?.replace(/\D/g, "") === numero)) {
        avisos.unshift("Aviso: este boleto já se encontra cadastrado no financeiro.")
      }
      setLeitura({ campos: json.campos, avisos })
      setAberto(false)
    } catch {
      setErro("Sem conexão com o servidor. Verifique sua internet e tente novamente.")
    } finally {
      setLendo(false)
    }
  }

  const campos = leitura?.campos
  const classificacao = inferirClassificacao(campos?.beneficiario)

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setAberto(true)}
        className="w-full sm:w-auto font-bold border-border/80 hover:bg-muted text-foreground gap-1.5 text-xs sm:text-sm h-10 px-2 sm:px-4 shadow-2xs transition-colors cursor-pointer"
      >
        <ScanLine className="h-4 w-4 shrink-0 text-primary" />
        <span>Ler Boleto</span>
      </Button>

      <Dialog open={aberto} onOpenChange={(v) => !lendo && setAberto(v)}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-2xl shadow-2xl border-border/80">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <ScanLine className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black">Ler Boleto</DialogTitle>
                <DialogDescription className="text-xs">
                  Tire uma foto ou envie o arquivo para preencher os dados automaticamente.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {lendo ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-4 border-muted border-t-primary animate-spin" />
                <ScanLine className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">Lendo dados do boleto...</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Extraindo fornecedor, valor, vencimento e código de barras.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 py-2">
              {/* Botão principal de PDF / Computador com Drag & Drop */}
              <button
                type="button"
                onClick={() => inputArquivo.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setArrastando(true)
                }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setArrastando(false)
                  const f = e.dataTransfer.files?.[0]
                  if (f) enviar(f)
                }}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left cursor-pointer group",
                  arrastando
                    ? "border-primary bg-primary/10 ring-2 ring-primary"
                    : "border-primary/40 bg-primary/5 hover:border-primary hover:bg-primary/10"
                )}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center text-primary group-hover:scale-105 transition-transform shrink-0">
                  <FileUp className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                    {arrastando ? "Solte o arquivo aqui!" : "Subir PDF do Boleto ou Foto"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Clique para escolher ou arraste o PDF baixado direto pra cá.
                  </p>
                </div>
              </button>

              {/* Botão secundário para quem estiver no celular tirando foto */}
              <button
                type="button"
                onClick={() => inputCamera.current?.click()}
                className="flex items-center gap-4 p-3.5 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/50 transition-all text-left cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover:text-foreground group-hover:scale-105 transition-transform shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                    Tirar foto com a Câmera
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Para quando estiver no celular e o boleto for em papel impresso.
                  </p>
                </div>
              </button>

              {erro && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{erro}</p>
                </div>
              )}
            </div>
          )}

          <input
            ref={inputArquivo}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              enviar(e.target.files?.[0])
              e.target.value = ""
            }}
          />
          <input
            ref={inputCamera}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              enviar(e.target.files?.[0])
              e.target.value = ""
            }}
          />
        </DialogContent>
      </Dialog>

      {leitura && campos && (
        <LancamentoFormDialog
          key={campos.numeroBoleto ?? campos.valor}
          open
          onOpenChange={(v) => !v && setLeitura(null)}
          trigger={<span hidden />}
          avisos={leitura.avisos}
          inicial={{
            descricao: montarDescricao(campos),
            categoria: classificacao.categoria,
            valor: campos.valor,
            vencimento: campos.vencimento,
            formaPagamento: "boleto",
            numeroBoleto: campos.numeroBoleto,
            despesaFixa: classificacao.despesaFixa,
            observacoes: montarObservacoes(campos),
            pixCopiaECola: campos.pixCopiaECola,
          }}
        />
      )}
    </>
  )
}
