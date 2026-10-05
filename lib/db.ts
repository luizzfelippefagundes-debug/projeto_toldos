import { neon, type NeonQueryFunction } from "@neondatabase/serverless"

let _sql: NeonQueryFunction<false, false> | null = null

// Inicialização lazy para que o build não falhe sem DATABASE_URL.
// O erro só ocorre em runtime, quando a rota é chamada.
export function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL não configurada")
    }
    _sql = neon(process.env.DATABASE_URL)
  }
  return _sql
}
