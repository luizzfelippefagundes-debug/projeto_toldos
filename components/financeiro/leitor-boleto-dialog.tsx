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
import { Camera, FileUp, Loader2, ScanLine } from "lucide-react"

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

// Fotos de celular passam fácil de 5 MB; reduz antes de enviar.
async function reduzirImagem(arquivo: File): Promise<File> {
  if (!arquivo.type.startsWith("image/")) return arquivo
  try {
    const bitmap = await createImageBitmap(arquivo)
    const escala = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((ok) =>
      canvas.toBlob(ok, "image/jpeg", 0.9)
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
        setErro(json?.erro ?? "Não consegui ler o boleto. Tente de novo.")
        return
      }
      const avisos: string[] = json.avisos ?? []
      const numero = json.campos?.numeroBoleto as string | undefined
      if (numero && lancamentos.some((l) => l.numeroBoleto?.replace(/\D/g, "") === numero)) {
        avisos.unshift("Este boleto já está cadastrado no financeiro.")
      }
      setLeitura({ campos: json.campos, avisos })
      setAberto(false)
    } catch {
      setErro("Sem conexão com o servidor. Tente de novo.")
    } finally {
      setLendo(false)
    }
  }

  const campos = leitura?.campos

  return (
    <>
      <Button variant="outline" onClick={() => setAberto(true)}>
        <ScanLine className="mr-2 h-4 w-4" />
        Ler boleto
      </Button>

      <Dialog open={aberto} onOpenChange={(v) => !lendo && setAberto(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ler boleto</DialogTitle>
            <DialogDescription>
              Envie o PDF ou tire uma foto do boleto. O sistema lê os dados e
              você confere antes de salvar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <Button disabled={lendo} onClick={() => inputArquivo.current?.click()}>
              <FileUp className="mr-2 h-4 w-4" />
              Enviar PDF ou imagem
            </Button>
            <Button
              variant="outline"
              disabled={lendo}
              onClick={() => inputCamera.current?.click()}
            >
              <Camera className="mr-2 h-4 w-4" />
              Tirar foto com a câmera
            </Button>
            {lendo && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Lendo o boleto…
              </p>
            )}
            {erro && <p className="text-sm text-destructive">{erro}</p>}
          </div>

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
            categoria: "Fornecedor",
            valor: campos.valor,
            vencimento: campos.vencimento,
            formaPagamento: "boleto",
            numeroBoleto: campos.numeroBoleto,
          }}
        />
      )}
    </>
  )
}
