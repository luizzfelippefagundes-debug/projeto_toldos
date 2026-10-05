import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import { lerArmazenamento, salvarArmazenamento } from "@/lib/storage"

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

describe("persistência no navegador", () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it("salva e carrega os dados do navegador", () => {
    salvarArmazenamento("teste", [{ id: "1" }])

    expect(lerArmazenamento("teste", [])).toEqual([{ id: "1" }])
  })

  it("usa o padrão e notifica quando os dados salvos são inválidos", () => {
    window.localStorage.setItem("teste", "{ inválido")
    const erroConsole = vi.spyOn(console, "error").mockImplementation(() => {})

    expect(lerArmazenamento("teste", [{ id: "padrão" }])).toEqual([
      { id: "padrão" },
    ])
    expect(erroConsole).toHaveBeenCalledOnce()
    expect(toast.error).toHaveBeenCalledOnce()

    erroConsole.mockRestore()
  })
})
