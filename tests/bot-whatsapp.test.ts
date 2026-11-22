import { describe, expect, it } from "vitest"
import {
  formatarTelefoneBrasil,
  normalizarTelefone,
  SERVICOS_TEXTO,
  resolverFluxoAtendimento,
  ehNomeValido,
  extrairLocalizacao,
  extrairAssuntoInteresse,
  formatarAlertaTransferencia,
} from "@/lib/bot-whatsapp"
import { verificarHorarioAtendimento } from "@/lib/bot-horario"

describe("normalizarTelefone", () => {
  it("tira tudo que não é dígito", () => {
    expect(normalizarTelefone("(27) 99750-1517")).toBe("27997501517")
  })

  it("mantém o DDI quando já vem com ele", () => {
    expect(normalizarTelefone("+55 27 99750-1517")).toBe("5527997501517")
  })

  it("string só com dígitos permanece igual", () => {
    expect(normalizarTelefone("27997501517")).toBe("27997501517")
  })
})

describe("formatarTelefoneBrasil", () => {
  it("formata celular com DDD e DDI 55", () => {
    expect(formatarTelefoneBrasil("5511999998888")).toBe("(11) 99999-8888")
    expect(formatarTelefoneBrasil("5527997501517")).toBe("(27) 99750-1517")
  })

  it("formata celular sem DDI", () => {
    expect(formatarTelefoneBrasil("11999998888")).toBe("(11) 99999-8888")
  })

  it("formata telefone fixo", () => {
    expect(formatarTelefoneBrasil("552733221100")).toBe("(27) 3322-1100")
  })
})

describe("SERVICOS_TEXTO do Robô de Atendimento", () => {
  it("contém todos os serviços de Comunicação Visual solicitados", () => {
    expect(SERVICOS_TEXTO).toContain("COMUNICAÇÃO VISUAL:")
    expect(SERVICOS_TEXTO).toContain("adesivos comum")
    expect(SERVICOS_TEXTO).toContain("adesivos em recorte")
    expect(SERVICOS_TEXTO).toContain("banners")
    expect(SERVICOS_TEXTO).toContain("placas de identificação")
    expect(SERVICOS_TEXTO).toContain("placas de ACM 3D")
    expect(SERVICOS_TEXTO).toContain("fachadas de ACM")
    expect(SERVICOS_TEXTO).toContain("lonas")
    expect(SERVICOS_TEXTO).toContain("reformas de fachada")
    expect(SERVICOS_TEXTO).toContain("reformas de vitrines")
    expect(SERVICOS_TEXTO).toContain("rótulos")
    expect(SERVICOS_TEXTO).toContain("adesivos para carro")
    expect(SERVICOS_TEXTO).toContain("adesivo para moto")
    expect(SERVICOS_TEXTO).toContain("adesivo de parede")
    expect(SERVICOS_TEXTO).toContain("letras 3D")
    expect(SERVICOS_TEXTO).toContain("outdoor")
  })

  it("contém todos os serviços de Toldos e Coberturas solicitados", () => {
    expect(SERVICOS_TEXTO).toContain("TOLDOS E COBERTURAS:")
    expect(SERVICOS_TEXTO).toContain("toldos para janelas")
    expect(SERVICOS_TEXTO).toContain("toldos para varandas ou área de serviço")
    expect(SERVICOS_TEXTO).toContain("toldos fixo")
    expect(SERVICOS_TEXTO).toContain("toldo cortina (de enrolar)")
    expect(SERVICOS_TEXTO).toContain("toldos de policarbonato")
    expect(SERVICOS_TEXTO).toContain("coberturas de policarbonato")
    expect(SERVICOS_TEXTO).toContain("reformas de toldo")
  })
})

describe("extrairLocalizacao", () => {
  it("extrai cidades quando explicitamente fornecidas com prefixo ou 'sou de'", () => {
    expect(extrairLocalizacao("Sou o Lucas de Colatina Centro")).toBe("Colatina Centro")
    expect(extrairLocalizacao("moro em Linhares")).toBe("Linhares")
    expect(extrairLocalizacao("falando de Vitória")).toBe("Vitória")
  })

  it("nunca extrai palavras comuns como 'alteraç', 'frente', 'projeto', etc.", () => {
    expect(extrairLocalizacao("Semana que vem iremos finalizar a sua frente")).toBeUndefined()
    expect(extrairLocalizacao("preciso de alteração")).toBeUndefined()
    expect(extrairLocalizacao("gostaria de saber o valor")).toBeUndefined()
  })
})

describe("extrairAssuntoInteresse", () => {
  it("detecta produtos e serviços corretamente", () => {
    expect(extrairAssuntoInteresse("Outdoor")).toBe("Outdoor / Painel Externo")
    expect(extrairAssuntoInteresse("Quero orçamento de toldo cortina")).toBe("Toldo Cortina (de enrolar)")
    expect(extrairAssuntoInteresse("Quanto fica uma fachada de acm?")).toBe("Fachada Comercial / ACM")
  })

  it("retorna null para mensagens comuns que não são nomes de produtos", () => {
    expect(extrairAssuntoInteresse("Semana que vem iremos finalizar a sua frente")).toBeNull()
    expect(extrairAssuntoInteresse("fechou, vamos marcar")).toBeNull()
  })
})

describe("formatarAlertaTransferencia", () => {
  it("formata alerta profissional sem 'Local: alteraç' e sem 'Interesse: frase aleatoria'", () => {
    const alerta = formatarAlertaTransferencia({
      nome: "Gustavo Carleto",
      ehClienteCadastrado: true,
      local: undefined,
      telefone: "5527999210759",
      textoRecebido: "Semana que vem iremos finalizar a sua frente",
      assunto: null,
    })

    expect(alerta).toContain("👤 *Cliente:* Gustavo Carleto (Cliente Cadastrado)")
    expect(alerta).toContain("📱 *WhatsApp:* (27) 99921-0759")
    expect(alerta).toContain('💬 *Mensagem do cliente:* "Semana que vem iremos finalizar a sua frente"')
    expect(alerta).not.toContain("alteraç")
    expect(alerta).not.toContain("Interesse:")
  })

  it("inclui Assunto quando um produto/serviço específico foi detectado", () => {
    const alerta = formatarAlertaTransferencia({
      nome: "Poliany",
      ehClienteCadastrado: false,
      local: "Colatina",
      telefone: "5527997501517",
      textoRecebido: "Outdoor",
      assunto: "Outdoor / Painel Externo",
    })

    expect(alerta).toContain("👤 *Cliente:* Poliany")
    expect(alerta).toContain("📍 *Local:* Colatina")
    expect(alerta).toContain("🎯 *Assunto:* Outdoor / Painel Externo")
    expect(alerta).toContain('💬 *Mensagem do cliente:* "Outdoor"')
  })
})

describe("resolverFluxoAtendimento (Motor de Regras Infalível do Robô)", () => {
  it("responde novo contato com boas-vindas profissionais e pergunta nome e cidade", () => {
    const res = resolverFluxoAtendimento("oi", [])
    expect(res.resposta).toContain("Toldos Print")
    expect(res.resposta).toContain("com quem temos o prazer de falar")
    expect(res.transferir).toBeFalsy()
  })

  it("para contato já conhecido (salvo no sistema ou com nome identificado), NÃO pergunta nome nem cidade ao dar bom dia", () => {
    const res = resolverFluxoAtendimento("Bom dia!", [], "Gustavo Carleto", null, "Gustavo Carleto", true)
    expect(res.resposta).toContain("Olá, Gustavo Carleto!")
    expect(res.resposta).toContain("Como podemos te ajudar hoje?")
    expect(res.resposta).not.toContain("com quem temos o prazer de falar")
    expect(res.resposta).not.toContain("Qual seu nome")
    expect(res.transferir).toBeFalsy()
  })

  it("para contato já conhecido que envia mensagem em andamento (ex: Gustavo), confirma recebimento e transfere sem perguntar nome", () => {
    const res = resolverFluxoAtendimento(
      "Semana que vem iremos finalizar a sua frente",
      [],
      "Gustavo Carleto",
      null,
      "Gustavo Carleto",
      true
    )
    expect(res.resposta).toContain("Olá, Gustavo Carleto!")
    expect(res.resposta).toContain("Mensagem recebida")
    expect(res.resposta).toContain("Já encaminhei diretamente para o Kaio")
    expect(res.resposta).not.toContain("com quem temos o prazer de falar")
    expect(res.resposta).not.toContain("Qual seu nome")
    expect(res.transferir).toBe(true)
  })

  it("cliente cadastrado com nome inválido (ex.: '.') não recebe pergunta de nome nem cidade", () => {
    const res = resolverFluxoAtendimento("opa, to finalizando a correção", [], ".", null, ".", true)
    expect(res.resposta).not.toMatch(/com quem temos o prazer|cidade\/bairro/i)
    expect(res.resposta).toMatch(/^Olá! Mensagem recebida/)
    expect(res.transferir).toBe(true)
  })

  it("cliente cadastrado sem nome que só manda 'oi' é cumprimentado sem pedir dados", () => {
    const res = resolverFluxoAtendimento("oi", [], null, null, null, true)
    expect(res.resposta).not.toMatch(/com quem temos o prazer|cidade\/bairro/i)
    expect(res.resposta).toMatch(/Como podemos te ajudar/)
  })

  it("ao receber nome e cidade de contato novo, apresenta os serviços mais utilizados e pergunta como ajudar", () => {
    const res = resolverFluxoAtendimento("Sou o Lucas de Colatina Centro", [{ role: "assistant", content: "Qual seu nome?" }])
    expect(res.resposta).toContain("SERVIÇOS mais utilizados:")
    expect(res.resposta).toContain("COMUNICAÇÃO VISUAL:")
    expect(res.resposta).toContain("TOLDOS E COBERTURAS:")
    expect(res.resposta).toContain("Como posso te ajudar?")
    expect(res.transferir).toBeFalsy()
  })

  it("ao solicitar orçamento, orienta a tirar foto, ter medidas e transfere", () => {
    const res = resolverFluxoAtendimento("Quero orçamento de toldo cortina", [
      { role: "assistant", content: "Como posso te ajudar?" },
    ], "Lucas", "Colatina")

    expect(res.resposta).toContain("Tire uma foto")
    expect(res.resposta).toContain("medidas")
    expect(res.resposta).toContain("transferindo")
    expect(res.transferir).toBe(true)
  })

  it("não aceita fragmentos ou palavras comuns como 'qu', 'qual', 'fechou' como nome", () => {
    expect(ehNomeValido("qu")).toBe(false)
    expect(ehNomeValido("qual")).toBe(false)
    expect(ehNomeValido("fechou")).toBe(false)
    expect(ehNomeValido("oi")).toBe(false)
    expect(ehNomeValido("Lucas")).toBe(true)
    expect(ehNomeValido("João Carlos")).toBe(true)

    const res = resolverFluxoAtendimento("qu", [{ role: "assistant", content: "Qual seu nome e de qual cidade?" }])
    expect(res.nome).toBeUndefined()
  })

  it("ao responder 'Outdoor' após o menu de serviços, entende o pedido e transfere sem reenviar menu", () => {
    const historico = [
      { role: "user" as const, content: "oi" },
      { role: "assistant" as const, content: "Olá! Seja muito bem-vindo à Toldos Print!" },
      { role: "assistant" as const, content: `Prazer, Poliany!\n\n${SERVICOS_TEXTO}\n\nComo posso te ajudar?` },
    ]

    const res = resolverFluxoAtendimento("Outdoor", historico, "Poliany", null, "Poliany")
    expect(res.resposta).toContain("Perfeito, Poliany!")
    expect(res.resposta).toContain("Tire uma foto")
    expect(res.resposta).not.toContain("SERVIÇOS mais utilizados")
    expect(res.transferir).toBe(true)
  })

  it("reconhece 'outdoor' imediatamente como pedido de orçamento", () => {
    const res = resolverFluxoAtendimento("Vocês fazem outdoor?", [], "Poliany", "Colatina")
    expect(res.transferir).toBe(true)
    expect(res.resposta).toContain("transferindo")
  })
})

describe("Horário de Funcionamento e Atendimento nos Fins de Semana", () => {
  it("detecta sábado e domingo como fechado (fim de semana)", () => {
    // Sábado 21/11/2026 às 15:00 BRT (18:00 UTC)
    const sabado = new Date("2026-11-21T18:00:00Z")
    const stSab = verificarHorarioAtendimento(sabado)
    expect(stSab.ehFimDeSemana).toBe(true)
    expect(stSab.estaAberto).toBe(false)
    expect(stSab.proximaAberturaDescricao).toContain("segunda-feira")

    // Domingo 22/11/2026 às 10:00 BRT (13:00 UTC)
    const domingo = new Date("2026-11-22T13:00:00Z")
    const stDom = verificarHorarioAtendimento(domingo)
    expect(stDom.ehFimDeSemana).toBe(true)
    expect(stDom.estaAberto).toBe(false)
    expect(stDom.proximaAberturaDescricao).toContain("segunda-feira")
  })

  it("detecta dias úteis dentro do horário comercial (07:30 às 17:00) como aberto", () => {
    // Quarta-feira às 10:00 BRT (13:00 UTC)
    const quartaAberto = new Date("2026-11-25T13:00:00Z")
    const stQuarta = verificarHorarioAtendimento(quartaAberto)
    expect(stQuarta.ehFimDeSemana).toBe(false)
    expect(stQuarta.estaAberto).toBe(true)

    // Segunda-feira às 07:35 BRT (10:35 UTC)
    const segundaInicio = new Date("2026-11-23T10:35:00Z")
    expect(verificarHorarioAtendimento(segundaInicio).estaAberto).toBe(true)
  })

  it("detecta dias úteis fora do horário (antes das 07:30 ou após as 17:00) como fechado", () => {
    // Quarta-feira às 07:15 BRT (10:15 UTC) - antes de abrir
    const quartaCedo = new Date("2026-11-25T10:15:00Z")
    const stCedo = verificarHorarioAtendimento(quartaCedo)
    expect(stCedo.estaAberto).toBe(false)
    expect(stCedo.proximaAberturaDescricao).toContain("hoje a partir das 07:30")

    // Quarta-feira às 18:30 BRT (21:30 UTC) - após fechar
    const quartaNoite = new Date("2026-11-25T21:30:00Z")
    const stNoite = verificarHorarioAtendimento(quartaNoite)
    expect(stNoite.estaAberto).toBe(false)
    expect(stNoite.proximaAberturaDescricao).toContain("amanhã a partir das 07:30")
  })

  it("no fim de semana o robô avisa que está fechado, informa os horários (07:30 às 17:00) e que responderá na segunda", () => {
    const sabado = new Date("2026-11-21T18:00:00Z") // Sábado à tarde
    const res = resolverFluxoAtendimento(
      "Olá, gostaria de saber o valor de um toldo",
      [],
      "Carlos",
      "Colatina",
      null,
      false,
      sabado
    )

    expect(res.resposta).toContain("fechados para o fim de semana")
    expect(res.resposta).toContain("07:30 às 17:00")
    expect(res.resposta).toContain("segunda-feira")
    expect(res.resposta).toContain("fotos")
    expect(res.resposta).toContain("medidas")
    expect(res.transferir).toBe(true)
  })

  it("em dia de semana à noite avisa que encerrou o expediente e responderá no dia seguinte", () => {
    const quartaNoite = new Date("2026-11-25T22:00:00Z") // Quarta às 19h BRT
    const res = resolverFluxoAtendimento(
      "Boa noite!",
      [],
      "Mariana",
      null,
      null,
      false,
      quartaNoite
    )

    expect(res.resposta).toContain("encerrou o expediente por hoje")
    expect(res.resposta).toContain("07:30 às 17:00")
    expect(res.resposta).toContain("amanhã")
    expect(res.transferir).toBe(true)
  })

  it("anti-flood: se o robô já avisou que está fechado, mensagens subsequentes não reenviam o aviso repetido", () => {
    const sabado = new Date("2026-11-21T18:00:00Z")
    const historicoComAviso = [
      { role: "user" as const, content: "oi" },
      {
        role: "assistant" as const,
        content: "Olá! Seja muito bem-vindo à Toldos Print. Nosso horário de funcionamento é: De segunda a sexta-feira, das 07:30 às 17:00.",
      },
    ]

    const res = resolverFluxoAtendimento(
      "Seguem as fotos do local",
      historicoComAviso,
      "Carlos",
      null,
      null,
      false,
      sabado
    )

    expect(res.resposta).toContain("Anotado")
    expect(res.resposta).toContain("Já deixei tudo salvo")
    expect(res.resposta).not.toContain("Nosso horário de funcionamento é:")
    expect(res.transferir).toBe(true)
  })
})
