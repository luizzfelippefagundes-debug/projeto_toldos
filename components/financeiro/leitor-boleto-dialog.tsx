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
import { Camera, FileUp, Loader2, Sparkles, AlertCircle } from "lucide-react"

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

// Reduz fotos tiradas pelo celular para acelerar o upload e economizar dados
async function reduzirImagem(arquivo: File): Promise<File> {
  if (!arquivo.type.startsWith("image/")) return arquivo
  try {
    const bitmap = await createImageBitmap(arquivo)
    const escala = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height))
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
        className="font-bold border-indigo-500/30 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 gap-2 shadow-2xs transition-colors"
      >
        <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
        <span className="hidden sm:inline">Escanear Boleto com IA</span>
        <span className="sm:hidden">Ler Boleto IA</span>
      </Button>

      <Dialog open={aberto} onOpenChange={(v) => !lendo && setAberto(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl text-indigo-600 dark:text-indigo-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black">Escanear Boleto com IA</DialogTitle>
                <DialogDescription className="text-xs">
                  Tire uma foto ou suba um PDF. A IA extrai valor, vencimento e código de barras.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {lendo ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 animate-spin" />
                <Sparkles className="w-6 h-6 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">Lendo dados do boleto...</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  A inteligência artificial está identificando valor, vencimento e linha digitável.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 py-2">
              <button
                type="button"
                onClick={() => inputCamera.current?.click()}
                className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all text-left cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform shrink-0">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground group-hover:text-indigo-600 transition-colors">
                    Tirar foto com a Câmera
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Abre a câmera do celular para fotografar o boleto de papel.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => inputArquivo.current?.click()}
                className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-indigo-400 hover:bg-muted/50 transition-all text-left cursor-pointer group"
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
