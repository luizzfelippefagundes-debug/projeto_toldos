import { isPositiveNumberInput } from "./number"
import type { ItemAdicional, Material, Servico } from "./types"

// Versão em texto de um item adicional, do jeito que os campos da tela guardam.
export interface ItemAdicionalForm {
  id: string
  materialId: string
  servicoId: string
  largura: string
  altura: string
  quantidadeUnidades: string
  horasEstimadas: string
  acabamentos: Record<string, { ativo: boolean; qtd: string }>
}

function numeroOuZero(valor: string): number {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

export function formVazio(id: string): ItemAdicionalForm {
  return {
    id,
    materialId: "",
    servicoId: "nenhum",
    largura: "",
    altura: "",
    quantidadeUnidades: "1",
    horasEstimadas: "",
    acabamentos: {},
  }
}

export function formParaItem(form: ItemAdicionalForm): ItemAdicional {
  const acabamentos = Object.entries(form.acabamentos)
    .filter(([, sel]) => sel.ativo && isPositiveNumberInput(sel.qtd))
    .map(([acabamentoId, sel]) => ({
      acabamentoId,
      quantidade: numeroOuZero(sel.qtd),
    }))
  return {
    id: form.id,
    materialId: form.materialId,
    servicoId: form.servicoId,
    largura: numeroOuZero(form.largura),
    altura: numeroOuZero(form.altura),
    quantidadeUnidades: numeroOuZero(form.quantidadeUnidades),
    horasEstimadas: numeroOuZero(form.horasEstimadas),
    ...(acabamentos.length > 0 ? { acabamentos } : {}),
  }
}

export function itemParaForm(item: ItemAdicional): ItemAdicionalForm {
  return {
    id: item.id,
    materialId: item.materialId,
    servicoId: item.servicoId,
    largura: item.largura ? String(item.largura) : "",
    altura: item.altura ? String(item.altura) : "",
    quantidadeUnidades: String(item.quantidadeUnidades || 1),
    horasEstimadas: item.horasEstimadas ? String(item.horasEstimadas) : "",
    acabamentos: Object.fromEntries(
      (item.acabamentos ?? []).map(({ acabamentoId, quantidade }) => [
        acabamentoId,
        { ativo: true, qtd: String(quantidade) },
      ])
    ),
  }
}

// O que falta num item adicional, nas mesmas regras do item principal.
// `numero` é a posição mostrada ao usuário (o principal é o item 1).
export function pendenciasItem(
  form: ItemAdicionalForm,
  materiais: Material[],
  servicos: Servico[],
  numero: number
): string[] {
  const prefixo = `Item ${numero}: `
  const material = materiais.find((m) => m.id === form.materialId)
  if (!material) return [`${prefixo}selecione o material`]

  const servico = servicos.find((s) => s.id === form.servicoId)
  const dimensoesValidas =
    isPositiveNumberInput(form.largura) && isPositiveNumberInput(form.altura)
  const quantidadeValida =
    isPositiveNumberInput(form.quantidadeUnidades) &&
    Number.isInteger(Number(form.quantidadeUnidades))
  const medidasValidas =
    (material.unidade !== "m2" || dimensoesValidas) &&
    quantidadeValida &&
    (servico?.formaCobranca !== "m2" || dimensoesValidas)

  const pendencias: string[] = []
  if (!medidasValidas) pendencias.push(`${prefixo}preencha as medidas corretamente`)
  if (servico?.formaCobranca === "hora" && !isPositiveNumberInput(form.horasEstimadas)) {
    pendencias.push(`${prefixo}informe as horas estimadas do serviço`)
  }
  const acabamentosValidos = Object.values(form.acabamentos).every(
    (sel) => !sel.ativo || isPositiveNumberInput(sel.qtd)
  )
  if (!acabamentosValidos) {
    pendencias.push(`${prefixo}informe a quantidade dos acabamentos marcados`)
  }
  return pendencias
}
