// Compartilhamento nativo do celular (Web Share API): abre a tela de
// compartilhar do Android/iPhone com o arquivo já anexado — a pessoa só
// escolhe o WhatsApp e o contato. Sem suporte (ex.: desktop), cai pro
// download do arquivo pra anexar manualmente.
export type ResultadoCompartilhamento = "compartilhado" | "cancelado" | "baixado"

export async function compartilharOuBaixarArquivo(
  arquivo: File,
  texto?: string
): Promise<ResultadoCompartilhamento> {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean
    share?: (data: { files: File[]; text?: string; title?: string }) => Promise<void>
  }

  if (nav.canShare?.({ files: [arquivo] }) && nav.share) {
    try {
      await nav.share({ files: [arquivo], text: texto, title: arquivo.name })
      return "compartilhado"
    } catch (erro) {
      if (erro instanceof Error && erro.name === "AbortError") return "cancelado"
      // Outros erros (ex.: app indisponível): cai pro download abaixo.
    }
  }

  const url = URL.createObjectURL(arquivo)
  const a = document.createElement("a")
  a.href = url
  a.download = arquivo.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return "baixado"
}
