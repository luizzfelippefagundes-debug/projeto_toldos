import type {
  Cliente,
  EntradaEstoque,
  Material,
  Orcamento,
  Servico,
} from "./types"

export const materiaisSeed: Material[] = [
  { id: "mat-1", nome: "Lona 440g Fosca", tipo: "Lona", unidade: "m2", precoUnitario: 28, estoqueMinimo: 30, quantidadeEstoque: 85 },
  { id: "mat-2", nome: "ACM 3mm Branco", tipo: "ACM", unidade: "m2", precoUnitario: 95, estoqueMinimo: 20, quantidadeEstoque: 12 },
  { id: "mat-3", nome: "PVC 3mm", tipo: "PVC", unidade: "m2", precoUnitario: 62, estoqueMinimo: 15, quantidadeEstoque: 40 },
  { id: "mat-4", nome: "Adesivo Vinil Branco Brilho", tipo: "Adesivo Vinil", unidade: "m2", precoUnitario: 35, estoqueMinimo: 25, quantidadeEstoque: 60 },
  { id: "mat-5", nome: "Metalon 20x20", tipo: "Metalon", unidade: "unidade", precoUnitario: 48, estoqueMinimo: 10, quantidadeEstoque: 22 },
  { id: "mat-6", nome: "Lona Backlight", tipo: "Lona", unidade: "m2", precoUnitario: 42, estoqueMinimo: 20, quantidadeEstoque: 18 },
]

export const servicosSeed: Servico[] = [
  { id: "srv-1", nome: "Instalação de Toldo", formaCobranca: "fixo", valor: 250 },
  { id: "srv-2", nome: "Instalação de Fachada", formaCobranca: "m2", valor: 35 },
  { id: "srv-3", nome: "Instalação de Letreiro", formaCobranca: "hora", valor: 60 },
  { id: "srv-4", nome: "Acabamento e Solda", formaCobranca: "percentual", valor: 15 },
  { id: "srv-5", nome: "Aplicação de Adesivo", formaCobranca: "m2", valor: 18 },
]

export const clientesSeed: Cliente[] = [
  { id: "cli-1", nome: "Padaria Pão Dourado", telefone: "(11) 98888-1234" },
  { id: "cli-2", nome: "Auto Peças Silva", telefone: "(11) 97777-5678" },
  { id: "cli-3", nome: "Mercado Boa Compra", telefone: "(11) 96666-4321", email: "contato@boacompra.com" },
  { id: "cli-4", nome: "Studio Beleza Rara", telefone: "(11) 95555-8765" },
]

export const orcamentosSeed: Orcamento[] = [
  {
    id: "orc-1", numero: 1001, clienteId: "cli-1",
    item: { materialId: "mat-1", servicoId: "srv-1", largura: 3, altura: 2, quantidadeUnidades: 1, horasEstimadas: 0 },
    ajusteManual: 0, anexoNome: "fachada-padaria.jpg", status: "fechado",
    criadoEm: "2026-08-20T10:00:00.000Z", fechadoEm: "2026-08-20T14:00:00.000Z",
  },
  {
    id: "orc-2", numero: 1002, clienteId: "cli-2",
    item: { materialId: "mat-2", servicoId: "srv-2", largura: 4, altura: 1.5, quantidadeUnidades: 1, horasEstimadas: 0 },
    ajusteManual: -50, anexoNome: "fachada-autopecas.jpg", status: "fechado",
    criadoEm: "2026-08-22T09:30:00.000Z", fechadoEm: "2026-08-22T11:00:00.000Z",
  },
  {
    id: "orc-3", numero: 1003, clienteId: "cli-3",
    item: { materialId: "mat-4", servicoId: "srv-5", largura: 2, altura: 1, quantidadeUnidades: 1, horasEstimadas: 0 },
    ajusteManual: 0, anexoNome: null, status: "aberto",
    criadoEm: "2026-09-10T15:00:00.000Z", fechadoEm: null,
  },
  {
    id: "orc-4", numero: 1004, clienteId: "cli-4",
    item: { materialId: "mat-5", servicoId: "srv-3", largura: 0, altura: 0, quantidadeUnidades: 6, horasEstimadas: 4 },
    ajusteManual: 0, anexoNome: null, status: "aberto",
    criadoEm: "2026-09-12T13:20:00.000Z", fechadoEm: null,
  },
  {
    id: "orc-5", numero: 1005, clienteId: "cli-1",
    item: { materialId: "mat-3", servicoId: "srv-2", largura: 2.5, altura: 2, quantidadeUnidades: 1, horasEstimadas: 0 },
    ajusteManual: 0, anexoNome: "referencia-toldo.jpg", status: "cancelado",
    criadoEm: "2026-09-05T08:45:00.000Z", fechadoEm: null,
  },
  {
    id: "orc-6", numero: 1006, clienteId: "cli-2",
    item: { materialId: "mat-6", servicoId: "srv-5", largura: 3, altura: 2, quantidadeUnidades: 1, horasEstimadas: 0 },
    ajusteManual: 30, anexoNome: "backlight-ref.jpg", status: "fechado",
    criadoEm: "2026-08-28T16:10:00.000Z", fechadoEm: "2026-08-28T17:00:00.000Z",
  },
]

export const entradasEstoqueSeed: EntradaEstoque[] = [
  { id: "ent-1", materialId: "mat-1", quantidade: 50, fornecedor: "Distribuidora Lonax", comNotaFiscal: true, numeroNota: "45892", data: "2026-08-15T09:00:00.000Z" },
  { id: "ent-2", materialId: "mat-2", quantidade: 20, fornecedor: "ACM Brasil", comNotaFiscal: true, numeroNota: "12034", data: "2026-08-18T10:30:00.000Z" },
  { id: "ent-3", materialId: "mat-5", quantidade: 15, comNotaFiscal: false, data: "2026-09-01T11:00:00.000Z" },
]
