import { describe, expect, it, vi, beforeEach } from "vitest"
import { notificarConclusaoPecaAoKaio } from "@/lib/notificacoes-producao"
import * as evolutionApi from "@/lib/evolution-api"
import * as botRegistro from "@/lib/bot-registro"
import { POST } from "@/app/api/producao/notificar-conclusao/route"

describe("Notificação de Conclusão de Peça ao Kaio (Antes & Depois)", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(botRegistro, "registrarMensagemBot").mockResolvedValue(undefined as any)
  })

  it("envia imagem do antes (arte aprovada) e do depois (peça pronta) para o Kaio via WhatsApp", async () => {
    const spyImagem = vi.spyOn(evolutionApi, "enviarImagemWhatsapp").mockResolvedValue({ ok: true })
    const spyMsg = vi.spyOn(evolutionApi, "enviarMensagemWhatsapp").mockResolvedValue({ ok: true })

    const resultado = await notificarConclusaoPecaAoKaio({
      origemTipo: "orcamento",
      origemId: "orc-10051",
      numero: 10051,
      clienteNome: "Associação Pestalozzi",
      produtoNome: "Placa ACM 3x1m",
      fotoAntesUrl: "https://exemplo.com/arte-aprovada.jpg",
      fotoDepoisUrl: "https://exemplo.com/peca-pronta.jpg",
      colaboradores: [
        { nome: "josue batista alves", pecas: 2 },
        { nome: "Alessandro Da Cruz Lima", pecas: 2 },
      ],
    })

    expect(resultado.ok).toBe(true)
    expect(resultado.antesEnviado).toBe(true)
    expect(resultado.depoisEnviado).toBe(true)
    expect(spyImagem).toHaveBeenCalledTimes(2)

    // Primeiro envio deve ser o ANTES (Arte Aprovada)
    expect(spyImagem.mock.calls[0][1]).toBe("https://exemplo.com/arte-aprovada.jpg")
    expect(spyImagem.mock.calls[0][2]).toContain("[ANTES — ARTE APROVADA / LAYOUT]")
    expect(spyImagem.mock.calls[0][2]).toContain("#10051")
    expect(spyImagem.mock.calls[0][2]).toContain("Associação Pestalozzi")

    // Segundo envio deve ser o DEPOIS (Peça Pronta)
    expect(spyImagem.mock.calls[1][1]).toBe("https://exemplo.com/peca-pronta.jpg")
    expect(spyImagem.mock.calls[1][2]).toContain("[DEPOIS — PEÇA PRONTA CONCLUÍDA!]")
    expect(spyImagem.mock.calls[1][2]).toContain("josue batista alves (2 peças)")
    expect(spyImagem.mock.calls[1][2]).toContain("Alessandro Da Cruz Lima (2 peças)")

    // Não deve chamar mensagem pura de texto se a foto depois foi enviada
    expect(spyMsg).not.toHaveBeenCalled()
  })

  it("envia apenas DEPOIS caso a demanda não possua arte prévia aprovada", async () => {
    const spyImagem = vi.spyOn(evolutionApi, "enviarImagemWhatsapp").mockResolvedValue({ ok: true })

    const resultado = await notificarConclusaoPecaAoKaio({
      origemTipo: "pedido",
      origemId: "ped-5001",
      numero: 5001,
      clienteNome: "João da Silva",
      produtoNome: "Cartão de Visita",
      fotoAntesUrl: null,
      fotoDepoisUrl: "https://exemplo.com/cartao-pronto.jpg",
      colaboradores: [{ nome: "josue batista alves", pecas: 1 }],
    })

    expect(resultado.ok).toBe(true)
    expect(resultado.antesEnviado).toBe(false)
    expect(resultado.depoisEnviado).toBe(true)
    expect(spyImagem).toHaveBeenCalledTimes(1)
    expect(spyImagem.mock.calls[0][2]).toContain("[DEPOIS — PEÇA PRONTA CONCLUÍDA!]")
  })

  it("rota /api/producao/notificar-conclusao valida parâmetros e responde sucesso", async () => {
    vi.spyOn(evolutionApi, "enviarImagemWhatsapp").mockResolvedValue({ ok: true })

    const reqValida = new Request("http://localhost/api/producao/notificar-conclusao", {
      method: "POST",
      body: JSON.stringify({
        origemTipo: "orcamento",
        origemId: "orc-123",
        numero: 10099,
        clienteNome: "Cliente Teste",
        produtoNome: "Banner Ilhós",
        fotoAntesUrl: "https://exemplo.com/arte.jpg",
        fotoDepoisUrl: "https://exemplo.com/pronto.jpg",
        colaboradores: [{ nome: "Josué", pecas: 1 }],
      }),
    })

    const res = await POST(reqValida)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.resultado.depoisEnviado).toBe(true)

    const reqInvalida = new Request("http://localhost/api/producao/notificar-conclusao", {
      method: "POST",
      body: JSON.stringify({
        origemTipo: "orcamento",
        // falta numero e clienteNome
      }),
    })

    const resInvalida = await POST(reqInvalida)
    expect(resInvalida.status).toBe(400)
  })
})
