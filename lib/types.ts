export type TipoMaterial =
  | "Lona"
  | "ACM"
  | "PVC"
  | "Adesivo Vinil"
  | "Metalon"
  | "Outro"

export type UnidadeMedida = "m2" | "unidade"

export interface Material {
  id: string
  nome: string
  tipo: TipoMaterial
  unidade: UnidadeMedida
  precoUnitario: number
  estoqueMinimo: number
  quantidadeEstoque: number
}

export type FormaCobranca = "fixo" | "hora" | "m2" | "percentual"

export interface Servico {
  id: string
  nome: string
  formaCobranca: FormaCobranca
  valor: number
}

export interface Cliente {
  id: string
  nome: string
  telefone: string
  email?: string
}

export interface Acabamento {
  id: string
  nome: string
  precoUnitario: number
  unidade: string
}

export interface EquipamentoAcesso {
  id: string
  nome: string
  precoDiaria: number
}

export type StatusOrcamento = "aberto" | "fechado" | "cancelado"

export interface AcabamentoSelecionado {
  acabamentoId: string
  quantidade: number
}

export interface InstalacaoOrcamento {
  incluida: boolean
  horas: number
  custoHora: number
  numAjudantes: number
  diariaAjudante: number
  equipamentoId: string
}

export interface DeslocamentoOrcamento {
  incluido: boolean
  distanciaKm: number
  custoPorKm: number
  pedagio: number
  alimentacao: number
}

export interface OrcamentoItem {
  materialId: string
  servicoId: string
  largura: number
  altura: number
  quantidadeUnidades: number
  horasEstimadas: number
  acabamentos?: AcabamentoSelecionado[]
  instalacao?: InstalacaoOrcamento
  deslocamento?: DeslocamentoOrcamento
  margemPercent?: number
  descontoPercent?: number
}

export interface Orcamento {
  id: string
  numero: number
  clienteId: string
  item: OrcamentoItem
  ajusteManual: number
  anexoNome: string | null
  status: StatusOrcamento
  criadoEm: string
  fechadoEm: string | null
}

export interface EntradaEstoque {
  id: string
  materialId: string
  quantidade: number
  fornecedor?: string
  comNotaFiscal: boolean
  numeroNota?: string
  data: string
}
