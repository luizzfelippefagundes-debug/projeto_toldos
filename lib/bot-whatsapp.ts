import { google } from "@ai-sdk/google"
import { openai } from "@ai-sdk/openai"
import { generateText, stepCountIs, tool } from "ai"
import { z } from "zod"
import { getSql } from "./db"
import {
  atualizarConversa,
  destravarProcessamento,
  getOuCriarConversa,
  reabrirBot,
  roubarTravaProcessamento,
  tentarTravarProcessamento,
  transferirAtendimento,
  type ConversaBot,
  type MensagemHistorico,
} from "./bot-conversa"
import { buscarNomeNaAgenda, enviarDocumentoWhatsapp, enviarMensagemWhatsapp } from "./evolution-api"
import { formatarData, formatarMoeda } from "./format"
import { gerarPdfOrcamentoServidor } from "./pdf-orcamento-servidor"
import { formatarNumeroOrcamento } from "./orcamento-pdf"
import { verificarHorarioAtendimento, formatarMensagemForaDoHorario } from "./bot-horario"
import type { Orcamento, StatusPedidoRapido } from "./types"

const STATUS_PRODUCAO_LEGIVEL: Record<StatusPedidoRapido, string> = {
  aguardando: "aguardando aprovação",
  aprovado: "aprovado, entrando na fila de produção",
  arte: "em produção (arte)",
  ag_confirmacao: "aguardando aprovação da arte pelo cliente",
  impressao: "em produção (impressão)",
  acabamento: "em produção (acabamento)",
  pronto: "pronto, aguardando retirada/entrega",
  entregue: "entregue",
}

export const SERVICOS_TEXTO = `SERVIÇOS mais utilizados:

COMUNICAÇÃO VISUAL:
- adesivos comum
- adesivos em recorte
- banners
- placas de identificação
- placas de ACM 3D
- fachadas de ACM
- lonas
- reformas de fachada
- reformas de vitrines
- rótulos
- adesivos para carro
- adesivo para moto
- adesivo de parede
- letras 3D
- outdoor

TOLDOS E COBERTURAS:
- toldos para janelas
- toldos para varandas ou área de serviço
- toldos fixo
- toldo cortina (de enrolar)
- toldos de policarbonato
- coberturas de policarbonato
- reformas de toldo`

export function normalizarTelefone(numero: string): string {
  return numero.replace(/\D/g, "")
}

export function formatarTelefoneBrasil(tel: string): string {
  const d = tel.replace(/\D/g, "")
  const semPais = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d
  if (semPais.length === 11) {
    return `(${semPais.slice(0, 2)}) ${semPais.slice(2, 7)}-${semPais.slice(7)}`
  }
  if (semPais.length === 10) {
    return `(${semPais.slice(0, 2)}) ${semPais.slice(2, 6)}-${semPais.slice(6)}`
  }
  return tel
}

export async function buscarClientePorTelefone(telefone: string): Promise<{ id: string; nome: string } | null> {
  const sql = getSql()
  const alvo = normalizarTelefone(telefone)
  const clientes = await sql`SELECT id, nome, telefone FROM clientes`
  const encontrado = clientes.find((c) => normalizarTelefone(c.telefone as string).endsWith(alvo.slice(-8)))
  return encontrado ? { id: encontrado.id as string, nome: encontrado.nome as string } : null
}

export async function criarClienteAutomaticoSeNaoExistir({
  telefone,
  pushName,
}: {
  telefone: string
  pushName?: string
}): Promise<{ id: string; nome: string; criadoNovo: boolean }> {
  const clienteExistente = await buscarClientePorTelefone(telefone)
  if (clienteExistente) {
    return { ...clienteExistente, criadoNovo: false }
  }

  const sql = getSql()
  const id = crypto.randomUUID()
  const telFormatado = formatarTelefoneBrasil(telefone)
  const nomeFinal = pushName?.trim() || `Cliente ${telFormatado}`

  await sql`
    INSERT INTO clientes (id, nome, telefone, email, cpf)
    VALUES (${id}, ${nomeFinal}, ${telFormatado}, null, null)
  `

  return { id, nome: nomeFinal, criadoNovo: true }
}

async function adquirirTrava(conversaInicial: ConversaBot): Promise<{ conversa: ConversaBot; travado: boolean }> {
  const TENTATIVAS = 5
  const INTERVALO_MS = 1000
  const LIMITE_TRAVA_PRESA_MS = 20_000

  let conversa = conversaInicial
  if (await tentarTravarProcessamento(conversa.id)) return { conversa, travado: true }

  for (let i = 0; i < TENTATIVAS; i++) {
    await new Promise((r) => setTimeout(r, INTERVALO_MS))
    conversa = await getOuCriarConversa(conversa.telefone)
    if (await tentarTravarProcessamento(conversa.id)) return { conversa, travado: true }
  }

  if (conversa.processandoDesde && Date.now() - new Date(conversa.processandoDesde).getTime() > LIMITE_TRAVA_PRESA_MS) {
    await roubarTravaProcessamento(conversa.id)
    return { conversa, travado: true }
  }
  return { conversa, travado: false }
}

export const STOPWORDS_NOME = new Set([
  "qu", "qual", "quanto", "quando", "onde", "como", "quem", "por", "que", "pra", "pro",
  "oi", "ola", "opa", "eai", "fala", "alo", "bom", "dia", "boa", "tarde", "noite",
  "sim", "nao", "ok", "beleza", "blz", "fechou", "vamos", "valeu", "obrigado", "obrigada",
  "quero", "queria", "gostaria", "preciso", "precisava", "favor", "porfavor",
  "tem", "voce", "voces", "toldo", "toldos", "banner", "banners", "lona", "lonas",
  "placa", "placas", "adesivo", "adesivos", "fachada", "fachadas", "letra", "letras",
  "preco", "precos", "valor", "valores", "orcamento", "orcamentos", "reforma", "reformas",
  "teste", "testes", "testando", "nada", "tudo", "mais", "menos", "aqui", "grupo", "fazer",
  "marcar", "vincular", "vinculado"
])

export const STOPWORDS_LOCAL = new Set([
  "alteracao", "alteração", "alterac", "alteraç", "frente", "cima", "baixo",
  "saber", "fazer", "ver", "comprar", "orcamento", "orçamento", "toldo", "toldos",
  "outdoor", "outdoors", "fachada", "fachadas", "placa", "placas", "banner", "banners",
  "adesivo", "adesivos", "reforma", "reformas", "breve", "semana", "mes", "mês", "ano",
  "hoje", "amanha", "amanhã", "ontem", "tempo", "duvida", "dúvida", "duvidas", "dúvidas",
  "sim", "nao", "não", "aqui", "ali", "la", "lá", "grupo", "mais", "menos", "nada", "tudo",
  "projeto", "projetos", "medida", "medidas", "foto", "fotos", "valor", "valores", "preco", "preço"
])

export function ehNomeValido(nome?: string | null): boolean {
  if (!nome) return false
  const limpo = nome.trim()
  if (limpo.length < 3) return false
  if (limpo.length > 40) return false
  if (/[\d?!@#$%^&*()_+={}\[\]:;"'<>/\\]/.test(limpo)) return false
  const primeiraPalavra = limpo.toLowerCase().split(/\s+/)[0]
  if (STOPWORDS_NOME.has(primeiraPalavra)) return false
  return true
}

export function extrairLocalizacao(texto: string): string | undefined {
  const limpo = texto.trim()

  // 1. "Sou o Lucas de Colatina Centro", "Me chamo Lucas de Colatina"
  const mSouDe = /^(?:sou\s+(?:o|a)?\s*|me\s*chamo\s*|meu\s*nome\s*[ée]\s*)[a-zA-ZçÇáéíóúÁÉÍÓÚ\s]+\s+de\s+([a-zA-ZçÇáéíóúÁÉÍÓÚ\s/-]{3,30})$/i.exec(limpo)
  // 2. "moro em Colatina", "sou de Colatina", "falando de Vitória", "aqui de Colatina", "cidade de Colatina"
  const mPrefixo = /(?:moro em|sou de|sou da cidade de|falando de|aqui de|aqui em|cidade de)\s+([a-zA-ZçÇáéíóúÁÉÍÓÚ\s/-]{3,30})/i.exec(limpo)

  const candidato = (mSouDe ? mSouDe[1] : mPrefixo ? mPrefixo[1] : null)?.trim()
  if (!candidato) return undefined

  const primeira = candidato.toLowerCase().split(/[\s/-]+/)[0]
  if (candidato.length < 3 || STOPWORDS_LOCAL.has(primeira) || STOPWORDS_NOME.has(primeira)) {
    return undefined
  }

  if (/[\d?!@#$%^&*()_+={}\[\]:;"'<>/\\]/.test(candidato)) return undefined

  return candidato
}

export function extrairAssuntoInteresse(texto: string): string | null {
  const limpo = texto.toLowerCase()
  if (/\b(outdoor|outdoors)\b/i.test(limpo)) return "Outdoor / Painel Externo"
  if (/\b(toldo cortina|cortina)\b/i.test(limpo)) return "Toldo Cortina (de enrolar)"
  if (/\b(toldo fixo)\b/i.test(limpo)) return "Toldo Fixo"
  if (/\b(policarbonato|cobertura|coberturas)\b/i.test(limpo)) return "Cobertura / Toldo em Policarbonato"
  if (/\b(toldo|toldos)\b/i.test(limpo)) return "Toldos e Coberturas"
  if (/\b(fachada|fachadas)\b/i.test(limpo)) return "Fachada Comercial / ACM"
  if (/\b(letra|letras|3d|caixa)\b/i.test(limpo)) return "Letras Caixa 3D"
  if (/\b(placa|placas|acm)\b/i.test(limpo)) return "Placas de ACM / Identificação"
  if (/\b(banner|banners|lona|lonas)\b/i.test(limpo)) return "Banners e Lonas"
  if (/\b(adesivo|adesivos|envelopamento)\b/i.test(limpo)) return "Adesivos / Envelopamento"
  if (/\b(rotulo|rotulos|rótulo|rótulos)\b/i.test(limpo)) return "Rótulos / Etiquetas"
  if (/\b(vitrine|vitrines)\b/i.test(limpo)) return "Reforma de Vitrines"
  if (/\b(reforma|reformas)\b/i.test(limpo)) return "Reforma / Manutenção"
  if (/\b(or[çc]amento|pre[çc]o|valor|cota[çc][ãa]o|quanto custa)\b/i.test(limpo)) return "Solicitação de Orçamento"
  return null
}

export function extrairResumoDemanda({
  historico = [],
  textoRecebido,
  assunto,
  local,
}: {
  historico?: { role: string; content: string }[]
  textoRecebido: string
  assunto?: string | null
  local?: string | null
}): string {
  const msgsUsuario = [
    ...historico.filter((h) => h.role === "user").map((h) => h.content),
    textoRecebido,
  ]
  const textoCompleto = msgsUsuario.join(" ")
  const limpo = textoCompleto.toLowerCase()

  // 1. Detecta medidas/dimensões (ex: 4x2.5, 3m x 2m, 5 metros, etc.)
  const mMedidas = textoCompleto.match(/\b\d+(?:[.,]\d+)?\s*(?:m|metros?|cm)?\s*(?:x|por|\*)\s*\d+(?:[.,]\d+)?\s*(?:m|metros?|cm)?\b/i)
    || textoCompleto.match(/\b\d+(?:[.,]\d+)?\s*(?:m|metros|cm)\b/i)
  const medidasEncontradas = mMedidas ? mMedidas[0].trim() : null

  // 2. Detecta ambiente/local de instalação
  const ambientes: string[] = []
  if (/\b(varanda|sacada)\b/i.test(limpo)) ambientes.push("varanda")
  if (/\b(garagem|estacionamento)\b/i.test(limpo)) ambientes.push("garagem")
  if (/\b(churrasqueira|churrasco|gourmet|área gourmet)\b/i.test(limpo)) ambientes.push("área gourmet")
  if (/\b(janela|janelas)\b/i.test(limpo)) ambientes.push("janela")
  if (/\b(fachada|frente|frente de loja|vitrine)\b/i.test(limpo)) ambientes.push("fachada de loja")
  if (/\b(porta|portão|entrada)\b/i.test(limpo)) ambientes.push("entrada/portão")

  // 3. Detecta características específicas
  const detalhes: string[] = []
  if (/\b(visor|transparente|cristal)\b/i.test(limpo)) detalhes.push("com visor transparente")
  if (/\b(motorizado|automático|controle)\b/i.test(limpo)) detalhes.push("motorizado")
  if (/\b(manual|manivela)\b/i.test(limpo)) detalhes.push("manual com manivela")
  if (/\b(policarbonato)\b/i.test(limpo)) detalhes.push("em policarbonato")
  if (/\b(acm|alumínio)\b/i.test(limpo)) detalhes.push("em ACM")
  if (/\b(troca(?:r)?(?:\s+a)?\s+lona)\b/i.test(limpo)) {
    detalhes.push("troca de lona")
  } else if (/\b(lona|banner)\b/i.test(limpo)) {
    detalhes.push("em lona")
  }
  if (/\b(reforma|conserto|manuten[çc][ãa]o)\b/i.test(limpo)) detalhes.push("serviço de reforma/manutenção")

  // 4. Produto principal
  const prod = assunto || extrairAssuntoInteresse(textoCompleto)

  if (prod || medidasEncontradas || ambientes.length > 0 || detalhes.length > 0) {
    const partes: string[] = []
    partes.push(`Interesse em ${prod || "Orçamento comercial"}`)
    if (ambientes.length > 0) partes.push(`para ${ambientes.join("/")}`)
    if (medidasEncontradas) partes.push(`(medidas citadas: ${medidasEncontradas})`)
    if (detalhes.length > 0) partes.push(`- ${detalhes.join(", ")}`)
    return partes.join(" ") + "."
  }

  const frasesRelevantes = msgsUsuario
    .map((m) => m.trim())
    .filter((m) => m.length > 3 && !/^(oi|ol[áa]|bom dia|boa tarde|boa noite|ok|sim|n[ãa]o|beleza|obrigad[oa])$/i.test(m))

  if (frasesRelevantes.length > 0) {
    return frasesRelevantes[frasesRelevantes.length - 1]
  }

  return textoRecebido.trim()
}

export function formatarAlertaTransferencia({
  nome,
  ehClienteCadastrado,
  local,
  telefone,
  textoRecebido,
  assunto,
  resumoAnalise,
}: {
  nome?: string | null
  ehClienteCadastrado?: boolean
  local?: string | null
  telefone: string
  textoRecebido: string
  assunto?: string | null
  resumoAnalise?: string | null
}): string {
  const nomeEfetivo = ehNomeValido(nome) ? nome?.trim() : null
  const rotuloCliente = nomeEfetivo
    ? `${nomeEfetivo}${ehClienteCadastrado ? " (Cliente Cadastrado)" : ""}`
    : "Não informado (Novo contato)"

  const localValido =
    local &&
    local.trim() &&
    !STOPWORDS_LOCAL.has(local.trim().toLowerCase()) &&
    local.trim().toLowerCase() !== "não informado"
      ? local.trim()
      : null

  const localLinha = localValido ? `📍 *Local:* ${localValido}\n` : ""
  const assuntoLinha = assunto ? `🎯 *Assunto:* ${assunto}\n` : ""
  const resumoLinha = resumoAnalise ? `📋 *Resumo da Demanda:* ${resumoAnalise.trim()}\n` : ""

  return (
    `🔔 *Novo Atendimento Transferido!*\n\n` +
    `👤 *Cliente:* ${rotuloCliente}\n` +
    localLinha +
    `📱 *WhatsApp:* ${formatarTelefoneBrasil(telefone)}\n` +
    assuntoLinha +
    resumoLinha +
    `💬 *Mensagem do cliente:* "${textoRecebido.trim()}"\n\n` +
    `👉 Acesse o WhatsApp para responder!`
  )
}

export async function processarMensagemWhatsapp(
  telefone: string,
  textoRecebido: string,
  pushName?: string | null
): Promise<string | null> {
  const conversaInicial = await getOuCriarConversa(telefone)
  const { conversa, travado } = await adquirirTrava(conversaInicial)
  if (!travado) return "Só um segundo, já te respondo!"

  try {
    return await processarComTravaAdquirida(telefone, textoRecebido, conversa, pushName)
  } finally {
    await destravarProcessamento(conversa.id)
  }
}

export function resolverFluxoAtendimento(
  textoRecebido: string,
  historico: MensagemHistorico[],
  nomeSalvo?: string | null,
  localSalvo?: string | null,
  pushName?: string | null,
  ehClienteCadastrado?: boolean,
  dataReferencia?: Date
): { resposta: string; nome?: string; local?: string; transferir?: boolean; assunto?: string } {
  const limpo = textoRecebido.trim().toLowerCase()
  const eSaudacao = /^(oi+|ol[aá]+|e a[ií]|bom dia|boa tarde|boa noite|hey|hello|al[oô]+|opa|fala)[\s!?.]*$/i.test(limpo)
  const pedeOrcamento = /(or[çc]amento|pre[çc]o|valor|quanto|custa|fazer|produzir|toldo|toldos|adesivo|adesivos|placa|placas|lona|lonas|fachada|fachadas|banner|banners|faixa|faixas|letra|letras|3d|reforma|reformas|cobertura|coberturas|outdoor|outdoors|totem|totens|painel|paineis|painéis|rotulo|rotulos|rótulo|rótulos|vitrine|vitrines|envelopamento|acm|luminoso|luminosos|cortina|policarbonato|janela|varanda|tapume|comprar|encomendar)/i.test(limpo)
  const pedeCartao = /(cart[aã]o|cr[eé]dito|d[eé]bito|parcela|parcelar|parcelamento|link.*pagamento|op[çc][ãa]o 2|^2$)/i.test(limpo)
  const pedePix = /(pix|chave pix|copia e cola|op[çc][ãa]o 1|^1$)/i.test(limpo)
  const pedeFormaPagamento = /(como pagar|como pago|forma de pagamento|dados bancarios|formas de pagamento)/i.test(limpo)

  // 1. Dúvida sobre pagamento (Cartão, Pix ou Geral)
  if (pedeCartao) {
    return {
      resposta:
        "💳 *PAGAMENTO NO CARTÃO DE CRÉDITO:*\n\n" +
        "Aceitamos cartões de crédito com parcelamento em até 12x pelo Mercado Pago!\n\n" +
        "👉 O link seguro para pagamento é enviado junto com a sua Ordem de Serviço ou Orçamento.\n" +
        "Se precisar que reenviemos o link do seu pedido ou que passemos na maquininha física, nossa equipe técnica já está à disposição por aqui! 🤝✨",
    }
  }

  if (pedePix) {
    const chavePix = process.env.PIX_CHAVE_EMPRESA || "09.141.206/0001-06"
    return {
      resposta:
        "⚡ *PAGAMENTO VIA PIX:*\n\n" +
        `Nossa chave PIX oficial é o CNPJ:\n👉 *${chavePix}*\n` +
        "Chave sem pontuação (para copiar): *09141206000106*\n" +
        "Favorecido: *Toldos Print & Comunicação Visual*\n\n" +
        "Assim que realizar o pagamento, pode mandar o comprovante por aqui mesmo que confirmamos o seu pedido na hora! 🤝✨",
    }
  }

  if (pedeFormaPagamento) {
    const chavePix = process.env.PIX_CHAVE_EMPRESA || "09.141.206/0001-06"
    return {
      resposta:
        "💳 *FORMAS DE PAGAMENTO ACEITAS:*\n\n" +
        "Qual forma você prefere?\n\n" +
        `1️⃣ *Pix (à vista):*\n` +
        `• Chave CNPJ: *${chavePix}* (números: *09141206000106*)\n` +
        `• Favorecido: *Toldos Print & Comunicação Visual*\n\n` +
        `2️⃣ *Cartão de Crédito (em até 12x):*\n` +
        `• Link seguro online via Mercado Pago ou na nossa maquininha física!\n\n` +
        "Basta nos informar a opção escolhida ou responder por aqui! 🤝✨",
    }
  }

  const nomeEfetivo =
    (ehNomeValido(nomeSalvo) ? nomeSalvo!.trim() : null) ||
    (ehNomeValido(pushName) ? pushName!.trim() : null)

  const ehContatoConhecido = Boolean(ehClienteCadastrado || nomeEfetivo)
  const assuntoDetectado = extrairAssuntoInteresse(textoRecebido)

  // 2. FINS DE SEMANA E FORA DO HORÁRIO COMERCIAL (Seg a Sex das 07:30 às 17:00):
  // Se for sábado, domingo ou fora do expediente, o robô avisa que a loja está fechada,
  // informa os horários e que a equipe técnica entrará em contato logo que abrir.
  if (dataReferencia) {
    const statusHorario = verificarHorarioAtendimento(dataReferencia)
    if (!statusHorario.estaAberto) {
      const vocativo = nomeEfetivo ? `, ${nomeEfetivo}` : ""
      const jaAvisouFechado = historico.some(
        (h) => h.role === "assistant" && h.content.includes("Nosso horário de funcionamento é")
      )

      if (jaAvisouFechado) {
        return {
          resposta: `Anotado${vocativo}! 📝 Já deixei tudo salvo aqui. Logo que nossa equipe iniciar o atendimento ${statusHorario.proximaAberturaDescricao}, vamos te responder por aqui! ⏳🧑‍💼`,
          nome: nomeEfetivo || undefined,
          local: localSalvo || undefined,
          transferir: true,
          assunto: assuntoDetectado || undefined,
        }
      }

      return {
        resposta: formatarMensagemForaDoHorario({
          nome: nomeEfetivo,
          status: statusHorario,
          assunto: assuntoDetectado,
        }),
        nome: nomeEfetivo || undefined,
        local: localSalvo || undefined,
        transferir: true,
        assunto: assuntoDetectado || (statusHorario.ehFimDeSemana ? "Fim de Semana" : "Fora do Horário"),
      }
    }
  }

  // 2. CONTATOS CONHECIDOS (cliente já cadastrado no sistema ou com nome já identificado):
  // NUNCA perguntar nome ou cidade! O Kaio e a empresa já sabem quem é o cliente.
  if (ehContatoConhecido) {
    // Cadastrado com nome em branco/inválido (ex.: "."): cumprimenta sem nome.
    const vocativo = nomeEfetivo ? `, ${nomeEfetivo}` : ""
    // Se o cliente apenas mandou saudação ("Oi", "Olá", "Bom dia", etc.)
    if (eSaudacao) {
      return {
        resposta:
          `Olá${vocativo}! Seja muito bem-vindo(a) à Toldos Print. 🤝✨\n\n` +
          `Como podemos te ajudar hoje?`,
        nome: nomeEfetivo || undefined,
        local: localSalvo || undefined,
      }
    }

    // Se o cliente pediu orçamento ou mencionou algum serviço
    if (pedeOrcamento) {
      return {
        resposta:
          `Perfeito${vocativo}! Para agilizar o seu orçamento:\n` +
          `📸 Tire uma foto do local ou do que deseja;\n` +
          `📏 Se tiver, envie também as medidas aproximadas ou projeto.\n\n` +
          `Já estou transferindo o seu atendimento para nossa equipe técnica. Em instantes vamos te responder por aqui! ⏳🧑‍💼`,
        nome: nomeEfetivo || undefined,
        local: localSalvo || undefined,
        transferir: true,
        assunto: assuntoDetectado || "Solicitação de Orçamento",
      }
    }

    // Se mandou mensagem em andamento (ex: "Semana que vem iremos finalizar a sua frente", "fechou, vamos marcar")
    return {
      resposta:
        `Olá${vocativo}! Mensagem recebida. 🤝\n` +
        `Já encaminhei diretamente para o Kaio e nossa equipe técnica. Em instantes vamos te responder por aqui! ⏳🧑‍💼`,
      nome: nomeEfetivo || undefined,
      local: localSalvo || undefined,
      transferir: true,
      assunto: assuntoDetectado || undefined,
    }
  }

  // 3. CONTATOS NOVOS / NÃO IDENTIFICADOS:
  // Se o bot já apresentou o menu de serviços na conversa, não repete mais
  const jaEnviouServicos = historico.some(
    (h) =>
      h.role === "assistant" &&
      (h.content.includes("SERVIÇOS mais utilizados") ||
        h.content.includes("Como posso te ajudar?") ||
        h.content.includes("Como podemos te ajudar?"))
  )

  if (jaEnviouServicos && !eSaudacao) {
    const nomeParaMsg = nomeEfetivo ? `, ${nomeEfetivo}` : ""
    return {
      resposta:
        `Perfeito${nomeParaMsg}! Para agilizar o seu orçamento:\n` +
        `📸 Tire uma foto do local ou do que deseja;\n` +
        `📏 Tenha em mãos as medidas ou projetos.\n\n` +
        `Já estou transferindo o seu atendimento para nossa equipe técnica. Em instantes vamos te responder por aqui! ⏳🧑‍💼`,
      nome: nomeEfetivo || undefined,
      local: localSalvo || undefined,
      transferir: true,
      assunto: assuntoDetectado || "Solicitação de Orçamento",
    }
  }

  // Se for início de conversa simples de novo contato (saudação ou sem pedido explícito)
  if ((historico.length === 0 && !pedeOrcamento) || eSaudacao) {
    return {
      resposta:
        "Olá! Seja muito bem-vindo(a) à Toldos Print. 🤝✨\n" +
        "Especialistas em Toldos, Coberturas e Comunicação Visual de alta qualidade.\n\n" +
        "Para que possamos lhe atender com agilidade e direcionar ao setor correto:\n" +
        "Por gentileza, com quem temos o prazer de falar e de qual cidade/bairro você é?",
    }
  }

  // Tenta extrair nome e local da mensagem do novo cliente
  let nomeExtraido: string | undefined = undefined
  let localExtraido: string | undefined = extrairLocalizacao(textoRecebido) || (localSalvo || undefined)

  const mSou = /(?:sou\s+(?:o|a)?\s*|me\s*chamo\s*|meu\s*nome\s*[ée]\s*)([a-zA-ZçÇáéíóúÁÉÍÓÚ\s]{3,30})/i.exec(textoRecebido)
  if (mSou && ehNomeValido(mSou[1].trim())) {
    nomeExtraido = mSou[1].trim()
  } else if (!pedeOrcamento) {
    const ultimaPerguntaPediuNome =
      historico.length > 0 &&
      historico[historico.length - 1].role === "assistant" &&
      (historico[historico.length - 1].content.includes("com quem temos o prazer de falar") ||
        historico[historico.length - 1].content.includes("Qual seu nome"))
    if (ultimaPerguntaPediuNome && textoRecebido.split(/\s+/).length <= 3) {
      const candidato = textoRecebido.split(/[,de\s]+/)[0].trim()
      if (ehNomeValido(candidato)) {
        nomeExtraido = candidato
      }
    }
  }

  if (pedeOrcamento) {
    const nomeParaMsg = nomeExtraido ? `, ${nomeExtraido}` : ""
    return {
      resposta:
        `Perfeito${nomeParaMsg}! Para agilizar o seu orçamento:\n` +
        `📸 Tire uma foto do local ou do que deseja;\n` +
        `📏 Tenha em mãos as medidas ou projetos.\n\n` +
        `Já estou transferindo o seu atendimento para nossa equipe técnica. Em instantes vamos te responder por aqui! ⏳🧑‍💼`,
      nome: nomeExtraido,
      local: localExtraido,
      transferir: true,
      assunto: assuntoDetectado || "Solicitação de Orçamento",
    }
  }

  const nomeParaMsg = nomeExtraido ? `, ${nomeExtraido}` : ""
  return {
    resposta:
      `Prazer${nomeParaMsg}!\n\n` +
      `${SERVICOS_TEXTO}\n\n` +
      `Como posso te ajudar?`,
    nome: nomeExtraido,
    local: localExtraido,
  }
}

async function processarComTravaAdquirida(
  telefone: string,
  textoRecebido: string,
  conversa: ConversaBot,
  pushName?: string | null
): Promise<string | null> {
  const limpo = textoRecebido.trim().toLowerCase()
  const comandoReiniciar = /^(#?reset|#?reiniciar|#?novo|#?inicio|#?menu)$/i.test(limpo)
  const eSaudacao = /^(oi+|ol[aá]+|e a[ií]|bom dia|boa tarde|boa noite|hey|hello|al[oô]+|opa|fala)[\s!?.]*$/i.test(limpo)

  // Depois de transferir pra um humano, o bot silencia pra dar espaço ao atendimento.
  // Mas se o usuário mandar #reiniciar/#reset, ou passou > 2h e mandou saudação,
  // ou a transferência expirou (> 4h), o bot reabre o atendimento automaticamente.
  if (conversa.transferidoEm) {
    const HORAS_TRANSFERENCIA_EXPIRAR = 4
    const tempoDesdeTransferencia = Date.now() - new Date(conversa.transferidoEm).getTime()
    const expirou = tempoDesdeTransferencia > HORAS_TRANSFERENCIA_EXPIRAR * 3600_000

    if (comandoReiniciar || (eSaudacao && tempoDesdeTransferencia > 2 * 3600_000) || expirou) {
      await reabrirBot(conversa.id)
      conversa.transferidoEm = null
    } else {
      return null
    }
  }

  // 1. Verifica se já é cliente cadastrado na base do Kaio/Toldos Print ou se
  // o número está salvo na agenda do WhatsApp da loja. Em qualquer um dos
  // dois casos o bot NÃO pergunta nome nem cidade.
  const clienteCadastrado = await buscarClientePorTelefone(telefone)
  const nomeClienteCadastrado = clienteCadastrado?.nome?.trim()
  const nomeAgenda = ehNomeValido(nomeClienteCadastrado) ? null : await buscarNomeNaAgenda(telefone)
  const ehClienteCadastrado = Boolean(clienteCadastrado) || ehNomeValido(nomeAgenda)

  const HORAS_PARA_EXPIRAR = 6
  const sessaoExpirada = Date.now() - new Date(conversa.atualizadoEm).getTime() > HORAS_PARA_EXPIRAR * 3600_000
  const reiniciar = comandoReiniciar || sessaoExpirada || (eSaudacao && conversa.historico.length > 0)
  const historico: MensagemHistorico[] = reiniciar ? [] : conversa.historico

  let nomeTemp =
    (ehNomeValido(nomeClienteCadastrado) ? nomeClienteCadastrado : null) ||
    (ehNomeValido(nomeAgenda) ? nomeAgenda : null) ||
    (ehNomeValido(conversa.nomeTemp) ? conversa.nomeTemp : null) ||
    (ehNomeValido(pushName) ? pushName?.trim() : null) ||
    null

  let localTemp = reiniciar ? null : (conversa.localTemp || extrairLocalizacao(textoRecebido) || null)
  let transferido = false

  const systemPrompt = `Você é o atendente virtual da TOLDOSPRINT (Toldos e Comunicação Visual), respondendo pelo WhatsApp de forma profissional, ágil e acolhedora.

FLUXO EXATO DA CONVERSA:

Passo 1 (Saudação Inicial):
Se a conversa estiver começando (ou o cliente mandou apenas "oi", "olá", "bom dia", etc. sem dados):
Diga exatamente:
"Seja bem-vindo a TOLDOSPRINT (Toldos e Comunicação Visual)! 🤝✨

Qual seu nome e de qual cidade, bairro está falando?"

Passo 2 (Apresentação dos Serviços):
Assim que o cliente informar o nome e a cidade/bairro (chame a ferramenta salvar_dados_cliente):
Agradeça pelo nome e apresente os serviços mais procurados exatamente no formato abaixo:
"Prazer, [Nome do Cliente]!

${SERVICOS_TEXTO}

Como posso te ajudar?"

Passo 3 (Solicitação de Orçamento e Transferência):
Quando o cliente disser o que precisa ou solicitar um orçamento de qualquer produto/serviço:
Diga com simpatia:
"Perfeito! Para facilitar e agilizar o seu orçamento:
📸 Tire uma foto do que se trata ou deseja;
📏 Tenha em mãos medidas ou projetos (se tiver).

Já estou transferindo o seu atendimento para nossa equipe. Em breve vamos entrar em contato com você por aqui! ⏳🧑‍💼"

Em seguida, chame IMEDIATAMENTE a ferramenta transferir_atendimento com o resumo do pedido (nome, cidade/bairro e o que ele deseja).

OUTRAS CONSULTAS RÁPIDAS (Sem transferir):
- Se o cliente perguntar o status de um orçamento que ele já fez ("cadê meu orçamento", "já ficou pronto?"), chame consultar_status_orcamento.
- Se pedir o PDF do orçamento ("manda o orçamento", "quero o pdf"), chame enviar_pdf_orcamento.

REGRAS GERAIS:
- Horário de atendimento da empresa: Segunda a Sexta, das 07:30 às 17:00 (5 horas). Sábados, domingos e fora desse horário a empresa está fechada; avise gentilmente o horário de funcionamento e que a equipe responderá logo no início do expediente.
- Não fique repetindo saudações desnecessárias.
- Seja direto, claro e educado.
- Se o cliente já mandar tudo na primeira mensagem (ex: "Sou João de Colatina e quero toldo cortina"), já salve os dados, apresente a orientação de fotos/medidas e transfira de uma vez.`

  const tools = {
    salvar_dados_cliente: tool({
      description: "Salva o nome e a cidade/bairro informados pelo cliente no começo da conversa.",
      inputSchema: z.object({ nome: z.string(), local: z.string().optional() }),
      execute: async ({ nome, local }) => {
        nomeTemp = nome
        if (local) localTemp = local
        return { ok: true }
      },
    }),
    consultar_status_orcamento: tool({
      description: "Consulta os orçamentos mais recentes desse cliente, pelo telefone de quem está mandando a mensagem.",
      inputSchema: z.object({}),
      execute: async () => {
        const cliente = await buscarClientePorTelefone(telefone)
        if (!cliente) return { orcamentos: [], mensagem: "Não encontrei nenhum cadastro com esse telefone." }
        const sql = getSql()
        const rows = await sql`
          SELECT numero, status, status_producao, total_fechado, criado_em, validade_dias
          FROM orcamentos WHERE cliente_id = ${cliente.id} ORDER BY numero DESC LIMIT 5
        `
        if (rows.length === 0) return { orcamentos: [], mensagem: "Não encontrei orçamento nenhum pra esse cliente." }
        return {
          orcamentos: rows.map((o) => ({
            numero: o.numero,
            status: o.status === "aberto" ? "ainda não fechado" : o.status === "fechado" ? "fechado" : "cancelado",
            etapaProducao: o.status_producao
              ? STATUS_PRODUCAO_LEGIVEL[o.status_producao as StatusPedidoRapido]
              : undefined,
            valor: o.total_fechado ? formatarMoeda(Number(o.total_fechado)) : undefined,
            feitoEm: formatarData(o.criado_em as string),
          })),
        }
      },
    }),
    enviar_pdf_orcamento: tool({
      description: "Gera e manda pro cliente, no próprio WhatsApp, o PDF do orçamento fechado mais recente dele.",
      inputSchema: z.object({}),
      execute: async () => {
        const cliente = await buscarClientePorTelefone(telefone)
        if (!cliente) return { erro: "Não encontrei nenhum cadastro com esse telefone." }
        const sql = getSql()
        const rows = await sql`
          SELECT * FROM orcamentos WHERE cliente_id = ${cliente.id} AND status = 'fechado'
          ORDER BY numero DESC LIMIT 1
        `
        if (rows.length === 0) return { erro: "Esse cliente não tem orçamento fechado ainda." }
        const r = rows[0]
        const orcamento = {
          id: r.id,
          numero: r.numero,
          clienteId: r.cliente_id,
          item: r.item,
          materialFechado: r.material_fechado,
          totalFechado: r.total_fechado ? Number(r.total_fechado) : undefined,
          ajusteManual: Number(r.ajuste_manual ?? 0),
          anexoNome: r.anexo_nome,
          status: r.status,
          criadoEm: r.criado_em,
          fechadoEm: r.fechado_em,
          validadeDias: r.validade_dias ?? undefined,
        } as Orcamento
        const pdf = await gerarPdfOrcamentoServidor(orcamento, cliente.nome)
        await enviarDocumentoWhatsapp(
          telefone,
          pdf.toString("base64"),
          `Orcamento-${formatarNumeroOrcamento(orcamento.numero, orcamento.criadoEm)}.pdf`,
          `Segue o orçamento nº ${orcamento.numero} da Toldos Print 🙂`
        )
        return { ok: true }
      },
    }),
    transferir_atendimento: tool({
      description: "Avisa o cliente que vai transferir, e passa o atendimento pra um humano — chame só depois de avisar.",
      inputSchema: z.object({ resumo: z.string().describe("Nome, local e o que a pessoa pediu, pro atendente ler rápido") }),
      execute: async ({ resumo }) => {
        transferido = true
        if (process.env.WHATSAPP_NOTIFICAR_TRANSFERENCIA !== "false") {
          const telEmpresa = process.env.WHATSAPP_EMPRESA_NUMERO || "5527997488023"
          if (telEmpresa) {
            const assuntoDetectado = extrairAssuntoInteresse(resumo) || extrairAssuntoInteresse(textoRecebido)
            const resumoAnalise = extrairResumoDemanda({
              historico,
              textoRecebido: resumo || textoRecebido,
              assunto: assuntoDetectado,
              local: localTemp,
            })
            const alerta = formatarAlertaTransferencia({
              nome: (ehNomeValido(nomeTemp) ? nomeTemp : null) || (ehNomeValido(pushName) ? pushName : null),
              ehClienteCadastrado,
              local: localTemp,
              telefone,
              textoRecebido,
              assunto: assuntoDetectado,
              resumoAnalise: resumo || resumoAnalise,
            })
            enviarMensagemWhatsapp(telEmpresa, alerta).catch((err) =>
              console.error("[bot] erro ao notificar empresa de transferência:", err)
            )
          }
        }
        return { ok: true, resumo }
      },
    }),
  }

  // 1. O fluxo determinístico oficial da empresa tem prioridade absoluta:
  // Resposta instantânea (0ms), sem custo, sem falha de rede e 100% no padrão solicitado.
  const reg = resolverFluxoAtendimento(
    textoRecebido,
    historico,
    nomeTemp,
    localTemp,
    pushName,
    ehClienteCadastrado,
    new Date()
  )
  let respostaFinal: string = reg.resposta

  if (reg.nome && !nomeTemp && ehNomeValido(reg.nome)) nomeTemp = reg.nome
  if (reg.local && !localTemp) localTemp = reg.local
  if (reg.transferir) {
    transferido = true
    if (process.env.WHATSAPP_NOTIFICAR_TRANSFERENCIA !== "false") {
      const telEmpresa = process.env.WHATSAPP_EMPRESA_NUMERO || "5527997488023"
      if (telEmpresa) {
        const assuntoDetectado = reg.assunto || extrairAssuntoInteresse(textoRecebido)
        const resumoAnalise = extrairResumoDemanda({
          historico,
          textoRecebido,
          assunto: assuntoDetectado,
          local: localTemp,
        })
        const alerta = formatarAlertaTransferencia({
          nome: (ehNomeValido(nomeTemp) ? nomeTemp : null) || (ehNomeValido(pushName) ? pushName : null),
          ehClienteCadastrado,
          local: localTemp,
          telefone,
          textoRecebido,
          assunto: assuntoDetectado,
          resumoAnalise,
        })
        enviarMensagemWhatsapp(telEmpresa, alerta).catch((e) =>
          console.error("[bot] erro ao notificar empresa:", e)
        )
      }
    }
  }

  // 2. Se não houver resposta de regra predefinida e tivermos modelo de IA, tenta com timeout de segurança
  if (!respostaFinal) {
    const chaveOpenAIValida =
      process.env.OPENAI_API_KEY &&
      process.env.OPENAI_API_KEY.startsWith("sk-") &&
      !process.env.OPENAI_API_KEY.includes("SENSITIVE")
    const chaveGeminiValida =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes("SENSITIVE"))

    const modelo = chaveOpenAIValida
      ? openai("gpt-4o")
      : chaveGeminiValida
      ? google("gemini-2.0-flash")
      : null

    if (modelo) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 6000)
        const { text } = await generateText({
          model: modelo,
          system: systemPrompt,
          messages: [
            ...historico.map((h) => ({ role: h.role, content: h.content }) as const),
            { role: "user" as const, content: textoRecebido },
          ],
          tools,
          abortSignal: controller.signal,
        })
        clearTimeout(timeout)
        if (text && text.trim().length > 0) {
          respostaFinal = text.trim()
        }
      } catch (err: any) {
        console.warn("[bot-whatsapp] Falha na chamada da IA:", err?.message)
      }
    }
  }

  if (!respostaFinal) {
    respostaFinal = nomeTemp
      ? `Olá, ${nomeTemp}! Como podemos te ajudar hoje?`
      : "Olá! Seja muito bem-vindo(a) à Toldos Print. 🤝✨\n\nPor gentileza, com quem temos o prazer de falar e de qual cidade/bairro você é?"
  }

  const novoHistorico = [
    ...historico,
    { role: "user" as const, content: textoRecebido },
    { role: "assistant" as const, content: respostaFinal },
  ]

  await atualizarConversa(conversa.id, {
    nomeTemp: ehNomeValido(nomeTemp) ? nomeTemp : null,
    localTemp,
    historico: novoHistorico,
  })
  if (transferido) await transferirAtendimento(conversa.id)

  return respostaFinal
}
