import { precisaAtencao, type ArquivoFila, type ItemFila } from "./fila"
import type { Cliente, Orcamento, OrcamentoItem } from "@/lib/types"

export interface DependenciasSincronizacao {
  listar(): Promise<ItemFila[]>
  remover(id: string): Promise<void>
  registrarFalha(id: string, mensagem: string): Promise<void>
  // Consulta o SERVIDOR (não a memória da tela): é o que prova que salvou.
  existeNoServidor(id: string): Promise<boolean>
  clienteExiste(id: string): boolean
  criarCliente(cliente: Cliente): void
  enviarArquivo(arquivo: ArquivoFila): Promise<string>
  fecharOrcamento(dados: {
    id: string
    clienteId: string
    item: OrcamentoItem
    ajusteManual: number
    anexoNome: string | null
    anexoUrl?: string
    validadeDias: number
  }): Orcamento
}

export interface ResultadoSincronizacao {
  enviados: string[]
  falhas: { id: string; erro: string }[]
  // Orçamentos cujo valor final difere do mostrado no PDF provisório.
  mudancas: { numero: number; de: number; para: number }[]
}

// Envia a fila, em ordem de criação. Um item só sai da fila depois que o
// servidor confirma que o orçamento existe; qualquer falha deixa o item lá,
// com a mensagem do erro, e os demais seguem.
export async function sincronizarFila(
  deps: DependenciasSincronizacao,
  opcoes: { forcar?: boolean } = {}
): Promise<ResultadoSincronizacao> {
  const resultado: ResultadoSincronizacao = { enviados: [], falhas: [], mudancas: [] }
  const itens = (await deps.listar()).filter(
    (item) => opcoes.forcar || !precisaAtencao(item)
  )

  for (const item of itens) {
    try {
      if (await deps.existeNoServidor(item.id)) {
        await deps.remover(item.id)
        resultado.enviados.push(item.id)
        continue
      }

      if (item.clienteNovo && !deps.clienteExiste(item.clienteNovo.id)) {
        deps.criarCliente(item.clienteNovo)
      }

      const urlsDasFotos: string[] = []
      for (const foto of item.fotos) urlsDasFotos.push(await deps.enviarArquivo(foto))
      const anexoUrl = item.anexo ? await deps.enviarArquivo(item.anexo) : undefined
      const fotos = (item.item.fotos ?? []).map((foto, i) => ({
        ...foto,
        url: urlsDasFotos[i] ?? foto.url,
      }))

      const orcamento = deps.fecharOrcamento({
        id: item.id,
        clienteId: item.clienteId,
        item: { ...item.item, fotos: fotos.length > 0 ? fotos : undefined },
        ajusteManual: item.ajusteManual,
        anexoNome: item.anexo?.nome ?? null,
        anexoUrl,
        validadeDias: item.validadeDias,
      })

      if (!(await deps.existeNoServidor(orcamento.id))) {
        throw new Error("O servidor não confirmou o salvamento do orçamento")
      }

      await deps.remover(item.id)
      resultado.enviados.push(item.id)
      if (
        orcamento.totalFechado !== undefined &&
        Math.abs(orcamento.totalFechado - item.totalProvisorio) > 0.005
      ) {
        resultado.mudancas.push({
          numero: orcamento.numero,
          de: item.totalProvisorio,
          para: orcamento.totalFechado,
        })
      }
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "Erro desconhecido"
      await deps.registrarFalha(item.id, mensagem)
      resultado.falhas.push({ id: item.id, erro: mensagem })
    }
  }
  return resultado
}
