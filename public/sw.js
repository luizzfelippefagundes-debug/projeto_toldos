// Service worker do Toldos Print (Fase 0 do modo offline).
// Guarda os arquivos estáticos do app e as páginas já visitadas, para o app
// abrir sem internet. NÃO guarda respostas de /api (dados vêm na Fase 1).
const CACHE = "toldosprint-v1"

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys()
      await Promise.all(
        nomes.filter((nome) => nome !== CACHE).map((nome) => caches.delete(nome))
      )
      await self.clients.claim()
    })()
  )
})

async function estaticoPrimeiro(request) {
  const cache = await caches.open(CACHE)
  const guardado = await cache.match(request)
  if (guardado) return guardado
  const resposta = await fetch(request)
  if (resposta.ok) cache.put(request, resposta.clone())
  return resposta
}

async function redePrimeiro(request) {
  const cache = await caches.open(CACHE)
  try {
    const resposta = await fetch(request)
    // Redirecionamento (ex.: / -> /dashboard, ou ida pro login) não é guardado.
    if (resposta.ok && !resposta.redirected) cache.put(request, resposta.clone())
    return resposta
  } catch (erro) {
    const guardado = await cache.match(request)
    if (guardado) return guardado
    throw erro
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  // Só o próprio site: Clerk, fontes externas etc. seguem direto pela rede.
  if (url.origin !== self.location.origin) return
  // Dados, login e painel da TV nunca passam pelo cache.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/sign-in") ||
    url.pathname.startsWith("/sign-up") ||
    url.pathname.startsWith("/tv")
  ) {
    return
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|svg|ico|webp|jpg|jpeg|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(estaticoPrimeiro(request))
    return
  }

  // Só navegações de página (o Next refaz a navegação completa quando a
  // chamada interna falha sem rede, e esta é atendida aqui).
  if (request.mode === "navigate") {
    event.respondWith(redePrimeiro(request))
  }
})
