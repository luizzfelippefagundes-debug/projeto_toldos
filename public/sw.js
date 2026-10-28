// Service worker do Toldos Print (modo offline).
// Guarda os arquivos estáticos do app e uma tela offline própria (/offline),
// pública e sem login. Quando uma página não abre por falta de internet, o
// aparelho mostra essa tela. NÃO guarda respostas de /api (dados vêm depois).
//
// Importante: não dá pra depender de guardar páginas do sistema (/dashboard
// etc.): elas exigem login e o login às vezes responde com redirecionamento,
// que não é guardado. Por isso o plano B é sempre a tela /offline.
const CACHE = "toldosprint-v2"
const TELA_OFFLINE = "/offline"

// Guarda a tela offline e os arquivos que ela precisa para abrir sem rede.
async function guardarTelaOffline() {
  const cache = await caches.open(CACHE)
  const resposta = await fetch(TELA_OFFLINE, { cache: "reload" })
  if (!resposta.ok || resposta.redirected) {
    throw new Error("tela offline indisponível")
  }
  const html = await resposta.clone().text()
  await cache.put(TELA_OFFLINE, resposta)
  const arquivos = new Set()
  for (const achado of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) {
    arquivos.add(achado[1])
  }
  await Promise.all(
    [...arquivos].map(async (arquivo) => {
      try {
        const r = await fetch(arquivo)
        if (r.ok) await cache.put(arquivo, r)
      } catch {
        // Um arquivo que falhar não impede o resto de ser guardado.
      }
    })
  )
}

self.addEventListener("install", (event) => {
  // Se a tela offline não puder ser guardada agora, a instalação falha e o
  // navegador tenta de novo na próxima visita.
  event.waitUntil(guardarTelaOffline().then(() => self.skipWaiting()))
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
    const telaOffline = await cache.match(TELA_OFFLINE)
    if (telaOffline) return telaOffline
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
