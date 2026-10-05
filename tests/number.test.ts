import { describe, expect, it } from "vitest"
import {
  isFiniteNumberInput,
  isNonNegativeNumberInput,
  isPositiveNumberInput,
} from "@/lib/number"

describe("validação de campos numéricos", () => {
  it("rejeita valores vazios, inválidos e infinitos", () => {
    for (const value of ["", " ", "texto", "Infinity", "-Infinity"]) {
      expect(isFiniteNumberInput(value)).toBe(false)
    }
  })

  it("distingue números positivos de valores não negativos", () => {
    expect(isPositiveNumberInput("0")).toBe(false)
    expect(isNonNegativeNumberInput("0")).toBe(true)
    expect(isPositiveNumberInput("12.5")).toBe(true)
    expect(isNonNegativeNumberInput("-1")).toBe(false)
  })
})
