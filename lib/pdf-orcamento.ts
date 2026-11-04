// Gera o PDF do orçamento a partir do mesmo HTML usado em "Imprimir / salvar
// PDF" (id="orcamento-print" em components/orcamentos/orcamento-oficial.tsx),
// pra poder anexar o arquivo direto no compartilhamento (ver lib/compartilhar.ts).
export async function gerarPdfOrcamento(elementoId: string, nomeArquivo: string): Promise<File> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ])

  const elemento = document.getElementById(elementoId)
  if (!elemento) throw new Error("Elemento do orçamento não encontrado na página.")

  const canvas = await html2canvas(elemento, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  })

  const pdf = new jsPDF({ unit: "mm", format: "a4" })
  const largura = pdf.internal.pageSize.getWidth()
  const altura = (canvas.height * largura) / canvas.width
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, largura, altura)

  return new File([pdf.output("blob")], nomeArquivo, { type: "application/pdf" })
}
