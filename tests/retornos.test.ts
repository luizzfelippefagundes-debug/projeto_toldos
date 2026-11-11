import { describe, expect, it } from "vitest"
import {
  identificarIntencaoMensagem,
  linkWhatsApp,
  retornoDoOrcamento,
  situacaoContato,
  somarDias,
} from "@/lib/retornos"
import type { Orcamento } from "@/lib/types"

const orcamento = {
  id: "o1",
  numero: 1001,
  clienteId: "c1",
  item: {} as Orcamento["item"],
  ajusteManual: 0,
  anexoNome: null,
  status: "fechado",
  criadoEm: "2026-10-20T15:00:00.000Z",
  fechadoEm: "2026-10-20T15:00:00.000Z",
} as Orcamento

describe("retornos", () => {
  it("sugere o primeiro contato 2 dias depois de emitido", () => {
    expect(retornoDoOrcamento(orcamento)).toMatchObject({
      etapa: "aguardando",
      proximoContato: "2026-10-22",
    })
  })

  it("classifica o contato em atrasado, hoje ou futuro", () => {
    const hoje = new Date(2026, 9, 22)
    const base = { etapa: "aguardando" as const, atualizadoEm: "" }
    expect(situacaoContato({ ...base, proximoContato: "2026-10-21" }, hoje)).toBe("atrasado")
    expect(situacaoContato({ ...base, proximoContato: "2026-10-22" }, hoje)).toBe("hoje")
    expect(situacaoContato({ ...base, proximoContato: "2026-10-23" }, hoje)).toBe("futuro")
  })

  it("não lembra de orçamento aprovado ou perdido", () => {
    const hoje = new Date(2026, 9, 22)
    expect(
      situacaoContato({ etapa: "aprovado", proximoContato: "2026-10-01", atualizadoEm: "" }, hoje)
    ).toBeNull()
  })

  it("soma dias a partir da data marcada ou de hoje", () => {
    const hoje = new Date(2026, 9, 30)
    expect(somarDias(undefined, 3, hoje)).toBe("2026-11-02")
    expect(somarDias("2026-10-22", 7, hoje)).toBe("2026-10-29")
  })

  it("monta o link do WhatsApp com DDI", () => {
    expect(linkWhatsApp("(27) 99748-9714", "oi")).toBe("https://wa.me/5527997489714?text=oi")
    expect(linkWhatsApp("123", "oi")).toBeNull()
  })

  describe("identificarIntencaoMensagem", () => {
    it("identifica aprovação em diversas variações de mensagens", () => {
      expect(identificarIntencaoMensagem("Aprovado")).toBe("aprovado")
      expect(identificarIntencaoMensagem("Tá aprovado, pode fazer!")).toBe("aprovado")
      expect(identificarIntencaoMensagem("Pode produzir")).toBe("aprovado")
      expect(identificarIntencaoMensagem("Pode mandar rodar")).toBe("aprovado")
      expect(identificarIntencaoMensagem("fechado!")).toBe("aprovado")
      expect(identificarIntencaoMensagem("vamos fechar")).toBe("aprovado")
      expect(identificarIntencaoMensagem("Sim")).toBe("aprovado")
      expect(identificarIntencaoMensagem("OK")).toBe("aprovado")
      expect(identificarIntencaoMensagem("sim, pode fazer")).toBe("aprovado")
      expect(identificarIntencaoMensagem("Confirmado!")).toBe("aprovado")
    })

    it("identifica negociação e dúvidas de preço/prazo", () => {
      expect(identificarIntencaoMensagem("Consegue algum desconto no valor?")).toBe("negociacao")
      expect(identificarIntencaoMensagem("Tem como parcelar em mais vezes?")).toBe("negociacao")
      expect(identificarIntencaoMensagem("Qual o prazo de entrega?")).toBe("negociacao")
      expect(identificarIntencaoMensagem("Tem frete para entregar?")).toBe("negociacao")
      expect(identificarIntencaoMensagem("Consigo alterar o tamanho?")).toBe("negociacao")
    })

    it("identifica recusa e desistência do cliente", () => {
      expect(identificarIntencaoMensagem("Não vou querer mais, obrigado")).toBe("perdido")
      expect(identificarIntencaoMensagem("Ficou muito caro pra mim")).toBe("perdido")
      expect(identificarIntencaoMensagem("Já fechei com outro fornecedor")).toBe("perdido")
      expect(identificarIntencaoMensagem("Desisti do projeto")).toBe("perdido")
      expect(identificarIntencaoMensagem("Não aprovei")).toBe("perdido")
    })

    it("retorna null para mensagens genéricas que não movem o kanban", () => {
      expect(identificarIntencaoMensagem("Bom dia")).toBeNull()
      expect(identificarIntencaoMensagem("Tudo bem?")).toBeNull()
      expect(identificarIntencaoMensagem("Onde fica a loja de vocês?")).toBeNull()
      expect(identificarIntencaoMensagem("")).toBeNull()
    })
  })
})
