import { timingSafeEqual } from "node:crypto"

// Segredo compartilhado com o site da loja (LOJA_API_SECRET). Só o servidor do
// site conhece; o navegador nunca fala direto com estas rotas.
export function segredoDaLojaValido(req: Request) {
  const esperado = process.env.LOJA_API_SECRET
  const recebido = req.headers.get("x-loja-secret")
  if (!esperado || !recebido) return false
  const a = Buffer.from(recebido)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}
