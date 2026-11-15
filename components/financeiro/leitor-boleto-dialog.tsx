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
import { Camera, FileUp, Loader2, ScanLine, AlertCircle, FileText } from "lucide-react"

interface CamposLidos {
  beneficiario?: string
  numeroBoleto?: string
  valor?: number
  vencimento?: string
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

// Mantém fotos com resolução nítida para máxima precisão de leitura dos números pequenos
async function reduzirImagem(arquivo: File): Promise<File> {
  if (!arquivo.type.startsWith("image/")) return arquivo
  // Se a foto tiver até 8 MB, envia o arquivo original sem perder resolução
  if (arquivo.size <= 8 * 1024 * 1024) return arquivo
  try {
    const bitmap = await createImageBitmap(arquivo)
    const escala = Math.min(1, 3500 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((ok) =>
      canvas.toBlob(ok, "image/jpeg", 0.98)
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
        className="w-full sm:w-auto font-bold border-border/80 hover:bg-muted text-foreground gap-1.5 text-xs sm:text-sm h-10 px-2 sm:px-4 shadow-2xs transition-colors"
      >
        <Camera className="h-4 w-4 shrink-0 text-primary" />
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
                  Tire uma foto ou envie o arquivo PDF para preencher os dados automaticamente.
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
                  Identificando valor, vencimento e código de barras.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 py-2">
              <button
                type="button"
                onClick={() => inputCamera.current?.click()}
                className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 transition-all text-left cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform shrink-0">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                    Tirar foto com a Câmera
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Abre a câmera do celular para fotografar o boleto.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => inputArquivo.current?.click()}
                className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/50 transition-all text-left cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover:text-foreground group-hover:scale-105 transition-transform shrink-0">
                  <FileUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">
                    Subir PDF ou Foto da Galeria
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Para arquivos baixados no PC ou recebidos no WhatsApp.
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
            descricao: campos.beneficiario
              ? `Boleto — ${campos.beneficiario}`
              : "Boleto",
            categoria: classificacao.categoria,
            valor: campos.valor,
            vencimento: campos.vencimento,
            formaPagamento: "boleto",
            numeroBoleto: campos.numeroBoleto,
            despesaFixa: classificacao.despesaFixa,
          }}
        />
      )}
    </>
  )
}
