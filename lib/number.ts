export function isFiniteNumberInput(value: string): boolean {
  return value.trim() !== "" && Number.isFinite(Number(value))
}

export function isPositiveNumberInput(value: string): boolean {
  return isFiniteNumberInput(value) && Number(value) > 0
}

export function isNonNegativeNumberInput(value: string): boolean {
  return isFiniteNumberInput(value) && Number(value) >= 0
}
