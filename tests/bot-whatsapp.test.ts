import { describe, expect, it } from "vitest"
import { formatarTelefoneBrasil, normalizarTelefone, SERVICOS_TEXTO, resolverFluxoAtendimento } from "@/lib/bot-whatsapp"

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

describe("resolverFluxoAtendimento (Motor de Regras Infalível do Robô)", () => {
  it("responde saudação inicial com boas-vindas e pergunta nome e cidade", () => {
    const res = resolverFluxoAtendimento("oi", [])
    expect(res.resposta).toContain("Seja bem-vindo a TOLDOSPRINT")
    expect(res.resposta).toContain("Qual seu nome e de qual cidade, bairro está falando?")
    expect(res.transferir).toBeFalsy()
  })

  it("ao receber nome e cidade, apresenta os serviços mais utilizados e pergunta como ajudar", () => {
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

    expect(res.resposta).toContain("Tire uma foto do que se trata ou deseja")
    expect(res.resposta).toContain("Tenha em mãos medidas ou projetos")
    expect(res.resposta).toContain("transferindo")
    expect(res.transferir).toBe(true)
  })
})
