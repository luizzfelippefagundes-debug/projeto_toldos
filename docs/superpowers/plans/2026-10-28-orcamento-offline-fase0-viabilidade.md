# Orçamento offline — Fase 0: teste de viabilidade

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Descobrir, com o mínimo de código, se o app instalado abre `/orcamentos/novo` em modo avião, já logado (Clerk), antes de construir a cópia local, a fila e as telas.

**Architecture:** Um service worker mínimo (`public/sw.js`) guarda os arquivos estáticos do app e as páginas já visitadas; navegação sem rede cai na cópia guardada. Ele é registrado só em produção, dentro da área logada. A Fase 0 **não** guarda dados de API: listas de clientes/materiais ficam vazias offline (isso é a Fase 1). O que se mede é só: a tela abre? o Clerk derruba para o login?

**Tech Stack:** Next.js 16 (App Router), Service Worker nativo do navegador, Clerk, Playwright (via ferramentas `mcp__plugin_playwright_playwright__*`).

**Spec:** `docs/superpowers/specs/2026-10-28-orcamento-offline-pwa-design.md`

**Critério de sucesso (os 3 cenários abaixo, em modo offline):**
1. Recarregar `/orcamentos/novo` mostra o título "Novo Orçamento" e a URL continua `/orcamentos/novo`.
2. Abrir `/orcamentos/novo` direto (navegação nova) faz o mesmo.
3. Estando em `/dashboard` offline, tocar no link "Novo Orçamento" do menu abre `/orcamentos/novo` (a navegação interna falha e o Next cai em navegação completa, atendida pelo service worker).
Em nenhum deles a URL pode virar `/sign-in`.

**Ponto de decisão:** se algum cenário falhar por causa do Clerk, **não** improvise correções grandes: documente exatamente o que aconteceu (URL final, erros do console, o que ficou na tela) e pare para o dono decidir.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `public/sw.js` | criar | service worker: estáticos cache-first, navegações rede-primeiro com cópia de reserva |
| `components/registrar-service-worker.tsx` | criar | registra o service worker em produção |
| `app/(app)/layout.tsx` | modificar | monta o registrador na área logada |
| `next.config.ts` | modificar | cabeçalhos do `/sw.js` (sem cache) |

---

### Task 1: Service worker, registro e cabeçalhos

**Files:**
- Create: `public/sw.js`
- Create: `components/registrar-service-worker.tsx`
- Modify: `app/(app)/layout.tsx`
- Modify: `next.config.ts`

- [ ] **Step 1: Criar o service worker**

Crie `public/sw.js`:

```js
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
```

- [ ] **Step 2: Criar o registrador**

Crie `components/registrar-service-worker.tsx`:

```tsx
"use client"

import { useEffect } from "react"

// Registra o service worker só em produção (em desenvolvimento ele atrapalha
// o recarregamento automático) e só na área logada.
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sem service worker o app segue funcionando online, só não abre offline.
    })
  }, [])

  return null
}
```

- [ ] **Step 3: Montar na área logada**

Em `app/(app)/layout.tsx`, acrescente o import ao lado dos outros:

```ts
import { RegistrarServiceWorker } from "@/components/registrar-service-worker"
```

e, dentro do `PapelAtivoProvider`, logo depois de `<InstalarApp className="bottom-20 md:bottom-4" />`, acrescente:

```tsx
        <RegistrarServiceWorker />
```

- [ ] **Step 4: Cabeçalhos do `/sw.js`**

Substitua o conteúdo de `next.config.ts` por:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  async headers() {
    return [
      {
        // O service worker nunca pode ficar em cache, senão o app não atualiza.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 5: Verificar compilação**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sem erros de tipo; todos os testes PASS (nada deste passo é coberto por teste, mas nada pode quebrar).

- [ ] **Step 6: Commit (local, numa branch própria)**

Antes de começar a tarefa, crie a branch: `git checkout -b feat/offline-fase0`.

```bash
git add public/sw.js components/registrar-service-worker.tsx "app/(app)/layout.tsx" next.config.ts
git commit -m "Offline fase 0: service worker mínimo para o app abrir sem internet"
```

---

### Task 2: Build de produção e conferência online

O service worker só vale em produção. Roda-se o build local numa porta própria (3003), sem tocar nas portas 3000 e 3001 (que não são deste teste).

**Files:** nenhum (só execução e observação).

- [ ] **Step 1: Build e servidor**

Run: `npx next build 2>&1 | tail -8`
Expected: build conclui sem erro.

Run (em segundo plano): `npx next start -p 3003`
Expected: servidor responde em `http://localhost:3003` (`curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/sign-in` → `200`).

- [ ] **Step 2: Carregar as páginas com internet**

Com as ferramentas do Playwright (carregue-as com ToolSearch se estiverem diferidas: `browser_navigate`, `browser_evaluate`, `browser_run_code_unsafe`, `browser_take_screenshot`, `browser_resize`, `browser_wait_for`, `browser_click`, `browser_console_messages`), use viewport 390x844 (`browser_resize`). O navegador do Playwright costuma estar logado (cookies de `localhost` valem para todas as portas). Se aparecer a tela de login, **pare e peça ao dono para logar na janela**; nunca tente adivinhar credenciais.

1. Navegue para `http://localhost:3003/dashboard` e espere carregar.
2. Navegue para `http://localhost:3003/orcamentos/novo` e espere o título "Novo Orçamento".
3. Recarregue uma vez (para o service worker assumir a página).

- [ ] **Step 3: Conferir registro e cópia guardada**

Rode com `browser_evaluate`:

```js
async () => {
  const reg = await navigator.serviceWorker.getRegistration()
  const nomes = await caches.keys()
  const chaves = nomes.length ? (await (await caches.open(nomes[0])).keys()).map((r) => new URL(r.url).pathname) : []
  return {
    registrado: Boolean(reg),
    estado: reg?.active?.state,
    controlando: Boolean(navigator.serviceWorker.controller),
    caches: nomes,
    paginasGuardadas: chaves.filter((p) => !p.startsWith("/_next/")),
    qtdEstaticos: chaves.filter((p) => p.startsWith("/_next/static/")).length,
  }
}
```

Expected: `registrado: true`, `estado: "activated"`, `controlando: true`, `caches: ["toldosprint-v1"]`, `paginasGuardadas` incluindo `/dashboard` e `/orcamentos/novo`, `qtdEstaticos` maior que 0. Se `controlando` for `false`, recarregue a página e rode de novo.

---

### Task 3: Os três cenários offline

**Files:** nenhum (só execução e observação). Registre o resultado de cada cenário.

Para ligar/desligar a rede, use `browser_run_code_unsafe`:

```js
async (page) => { await page.context().setOffline(true) }   // liga o modo avião
async (page) => { await page.context().setOffline(false) }  // desliga
```

- [ ] **Step 1: Cenário 1 — recarregar offline**

Com a página `/orcamentos/novo` aberta: ligue o modo avião, recarregue (`browser_navigate` para a mesma URL), espere 5 s, rode `browser_evaluate` com `() => ({ url: location.pathname, titulo: document.querySelector("h1")?.innerText, texto: document.body.innerText.slice(0, 300) })`, tire screenshot e leia as mensagens do console (`browser_console_messages`).
Expected (sucesso): `url` = `/orcamentos/novo`, `titulo` contém "Novo Orçamento".

- [ ] **Step 2: Cenário 2 — abrir direto offline**

Ainda offline, abra uma aba nova em `about:blank` e navegue para `http://localhost:3003/orcamentos/novo`; repita a mesma leitura.
Expected (sucesso): igual ao cenário 1.

- [ ] **Step 3: Cenário 3 — navegação interna offline**

Desligue o modo avião, navegue para `http://localhost:3003/dashboard`, espere carregar, ligue o modo avião, e toque no link "Novo Orçamento" do menu (no celular fica no menu "Menu" da barra inferior; se o link não estiver visível, abra o menu). Espere 5 s e repita a leitura.
Expected (sucesso): `url` = `/orcamentos/novo` e `titulo` contém "Novo Orçamento".

- [ ] **Step 4: Anotar tudo**

Para cada cenário registre: sucesso ou falha; URL final; texto visível; erros do console (em especial qualquer um do Clerk ou de `clerk` no domínio); e se o Clerk redirecionou para `/sign-in`. Se houver falha, rode também (ainda offline) `browser_evaluate` com `() => document.documentElement.outerHTML.length` e anexe um screenshot, para o relatório.

---

### Task 4: Decisão e limpeza

- [ ] **Step 1: Encerrar o que subiu**

Derrube **somente** o servidor da porta 3003: `kill $(ss -ltnp | grep ':3003' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)`. Desligue o modo avião do navegador (`setOffline(false)`). Apague `.playwright-mcp/` ao terminar (são prints e logs do teste, não vão para o git).

- [ ] **Step 2: Relatório para o dono (curto)**

Entregue uma tabela com os 3 cenários (sucesso/falha) e a conclusão:
- **Os 3 passaram:** a Fase 0 está aprovada; a branch `feat/offline-fase0` fica como base da Fase 1 (não dê push).
- **Algum falhou:** descreva o motivo exato (Clerk? página não guardada? navegação interna?) e as opções que enxerga, **sem implementar nenhuma** antes do dono decidir.

Importante para o relatório: a Fase 0 não prova que o app abre no **iPhone**; isso só se confirma com um teste no aparelho real depois de um deploy de prévia. Diga isso.
