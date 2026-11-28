import type { ItemAdicional, Orcamento, OrcamentoItem } from "./types"

// Pedido de orçamento vindo do site da loja (loja_toldosprint). O site manda
// só o que o cliente escolheu; o preço é sempre o do cadastro de materiais
// daqui, nunca um valor enviado pelo site.

export interface PedidoLojaItem {
  /** id do material neste sistema; vazio quando o item não tem preço cadastrado. */
  materialId?: string | null
  nome: string
  largura?: number
  altura?: number
  quantidade: number
  detalhes?: string[]
}

export interface PedidoLoja {
  codigo: string
  /**
   * Conta (login) do cliente no site, ex.: user_2abc... Liga o pedido ao "Meus pedidos".
   * Opcional: o visitante pode pedir orçamento sem entrar (pode chegar null).
   */
  conta?: string | null
  /** cidade: opcional, até 80 caracteres; vai para a observação do orçamento. */
  cliente: { nome: string; telefone: string; cidade?: string }
  recebimento?: string
  observacao?: string
  itens: PedidoLojaItem[]
}

type Validacao = { ok: true; pedido: PedidoLoja } | { ok: false; erro: string }

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const numeroEntre = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined

export function somenteDigitos(s: string) {
  return s.replace(/\D/g, "")
}

/** "(27) 99750-1517" a partir de qualquer formato, com ou sem o 55. */
export function formatarTelefoneLoja(telefone: string) {
  let d = somenteDigitos(telefone)
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return telefone.trim()
}

/** Mesma regra do robô: os 8 últimos dígitos identificam o cliente. */
export function mesmoTelefone(a: string, b: string) {
  const da = somenteDigitos(a)
  const db = somenteDigitos(b)
  if (da.length < 8 || db.length < 8) return false
  return da.slice(-8) === db.slice(-8)
}

export function validarPedidoLoja(entrada: unknown): Validacao {
  if (!entrada || typeof entrada !== "object") return { ok: false, erro: "Pedido inválido" }
  const b = entrada as Record<string, unknown>

  const codigo = texto(b.codigo, 24)
  if (!codigo) return { ok: false, erro: "Código do pedido ausente" }

  const conta = texto(b.conta, 64)
  if (conta && !/^user_[A-Za-z0-9]+$/.test(conta)) return { ok: false, erro: "Conta inválida" }

  const c = (b.cliente ?? {}) as Record<string, unknown>
  const nome = texto(c.nome, 80)
  const telefone = texto(c.telefone, 30)
  if (nome.length < 2) return { ok: false, erro: "Informe o nome" }
  if (somenteDigitos(telefone).length < 10) return { ok: false, erro: "Informe o WhatsApp com DDD" }

  if (!Array.isArray(b.itens) || b.itens.length === 0) return { ok: false, erro: "O pedido não tem itens" }
  if (b.itens.length > 20) return { ok: false, erro: "Itens demais no pedido" }

  const itens: PedidoLojaItem[] = []
  for (const bruto of b.itens) {
    const i = (bruto ?? {}) as Record<string, unknown>
    const nomeItem = texto(i.nome, 120)
    const quantidade = numeroEntre(i.quantidade, 1, 999)
    if (!nomeItem || !quantidade || !Number.isInteger(quantidade)) return { ok: false, erro: "Item inválido" }
    itens.push({
      materialId: texto(i.materialId, 40) || null,
      nome: nomeItem,
      largura: numeroEntre(i.largura, 0.01, 100),
      altura: numeroEntre(i.altura, 0.01, 100),
      quantidade,
      detalhes: Array.isArray(i.detalhes)
        ? i.detalhes.slice(0, 10).map((d) => texto(d, 200)).filter(Boolean)
        : undefined,
    })
  }

  return {
    ok: true,
    pedido: {
      codigo,
      conta: conta || undefined,
      cliente: { nome, telefone, cidade: texto(c.cidade, 80) || undefined },
      recebimento: texto(b.recebimento, 60) || undefined,
      observacao: texto(b.observacao, 1000) || undefined,
      itens,
    },
  }
}

export interface MaterialResumo {
  id: string
  unidade: string
}

function itemDoPedido(
  item: PedidoLojaItem,
  materiais: Map<string, MaterialResumo>
): { materialId: string; largura: number; altura: number; quantidadeUnidades: number; observacao: string } {
  const material = item.materialId ? materiais.get(item.materialId) : undefined
  const porM2 = material?.unidade === "m2"
  const linhas = [item.nome, ...(item.detalhes ?? [])]
  return {
    materialId: material ? material.id : "",
    largura: porM2 ? (item.largura ?? 1) : 1,
    altura: porM2 ? (item.altura ?? 1) : 1,
    quantidadeUnidades: item.quantidade,
    observacao: linhas.join(" | "),
  }
}

export function observacaoDoPedido(p: PedidoLoja) {
  return [
    `Pedido pelo site (${p.codigo})`,
    p.conta ? `Conta: ${p.conta}` : "",
    p.cliente.cidade ? `Cidade: ${p.cliente.cidade}` : "",
    p.recebimento ? `Recebimento: ${p.recebimento}` : "",
    p.observacao ? `Observação do cliente: ${p.observacao}` : "",
    "Itens:",
    ...p.itens.map((i) => `- ${i.quantidade}× ${i.nome}${i.detalhes?.length ? ` (${i.detalhes.join("; ")})` : ""}`),
  ]
    .filter(Boolean)
    .join("\n")
}

/** Monta o orçamento aberto (sem número: o banco atribui na hora de gravar). */
export function montarOrcamentoLoja(
  p: PedidoLoja,
  base: { id: string; clienteId: string; agora: string },
  materiais: Map<string, MaterialResumo>
): Omit<Orcamento, "numero"> {
  const [principal, ...resto] = p.itens.map((i) => itemDoPedido(i, materiais))
  const adicionais: ItemAdicional[] = resto.map((r, n) => ({
    id: `loja-${n + 1}`,
    materialId: r.materialId,
    servicoId: "",
    largura: r.largura,
    altura: r.altura,
    quantidadeUnidades: r.quantidadeUnidades,
    horasEstimadas: 0,
    observacao: r.observacao,
  }))
  const item: OrcamentoItem = {
    materialId: principal.materialId,
    servicoId: "",
    largura: principal.largura,
    altura: principal.altura,
    quantidadeUnidades: principal.quantidadeUnidades,
    horasEstimadas: 0,
    observacao: principal.observacao,
    ...(adicionais.length ? { itensAdicionais: adicionais } : {}),
  }
  return {
    id: base.id,
    clienteId: base.clienteId,
    item,
    ajusteManual: 0,
    anexoNome: null,
    status: "aberto",
    criadoEm: base.agora,
    fechadoEm: null,
    validadeDias: 7,
    observacao: observacaoDoPedido(p),
    origem: "loja",
  }
}

export interface ResumoPedidoLoja {
  codigo: string
  conta?: string
  cidade?: string
  recebimento?: string
  observacaoCliente?: string
  itens: string[]
}

/** Lê de volta o texto gravado por observacaoDoPedido, para o painel do site. */
export function resumirPedidoLoja(observacao: string | null | undefined): ResumoPedidoLoja {
  const linhas = (observacao ?? "").split("\n")
  const codigo = /^Pedido pelo site \(([^)]+)\)/.exec(linhas[0] ?? "")?.[1] ?? ""
  const pegar = (prefixo: string) =>
    linhas.find((l) => l.startsWith(prefixo))?.slice(prefixo.length).trim() || undefined
  const iniciaItens = linhas.findIndex((l) => l.trim() === "Itens:")
  const itens =
    iniciaItens >= 0
      ? linhas
          .slice(iniciaItens + 1)
          .filter((l) => l.startsWith("- "))
          .map((l) => l.slice(2).trim())
      : []
  return {
    codigo,
    conta: pegar("Conta:"),
    cidade: pegar("Cidade:"),
    recebimento: pegar("Recebimento:"),
    observacaoCliente: pegar("Observação do cliente:"),
    itens,
  }
}

export interface PrecoMaterial {
  unidade: string
  preco: number
}

/**
 * Valor estimado só do material de um orçamento (área x preço por m2, ou
 * quantidade x preço por unidade), somando o item principal e os adicionais.
 * Itens sem material cadastrado não entram; sem nenhum material, devolve null.
 */
export function estimarTotalMaterial(item: OrcamentoItem, materiais: Map<string, PrecoMaterial>): number | null {
  let total = 0
  let algum = false
  for (const parte of [item, ...(item.itensAdicionais ?? [])]) {
    const m = materiais.get(parte.materialId)
    if (!m) continue
    algum = true
    const qtd = parte.quantidadeUnidades > 0 ? parte.quantidadeUnidades : 1
    total += m.unidade === "m2" ? parte.largura * parte.altura * qtd * m.preco : qtd * m.preco
  }
  return algum ? Math.round(total * 100) / 100 : null
}

const encurtar = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s)
const medida = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })

/**
 * Texto do aviso no WhatsApp do Kaio quando chega um orçamento novo pelo site.
 * Função pura (sem rede) para poder testar o formato.
 */
export function mensagemNovoOrcamentoLoja(
  p: PedidoLoja,
  extra: { numeroFormatado: string; link?: string | null }
): string {
  const linhas = [
    "🛒 *Novo orçamento pelo site*",
    "",
    `*Nº:* ${extra.numeroFormatado}`,
    `*Cliente:* ${p.cliente.nome}`,
    `*WhatsApp:* ${formatarTelefoneLoja(p.cliente.telefone)}`,
  ]
  if (p.cliente.cidade) linhas.push(`*Cidade:* ${p.cliente.cidade}`)
  if (p.recebimento) linhas.push(`*Recebimento:* ${p.recebimento}`)
  linhas.push("", "*Itens:*")
  for (const i of p.itens.slice(0, 10)) {
    const dim = i.largura && i.altura ? ` — ${medida(i.largura)} × ${medida(i.altura)} m` : ""
    const det = i.detalhes?.length ? `\n   _${encurtar(i.detalhes.join("; "), 160)}_` : ""
    linhas.push(`• ${i.quantidade}× ${i.nome}${dim}${det}`)
  }
  if (p.itens.length > 10) linhas.push(`• … e mais ${p.itens.length - 10} item(ns)`)
  if (p.observacao) linhas.push("", `*Obs. do cliente:* ${encurtar(p.observacao, 300)}`)
  if (extra.link) linhas.push("", `Abrir no sistema: ${extra.link}`)
  return linhas.join("\n")
}

/** Link da aba "Orçamentos da loja" já abrindo o orçamento, se houver URL pública configurada. */
export function linkOrcamentoLoja(baseUrl: string | undefined | null, orcamentoId: string): string | null {
  const base = (baseUrl ?? "").trim().replace(/\/+$/, "")
  if (!/^https?:\/\//.test(base)) return null
  return `${base}/orcamentos-loja?abrir=${encodeURIComponent(orcamentoId)}`
}
