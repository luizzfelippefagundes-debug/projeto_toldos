// Junta o que a IA leu no boleto (valor/vencimento impressos + linha digitável)
// com a matemática do código de barras e decide, campo a campo, em quem confiar.
//
// Regras:
// 1. Se o DV GERAL do código bate com o que foi lido, valor e fator de vencimento
//    do código são matematicamente corretos -> eles valem (é o que o banco cobra).
// 2. Se o DV geral NÃO bate, o campo 5 (fator + valor) foi lido errado ou o DV
//    foi lido errado. Testamos as combinações com o valor/vencimento IMPRESSOS:
//    se alguma recompõe o DV geral lido, está confirmado (e a linha é consertada).
// 3. Sem confirmação, usamos o impresso e avisamos para conferir.

import {
  apenasDigitos,
  codigoBarrasParaLinhaBancaria,
  dvGeralBancarioConfere,
  fatorDoVencimento,
  formatarLinhaDigitavel,
  interpretarBoleto,
  montarCodigoBancario,
  vencimentoPeloFator,
  type BoletoInterpretado,
} from "./boleto"

export interface LeituraIA {
  linhaDigitavel?: string | null
  blocosLinhaDigitavel?: string[] | null
  valor?: number | string | null
  vencimento?: string | null
}

export type Origem = "codigo" | "impresso" | "confirmado" | "nenhuma"

export interface BoletoReconciliado {
  valor?: number
  vencimento?: string
  numeroBoleto?: string
  tipo?: "bancario" | "concessionaria"
  // valor e vencimento conferidos matematicamente com o código de barras
  confiavel: boolean
  origemValor: Origem
  origemVencimento: Origem
  avisos: string[]
}

const MESES: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
}

function dataValida(ano: number, mes: number, dia: number): boolean {
  if (ano < 2000 || ano > 2100 || mes < 1 || mes > 12 || dia < 1) return false
  return dia <= new Date(ano, mes, 0).getDate()
}

function montar(ano: number, mes: number, dia: number): string | undefined {
  if (!dataValida(ano, mes, dia)) return undefined
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
}

// Aceita "13/11/2026", "13.11.2026", "13-11-2026", "2026-11-13", "13/11/26",
// "13 de novembro de 2026", "13 nov 2026", "Vencimento: 13/11/2026"...
export function normalizarDataBoleto(valor: string | null | undefined): string | undefined {
  if (!valor || typeof valor !== "string") return undefined
  const t = valor.trim()

  let m = /(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/.exec(t)
  if (m) return montar(Number(m[1]), Number(m[2]), Number(m[3]))

  m = /(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})/.exec(t)
  if (m) return montar(Number(m[3]), Number(m[2]), Number(m[1]))

  m = /(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{2})(?!\d)/.exec(t)
  if (m) return montar(2000 + Number(m[3]), Number(m[2]), Number(m[1]))

  m = /(\d{1,2})\s*(?:de\s+)?([a-zA-ZçÇ]{3,})\.?\s*(?:de\s+)?(\d{4})/i.exec(
    t.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  )
  if (m) {
    const mes = MESES[m[2].toLowerCase().slice(0, 3)]
    if (mes) return montar(Number(m[3]), Number(mes), Number(m[1]))
  }
  return undefined
}

// Aceita 1598.18, "1.598,18", "R$ 303,75", "303.75", "1598,18".
export function normalizarValorBoleto(valor: number | string | null | undefined): number | undefined {
  if (valor === null || valor === undefined) return undefined
  if (typeof valor === "number") {
    return Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) / 100 : undefined
  }
  let s = valor.replace(/[^\d.,]/g, "")
  if (!s) return undefined
  const ultimaVirgula = s.lastIndexOf(",")
  const ultimoPonto = s.lastIndexOf(".")
  if (ultimaVirgula > ultimoPonto) {
    s = s.replace(/\./g, "").replace(",", ".")
  } else if (ultimoPonto > ultimaVirgula && ultimaVirgula >= 0) {
    s = s.replace(/,/g, "")
  } else if (ultimoPonto >= 0 && s.length - ultimoPonto - 1 === 3 && s.split(".").length > 1) {
    // "1.598" sem centavos -> milhar
    s = s.replace(/\./g, "")
  }
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined
}

// Conserta campo 5 com zero a mais/a menos (blocos) e devolve os candidatos de linha.
function candidatosDeLinha(leitura: LeituraIA): string[] {
  const out: string[] = []
  const add = (s: string) => {
    if (s && !out.includes(s)) out.push(s)
  }
  if (leitura.linhaDigitavel) add(apenasDigitos(leitura.linhaDigitavel))
  if (leitura.blocosLinhaDigitavel?.length) {
    const blocos = leitura.blocosLinhaDigitavel.map((b) => apenasDigitos(b ?? ""))
    if (blocos.length === 5 && blocos[4] && blocos[4].length !== 14 && blocos[4].length >= 8) {
      const fator = blocos[4].slice(0, 4)
      const centavos = parseInt(blocos[4].slice(4), 10)
      if (!isNaN(centavos)) blocos[4] = fator + String(centavos).padStart(10, "0")
    }
    add(blocos.join(""))
  }
  return out
}

function escolherDecodificacao(leituras: LeituraIA[], hoje: Date): BoletoInterpretado | null {
  let melhor: BoletoInterpretado | null = null
  for (const l of leituras) {
    for (const c of candidatosDeLinha(l)) {
      const d = interpretarBoleto(c, hoje)
      if (!d) continue
      if (d.confiavel) return d
      if (!melhor || (!melhor.valido && d.valido)) melhor = d
    }
  }
  return melhor
}

const unicos = <T,>(xs: (T | undefined)[]) => [...new Set(xs.filter((x): x is T => x !== undefined))]

function brl(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`
}
function br(d: string) {
  return d.split("-").reverse().join("/")
}

export function reconciliarBoleto(
  leituras: LeituraIA[],
  hoje: Date = new Date()
): BoletoReconciliado {
  const avisos: string[] = []
  const valoresImpressos = unicos(leituras.map((l) => normalizarValorBoleto(l.valor)))
  const datasImpressas = unicos(leituras.map((l) => normalizarDataBoleto(l.vencimento)))
  const valorImpresso = valoresImpressos[0]
  const dataImpressa = datasImpressas[0]

  if (valoresImpressos.length > 1) {
    avisos.push(`Leituras diferentes do valor: ${valoresImpressos.map(brl).join(" / ")}.`)
  }
  if (datasImpressas.length > 1) {
    avisos.push(`Leituras diferentes do vencimento: ${datasImpressas.map(br).join(" / ")}.`)
  }

  const d = escolherDecodificacao(leituras, hoje)

  // Sem linha digitável utilizável: só o impresso.
  if (!d) {
    if (leituras.some((l) => l.linhaDigitavel || l.blocosLinhaDigitavel?.length)) {
      avisos.push("Não consegui decodificar a linha digitável. Confira valor e vencimento no boleto.")
    } else {
      avisos.push("Linha digitável não encontrada. Confira valor e vencimento no boleto.")
    }
    return {
      valor: valorImpresso,
      vencimento: dataImpressa,
      confiavel: false,
      origemValor: valorImpresso !== undefined ? "impresso" : "nenhuma",
      origemVencimento: dataImpressa ? "impresso" : "nenhuma",
      avisos,
    }
  }

  const numero = formatarLinhaDigitavel(d.linhaDigitavel)

  // ── Concessionária (água, luz, telefone, tributos): sem vencimento no código.
  if (d.tipo === "concessionaria") {
    let valor = valorImpresso
    let origemValor: Origem = valor !== undefined ? "impresso" : "nenhuma"
    if (d.confiavel && d.valor !== undefined) {
      if (valorImpresso !== undefined && Math.abs(valorImpresso - d.valor) > 0.005) {
        avisos.push(`Valor impresso lido como ${brl(valorImpresso)}, mas o código de barras confere ${brl(d.valor)} — usei o do código.`)
      }
      valor = d.valor
      origemValor = valorImpresso !== undefined && Math.abs(valorImpresso - d.valor) <= 0.005 ? "confirmado" : "codigo"
    } else if (!d.confiavel) {
      avisos.push("A linha digitável não passou na conferência dos dígitos. Confira o código e o valor.")
    }
    if (!dataImpressa) avisos.push("Não encontrei a data de vencimento impressa. Preencha manualmente.")
    return {
      valor,
      vencimento: dataImpressa,
      numeroBoleto: numero,
      tipo: d.tipo,
      confiavel: d.confiavel && origemValor !== "impresso",
      origemValor,
      origemVencimento: dataImpressa ? "impresso" : "nenhuma",
      avisos,
    }
  }

  // ── Boleto bancário.
  if (d.confiavel) {
    let valor = d.valor
    let origemValor: Origem = "codigo"
    if (valor === undefined) {
      // Código com valor zerado (financiamentos, valor em aberto): vale o impresso.
      valor = valorImpresso
      origemValor = valor !== undefined ? "impresso" : "nenhuma"
    } else if (valorImpresso !== undefined) {
      if (Math.abs(valorImpresso - valor) <= 0.005) origemValor = "confirmado"
      else avisos.push(`Valor impresso lido como ${brl(valorImpresso)}, mas o código de barras confere ${brl(valor)} — usei o do código.`)
    }

    let vencimento = d.vencimento
    let origemVencimento: Origem = "codigo"
    if (!vencimento) {
      vencimento = dataImpressa
      origemVencimento = vencimento ? "impresso" : "nenhuma"
    } else if (dataImpressa) {
      if (dataImpressa === vencimento) origemVencimento = "confirmado"
      else avisos.push(`Vencimento impresso lido como ${br(dataImpressa)}, mas o código de barras confere ${br(vencimento)} — usei o do código.`)
    }
    return {
      valor,
      vencimento,
      numeroBoleto: numero,
      tipo: d.tipo,
      confiavel: true,
      origemValor,
      origemVencimento,
      avisos,
    }
  }

  // DV geral não bate: tenta recompor o campo 5 com o impresso.
  const cbLido = d.codigoBarras
  const fatorLido = Number(cbLido.slice(5, 9))
  const centavosLido = Number(cbLido.slice(9, 19))
  const fatoresImpressos = unicos(datasImpressas.map(fatorDoVencimento))
  const centavosImpressos = valoresImpressos.map((v) => Math.round(v * 100))

  type Combo = { fator: number; centavos: number; peso: number }
  const combos: Combo[] = []
  for (const f of fatoresImpressos) for (const c of centavosImpressos) combos.push({ fator: f, centavos: c, peso: 3 })
  for (const c of centavosImpressos) combos.push({ fator: fatorLido, centavos: c, peso: 2 })
  for (const f of fatoresImpressos) combos.push({ fator: f, centavos: centavosLido, peso: 2 })
  // Código sem vencimento/valor (fator 0000 / valor zerado)
  for (const c of centavosImpressos) combos.push({ fator: 0, centavos: c, peso: 1 })
  for (const f of fatoresImpressos) combos.push({ fator: f, centavos: 0, peso: 1 })

  const achado = combos.find((c) => dvGeralBancarioConfere(montarCodigoBancario(cbLido, c.fator, c.centavos)))
  if (achado) {
    const cb = montarCodigoBancario(cbLido, achado.fator, achado.centavos)
    const valorCod = achado.centavos > 0 ? achado.centavos / 100 : undefined
    const vencCod = achado.fator > 0 ? vencimentoPeloFator(achado.fator, hoje) : undefined
    const valor = valorCod ?? valorImpresso
    const vencimento = vencCod ?? dataImpressa
    avisos.push("A linha digitável foi lida com erro e foi corrigida pelo valor e vencimento impressos (conferido pelo dígito verificador).")
    return {
      valor,
      vencimento,
      numeroBoleto: formatarLinhaDigitavel(codigoBarrasParaLinhaBancaria(cb)),
      tipo: d.tipo,
      confiavel: true,
      origemValor: valorCod !== undefined && centavosImpressos.includes(achado.centavos) ? "confirmado" : valorCod !== undefined ? "codigo" : "impresso",
      origemVencimento: vencCod && fatoresImpressos.includes(achado.fator) ? "confirmado" : vencCod ? "codigo" : "impresso",
      avisos,
    }
  }

  // Nada confere: impresso primeiro, código como último recurso.
  avisos.push("Não consegui conferir valor e vencimento com o código de barras. CONFIRA no boleto antes de salvar.")
  const valor = valorImpresso ?? (centavosLido > 0 ? centavosLido / 100 : undefined)
  const vencimento = dataImpressa ?? (fatorLido > 0 ? vencimentoPeloFator(fatorLido, hoje) : undefined)
  return {
    valor,
    vencimento,
    numeroBoleto: numero,
    tipo: d.tipo,
    confiavel: false,
    origemValor: valorImpresso !== undefined ? "impresso" : valor !== undefined ? "codigo" : "nenhuma",
    origemVencimento: dataImpressa ? "impresso" : vencimento ? "codigo" : "nenhuma",
    avisos,
  }
}
