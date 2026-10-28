# Orçamento com vários itens — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que um orçamento tenha vários itens diferentes (cada um com material, serviço, medidas, quantidade e acabamentos), com instalação, deslocamento, margem, desconto, imposto, entrada e validade valendo uma vez para o orçamento todo.

**Architecture:** O item que existe hoje vira o "item principal" e ganha `itensAdicionais?: ItemAdicional[]` (guardado no mesmo JSON `orcamentos.item`, sem mudar o banco). O cálculo soma os adicionais ao custo base antes de margem/desconto/imposto. Funções puras novas em `lib/orcamento-itens.ts` cuidam de estoque e cálculo de orçamentos salvos; o `data-context` e as telas só as chamam. Orçamentos sem adicionais seguem exatamente o caminho antigo.

**Tech Stack:** Next.js 16 (App Router), React, TypeScript, Vitest + Testing Library. Spec: `docs/superpowers/specs/2026-10-28-orcamento-multiplos-itens-design.md`.

**Refinamento em relação ao spec:** os acabamentos de cada item adicional ficam **dentro do cartão do próprio item** (etapa 2), e não na etapa 3. A etapa 3 continua cuidando só do item principal. Motivo: o cartão fica autocontido e no celular o vendedor não precisa ir e voltar entre etapas.

**Regra de ouro:** nenhum teste existente pode mudar de resultado. Rode `npx vitest run` ao fim de cada tarefa.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `lib/types.ts` | modificar | `ItemProduto`, `ItemAdicional`, `OrcamentoItem.itensAdicionais` |
| `lib/calculo.ts` | modificar | somar itens adicionais; `ResultadoItem`; parâmetro `catalogo` |
| `lib/orcamento-itens.ts` | criar | `itensDoOrcamento`, `planejarBaixas`, `devolucoesDoOrcamento`, `deltasDeEstoque`, `itemComBaixas`, `calcularOrcamentoSalvo` |
| `lib/item-adicional-form.ts` | criar | formulário (strings) ↔ item (números) + validação de um item adicional |
| `lib/orcamento-pdf.ts` | modificar | linhas do PDF por item |
| `context/data-context.tsx` | modificar | estoque de todos os itens em fechar/editar/reabrir/excluir |
| `components/orcamento/item-adicional-card.tsx` | criar | cartão de edição de um item adicional |
| `components/orcamentos/itens-adicionais-lista.tsx` | criar | lista só leitura dos adicionais (OS e detalhes) |
| `app/(app)/orcamentos/novo/page.tsx` | modificar | lista de itens, validação, resumo, carga de edição/rascunho |
| `app/(app)/orcamentos/[id]/orcamento/page.tsx`, `[id]/os/page.tsx`, `components/orcamentos/orcamento-detalhes.tsx` | modificar | mostrar todos os itens |
| `app/(app)/orcamentos/page.tsx`, `clientes/page.tsx`, `clientes/[id]/page.tsx` | modificar | total correto de orçamento aberto com adicionais |
| `app/(app)/relatorios/page.tsx` | modificar | uso de material somando os adicionais |
| `tests/calculo.test.ts`, `tests/orcamento-itens.test.ts`, `tests/item-adicional-form.test.ts`, `tests/orcamento-pdf.test.ts`, `tests/data-context.test.tsx` | modificar/criar | testes |

---

### Task 1: Tipos e cálculo com itens adicionais

**Files:**
- Modify: `lib/types.ts:80-99`
- Modify: `lib/calculo.ts`
- Test: `tests/calculo.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Acrescente ao final de `tests/calculo.test.ts` (dentro do arquivo, depois do último `describe`; os imports `calcularOrcamentoCompleto`, `Material`, `Servico`, `OrcamentoItem` e as constantes `materialM2`, `servicoFixo`, `itemBasico` já existem no topo):

```ts
describe("orçamento com itens adicionais", () => {
  const catalogo = { materiais: [materialM2], servicos: [servicoFixo] }

  it("sem adicionais o resultado é o mesmo de antes e tem um item", () => {
    const r = calcularOrcamentoCompleto(itemBasico, materialM2, servicoFixo, 0, [], [], catalogo)
    expect(r.subtotalMaterial).toBe(168)
    expect(r.subtotalMaoDeObra).toBe(250)
    expect(r.total).toBe(418)
    expect(r.itens).toHaveLength(1)
    expect(r.itens[0]).toMatchObject({ subtotalMaterial: 168, subtotalMaoDeObra: 250 })
  })

  it("soma material, mão de obra e área dos adicionais ao total", () => {
    const item: OrcamentoItem = {
      ...itemBasico,
      itensAdicionais: [
        {
          id: "ad-1",
          materialId: materialM2.id,
          servicoId: "nenhum",
          largura: 1,
          altura: 1,
          quantidadeUnidades: 2,
          horasEstimadas: 0,
        },
      ],
    }
    const r = calcularOrcamentoCompleto(item, materialM2, servicoFixo, 0, [], [], catalogo)
    // principal: 3x2 = 6 m² x 28 = 168 + 250; adicional: 1x1x2 = 2 m² x 28 = 56
    expect(r.areaM2).toBe(8)
    expect(r.subtotalMaterial).toBe(224)
    expect(r.subtotalMaoDeObra).toBe(250)
    expect(r.total).toBe(474)
    expect(r.itens).toHaveLength(2)
    expect(r.itens[1]).toMatchObject({ materialId: materialM2.id, subtotalMaterial: 56, subtotalMaoDeObra: 0 })
  })

  it("aplica margem, desconto e imposto uma vez sobre o custo de todos os itens", () => {
    const item: OrcamentoItem = {
      ...itemBasico,
      margemPercent: 10,
      descontoPercent: 10,
      impostoPercent: 6,
      itensAdicionais: [
        {
          id: "ad-1",
          materialId: materialM2.id,
          servicoId: "nenhum",
          largura: 1,
          altura: 1,
          quantidadeUnidades: 2,
          horasEstimadas: 0,
        },
      ],
    }
    const r = calcularOrcamentoCompleto(item, materialM2, servicoFixo, 0, [], [], catalogo)
    // custo 474 -> com margem 521,4 -> com desconto 469,26 -> imposto 28,1556
    expect(r.custoBase).toBeCloseTo(474)
    expect(r.comDesconto).toBeCloseTo(469.26)
    expect(r.total).toBeCloseTo(497.4156)
  })

  it("soma os acabamentos dos adicionais", () => {
    const item: OrcamentoItem = {
      ...itemBasico,
      itensAdicionais: [
        {
          id: "ad-1",
          materialId: materialM2.id,
          servicoId: "nenhum",
          largura: 1,
          altura: 1,
          quantidadeUnidades: 1,
          horasEstimadas: 0,
          acabamentos: [{ acabamentoId: "acb-1", quantidade: 4 }],
        },
      ],
    }
    const acabamentos = [{ id: "acb-1", nome: "Ilhós", precoUnitario: 2, unidade: "un" }]
    const r = calcularOrcamentoCompleto(item, materialM2, servicoFixo, 0, acabamentos, [], catalogo)
    expect(r.subtotalAcabamentos).toBe(8)
    expect(r.itens[1].subtotalAcabamentos).toBe(8)
  })

  it("adicional com material removido conta zero e mantém o alinhamento da lista", () => {
    const item: OrcamentoItem = {
      ...itemBasico,
      itensAdicionais: [
        { id: "ad-1", materialId: "sumiu", servicoId: "nenhum", largura: 1, altura: 1, quantidadeUnidades: 1, horasEstimadas: 0 },
        { id: "ad-2", materialId: materialM2.id, servicoId: "nenhum", largura: 1, altura: 1, quantidadeUnidades: 1, horasEstimadas: 0 },
      ],
    }
    const r = calcularOrcamentoCompleto(item, materialM2, servicoFixo, 0, [], [], catalogo)
    expect(r.itens).toHaveLength(3)
    expect(r.itens[1].subtotalMaterial).toBe(0)
    expect(r.itens[2].subtotalMaterial).toBe(28)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/calculo.test.ts`
Expected: FAIL (erro de tipo/`itens` indefinido; `itensAdicionais` não existe em `OrcamentoItem`).

- [ ] **Step 3: Tipos**

Em `lib/types.ts`, substitua o bloco `export interface OrcamentoItem { ... }` (linhas 80-99) por:

```ts
// Campos de produto de um item: material, serviço, medidas, quantidade e
// acabamentos. O item principal do orçamento e cada item adicional têm isso.
export interface ItemProduto {
  materialId: string
  servicoId: string
  largura: number
  altura: number
  quantidadeUnidades: number
  horasEstimadas: number
  acabamentos?: AcabamentoSelecionado[]
}

// Item a mais no mesmo orçamento (ex.: uma janela junto com as portas). Não
// repete instalação, desconto etc.: esses valem pro orçamento todo e ficam no
// item principal.
export interface ItemAdicional extends ItemProduto {
  id: string
  // Preenchidos ao fechar (mesma ideia do materialFechado/quantidadeMaterialDebitada
  // do orçamento, que descrevem o item principal).
  materialFechado?: {
    id: string
    nome: string
    unidade: UnidadeMedida
    quantidade: number
    custo: number
  }
  quantidadeMaterialDebitada?: number
}

export interface OrcamentoItem extends ItemProduto {
  itensAdicionais?: ItemAdicional[]
  instalacao?: InstalacaoOrcamento
  deslocamento?: DeslocamentoOrcamento
  margemPercent?: number
  descontoPercent?: number
  impostoPercent?: number
  // Usados só no PDF oficial; ficam dentro do item (JSONB) pra não precisar de coluna nova.
  condicoesPagamento?: string
  fotos?: FotoOrcamento[]
  // % cobrado como entrada ao fechar; o resto é cobrado na entrega. Sem o
  // campo (orçamentos antigos) ou 0/100, é um pagamento único.
  entradaPercent?: number
}
```

- [ ] **Step 4: Cálculo**

Em `lib/calculo.ts`:

(a) No import de tipos, troque `OrcamentoItem,` por `ItemProduto,\n  OrcamentoItem,` (mantenha os demais).

(b) Depois de `export interface ResultadoCalculo { ... }`, acrescente:

```ts
// Parte de um item no resultado: o índice 0 é o item principal e os demais
// seguem a ordem de `itensAdicionais` (sempre alinhados, mesmo com material removido).
export interface ResultadoItem {
  materialId: string
  areaM2: number
  subtotalMaterial: number
  subtotalMaoDeObra: number
  subtotalAcabamentos: number
}

export interface CatalogoOrcamento {
  materiais: Material[]
  servicos: Servico[]
}
```

(c) Em `ResultadoCalculoCompleto`, acrescente o campo `itens: ResultadoItem[]` (logo depois de `subtotalAcabamentos: number`).

(d) Troque os parâmetros `item: OrcamentoItem` por `item: ItemProduto` em `quantidadePecas`, `quantidadeMaterialConsumida` e `calcularOrcamento`.

(e) Substitua toda a função `calcularOrcamentoCompleto` por:

```ts
function subtotalAcabamentosDe(
  item: ItemProduto,
  acabamentosDisponiveis: Acabamento[]
): number {
  return (item.acabamentos ?? []).reduce((soma, sel) => {
    const acabamento = acabamentosDisponiveis.find(
      (a) => a.id === sel.acabamentoId
    )
    return acabamento ? soma + acabamento.precoUnitario * sel.quantidade : soma
  }, 0)
}

/**
 * Versão estendida usada pelo wizard de Novo Orçamento: soma acabamentos,
 * instalação (mão de obra + equipamento de acesso) e deslocamento ao custo
 * base, aplica margem e desconto percentuais, e só então o ajuste manual em
 * R$ (igual a `calcularOrcamento`). Itens antigos sem esses campos opcionais
 * contribuem 0 em cada parte nova, então o resultado bate com
 * `calcularOrcamento` para orçamentos que nunca usaram o wizard novo.
 *
 * Itens adicionais (`item.itensAdicionais`) entram no custo base com o seu
 * material, mão de obra e acabamentos; precisam do `catalogo` pra achar o
 * material e o serviço de cada um. Instalação, deslocamento, margem, desconto
 * e imposto valem uma vez, sobre o total.
 */
export function calcularOrcamentoCompleto(
  item: OrcamentoItem,
  material: Material,
  servico: Servico | null,
  ajusteManual: number,
  acabamentosDisponiveis: Acabamento[],
  equipamentosDisponiveis: EquipamentoAcesso[],
  catalogo?: CatalogoOrcamento
): ResultadoCalculoCompleto {
  const base = calcularOrcamento(item, material, servico, 0)

  const itens: ResultadoItem[] = [
    {
      materialId: item.materialId,
      areaM2: base.areaM2,
      subtotalMaterial: base.subtotalMaterial,
      subtotalMaoDeObra: base.subtotalMaoDeObra,
      subtotalAcabamentos: subtotalAcabamentosDe(item, acabamentosDisponiveis),
    },
  ]
  for (const extra of item.itensAdicionais ?? []) {
    const materialExtra = catalogo?.materiais.find((m) => m.id === extra.materialId)
    if (!materialExtra) {
      itens.push({
        materialId: extra.materialId,
        areaM2: 0,
        subtotalMaterial: 0,
        subtotalMaoDeObra: 0,
        subtotalAcabamentos: 0,
      })
      continue
    }
    const servicoExtra =
      catalogo?.servicos.find((s) => s.id === extra.servicoId) ?? null
    const baseExtra = calcularOrcamento(extra, materialExtra, servicoExtra, 0)
    itens.push({
      materialId: extra.materialId,
      areaM2: baseExtra.areaM2,
      subtotalMaterial: baseExtra.subtotalMaterial,
      subtotalMaoDeObra: baseExtra.subtotalMaoDeObra,
      subtotalAcabamentos: subtotalAcabamentosDe(extra, acabamentosDisponiveis),
    })
  }
  const somar = (campo: keyof Omit<ResultadoItem, "materialId">) =>
    itens.reduce((soma, parte) => soma + parte[campo], 0)
  const areaM2 = somar("areaM2")
  const subtotalMaterial = somar("subtotalMaterial")
  const subtotalMaoDeObra = somar("subtotalMaoDeObra")
  const subtotalAcabamentos = somar("subtotalAcabamentos")

  const instalacao = item.instalacao
  let subtotalInstalacao = 0
  if (instalacao?.incluida) {
    const equipamento = equipamentosDisponiveis.find(
      (e) => e.id === instalacao.equipamentoId
    )
    subtotalInstalacao =
      instalacao.horas * instalacao.custoHora +
      instalacao.numAjudantes * instalacao.diariaAjudante +
      (equipamento?.precoDiaria ?? 0)
  }

  const deslocamento = item.deslocamento
  let subtotalDeslocamento = 0
  if (deslocamento?.incluido) {
    subtotalDeslocamento =
      deslocamento.distanciaKm * deslocamento.custoPorKm +
      deslocamento.pedagio +
      deslocamento.alimentacao
  }

  const custoBase =
    subtotalMaterial +
    subtotalMaoDeObra +
    subtotalAcabamentos +
    subtotalInstalacao +
    subtotalDeslocamento

  const margemPercent = item.margemPercent ?? 0
  const descontoPercent = item.descontoPercent ?? 0
  const impostoPercent = item.impostoPercent ?? 0

  const comMargem = custoBase * (1 + margemPercent / 100)
  const comDesconto = comMargem * (1 - descontoPercent / 100)
  const valorImposto = comDesconto * (impostoPercent / 100)
  const total = comDesconto + valorImposto + ajusteManual

  return {
    areaM2,
    subtotalMaterial,
    subtotalMaoDeObra,
    subtotalAcabamentos,
    itens,
    subtotalInstalacao,
    subtotalDeslocamento,
    custoBase,
    comMargem,
    comDesconto,
    valorImposto,
    total,
  }
}
```

- [ ] **Step 5: Rodar tudo e ver passar**

Run: `npx vitest run tests/calculo.test.ts && npx tsc --noEmit`
Expected: testes de cálculo PASS (os antigos e os 5 novos). O `tsc` deve acusar erro apenas onde `ResultadoCalculoCompleto` é montado à mão. Se acusar em `tests/orcamento-pdf.test.ts` (`{ ...resultado, ... }` não, esse herda `itens`), corrija acrescentando `itens: []`; não deve haver outros.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/calculo.ts tests/calculo.test.ts
git commit -m "Orçamento: tipos e cálculo com itens adicionais"
```

---

### Task 2: Funções puras de estoque e orçamento salvo

**Files:**
- Create: `lib/orcamento-itens.ts`
- Test: `tests/orcamento-itens.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Crie `tests/orcamento-itens.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  calcularOrcamentoSalvo,
  deltasDeEstoque,
  devolucoesDoOrcamento,
  itemComBaixas,
  itensDoOrcamento,
  planejarBaixas,
} from "@/lib/orcamento-itens"
import type { ItemAdicional, Material, Orcamento, OrcamentoItem, Servico } from "@/lib/types"

const lona: Material = {
  id: "lona", nome: "Lona", tipo: "Lona", unidade: "m2",
  precoUnitario: 10, estoqueMinimo: 0, quantidadeEstoque: 10,
}
const acm: Material = {
  id: "acm", nome: "ACM", tipo: "ACM", unidade: "m2",
  precoUnitario: 50, estoqueMinimo: 0, quantidadeEstoque: 100,
}
const fixo: Servico = { id: "srv", nome: "Mão de obra", formaCobranca: "fixo", valor: 100 }

const principal: OrcamentoItem = {
  materialId: "lona", servicoId: "srv", largura: 2, altura: 3,
  quantidadeUnidades: 1, horasEstimadas: 0,
}
function adicional(extra: Partial<ItemAdicional> = {}): ItemAdicional {
  return {
    id: "ad-1", materialId: "lona", servicoId: "nenhum", largura: 2, altura: 3,
    quantidadeUnidades: 1, horasEstimadas: 0, ...extra,
  }
}
function orcamento(item: OrcamentoItem, extra: Partial<Orcamento> = {}): Orcamento {
  return {
    id: "o1", numero: 1001, clienteId: "c", item, ajusteManual: 0,
    anexoNome: null, status: "fechado", criadoEm: "2026-10-28T10:00:00.000Z",
    fechadoEm: "2026-10-28T10:00:00.000Z", ...extra,
  }
}

describe("itensDoOrcamento", () => {
  it("devolve só o principal quando não há adicionais", () => {
    expect(itensDoOrcamento(principal)).toEqual([principal])
  })
  it("devolve o principal e depois os adicionais, na ordem", () => {
    const a = adicional({ id: "a" })
    const b = adicional({ id: "b" })
    const lista = itensDoOrcamento({ ...principal, itensAdicionais: [a, b] })
    expect(lista).toEqual([{ ...principal, itensAdicionais: [a, b] }, a, b])
  })
})

describe("planejarBaixas", () => {
  it("baixa cada item do seu material", () => {
    const baixas = planejarBaixas(
      itensDoOrcamento({ ...principal, itensAdicionais: [adicional({ materialId: "acm" })] }),
      [lona, acm]
    )
    expect(baixas).toEqual([
      { materialId: "lona", solicitada: 6, debitada: 6 },
      { materialId: "acm", solicitada: 6, debitada: 6 },
    ])
  })

  it("divide o estoque quando dois itens usam o mesmo material", () => {
    // lona tem 10 m²: o principal leva 6 e o adicional só consegue 4 dos 6 pedidos
    const baixas = planejarBaixas(
      itensDoOrcamento({ ...principal, itensAdicionais: [adicional()] }),
      [lona]
    )
    expect(baixas.map((b) => b.debitada)).toEqual([6, 4])
    expect(baixas.map((b) => b.solicitada)).toEqual([6, 6])
  })

  it("conta as devoluções como estoque disponível (edição)", () => {
    const baixas = planejarBaixas(
      itensDoOrcamento(principal),
      [{ ...lona, quantidadeEstoque: 2 }],
      new Map([["lona", 6]])
    )
    expect(baixas[0].debitada).toBe(6)
  })

  it("material que não existe mais não baixa nada", () => {
    const baixas = planejarBaixas(itensDoOrcamento(principal), [])
    expect(baixas).toEqual([{ materialId: "lona", solicitada: 0, debitada: 0 }])
  })
})

describe("devolucoesDoOrcamento", () => {
  it("usa o que foi realmente debitado em cada item", () => {
    const o = orcamento(
      { ...principal, itensAdicionais: [adicional({ materialId: "acm", quantidadeMaterialDebitada: 2 })] },
      { quantidadeMaterialDebitada: 5 }
    )
    expect([...devolucoesDoOrcamento(o, [lona, acm])]).toEqual([["lona", 5], ["acm", 2]])
  })

  it("soma quando o mesmo material aparece em dois itens", () => {
    const o = orcamento(
      { ...principal, itensAdicionais: [adicional({ quantidadeMaterialDebitada: 4 })] },
      { quantidadeMaterialDebitada: 6 }
    )
    expect(devolucoesDoOrcamento(o, [lona]).get("lona")).toBe(10)
  })

  it("sem registro de débito, calcula o consumo do item", () => {
    const o = orcamento({ ...principal, itensAdicionais: [adicional({ materialId: "acm" })] })
    expect(devolucoesDoOrcamento(o, [lona, acm]).get("lona")).toBe(6)
    expect(devolucoesDoOrcamento(o, [lona, acm]).get("acm")).toBe(6)
  })
})

describe("deltasDeEstoque", () => {
  it("devolve o que estava baixado e baixa o novo", () => {
    const deltas = deltasDeEstoque(
      [{ materialId: "lona", solicitada: 3, debitada: 3 }],
      new Map([["lona", 6], ["acm", 2]])
    )
    expect(deltas.get("lona")).toBe(3)
    expect(deltas.get("acm")).toBe(2)
  })
})

describe("itemComBaixas", () => {
  it("grava em cada adicional o que foi debitado e o material fechado", () => {
    const item: OrcamentoItem = { ...principal, itensAdicionais: [adicional({ materialId: "acm" })] }
    const baixas = planejarBaixas(itensDoOrcamento(item), [lona, acm])
    const fechado = itemComBaixas(item, baixas, [lona, acm])
    expect(fechado.itensAdicionais?.[0]).toMatchObject({
      quantidadeMaterialDebitada: 6,
      materialFechado: { id: "acm", nome: "ACM", unidade: "m2", quantidade: 6, custo: 300 },
    })
  })

  it("devolve o mesmo item quando não há adicionais", () => {
    expect(itemComBaixas(principal, [], [lona])).toBe(principal)
  })
})

describe("calcularOrcamentoSalvo", () => {
  it("soma os adicionais ao total", () => {
    const o = orcamento({ ...principal, itensAdicionais: [adicional({ materialId: "acm" })] })
    const r = calcularOrcamentoSalvo(o, [lona, acm], [fixo])
    // lona 6 m² x 10 = 60 + 100 de mão de obra; acm 6 m² x 50 = 300
    expect(r?.total).toBe(460)
  })

  it("devolve null quando o material do item principal não existe", () => {
    expect(calcularOrcamentoSalvo(orcamento(principal), [], [fixo])).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/orcamento-itens.test.ts`
Expected: FAIL ("Cannot find module '@/lib/orcamento-itens'").

- [ ] **Step 3: Implementar**

Crie `lib/orcamento-itens.ts`:

```ts
import {
  calcularOrcamentoCompleto,
  quantidadeMaterialConsumida,
  type ResultadoCalculoCompleto,
} from "./calculo"
import { acabamentosSeed, equipamentosAcessoSeed } from "./seed-data"
import type {
  ItemProduto,
  Material,
  Orcamento,
  OrcamentoItem,
  Servico,
} from "./types"

// O item principal e depois os adicionais, sempre nessa ordem.
export function itensDoOrcamento(item: OrcamentoItem): ItemProduto[] {
  return [item, ...(item.itensAdicionais ?? [])]
}

export interface BaixaItem {
  materialId: string
  solicitada: number
  debitada: number
}

/**
 * Quanto do estoque cada item consegue baixar. Itens que usam o mesmo material
 * dividem o saldo, na ordem da lista. `devolucoes` é o que a versão anterior do
 * orçamento já tinha baixado (conta como saldo disponível ao editar).
 */
export function planejarBaixas(
  itens: ItemProduto[],
  materiais: Material[],
  devolucoes: Map<string, number> = new Map()
): BaixaItem[] {
  const disponivel = new Map<string, number>()
  return itens.map((item) => {
    const material = materiais.find((m) => m.id === item.materialId)
    if (!material) return { materialId: item.materialId, solicitada: 0, debitada: 0 }
    const solicitada = quantidadeMaterialConsumida(item, material)
    const atual =
      disponivel.get(material.id) ??
      material.quantidadeEstoque + (devolucoes.get(material.id) ?? 0)
    const debitada = Math.min(atual, solicitada)
    disponivel.set(material.id, atual - debitada)
    return { materialId: material.id, solicitada, debitada }
  })
}

// O que um orçamento fechado tem baixado do estoque, por material.
export function devolucoesDoOrcamento(
  orcamento: Orcamento,
  materiais: Material[]
): Map<string, number> {
  const mapa = new Map<string, number>()
  const registrar = (item: ItemProduto, debitado?: number) => {
    const material = materiais.find((m) => m.id === item.materialId)
    if (!material) return
    const quantidade = debitado ?? quantidadeMaterialConsumida(item, material)
    mapa.set(material.id, (mapa.get(material.id) ?? 0) + quantidade)
  }
  registrar(orcamento.item, orcamento.quantidadeMaterialDebitada)
  for (const extra of orcamento.item.itensAdicionais ?? []) {
    registrar(extra, extra.quantidadeMaterialDebitada)
  }
  return mapa
}

// Variação final do estoque por material: devolve `devolucoes` e baixa `baixas`.
export function deltasDeEstoque(
  baixas: BaixaItem[],
  devolucoes: Map<string, number>
): Map<string, number> {
  const deltas = new Map<string, number>()
  for (const [id, quantidade] of devolucoes) {
    deltas.set(id, (deltas.get(id) ?? 0) + quantidade)
  }
  for (const baixa of baixas) {
    deltas.set(baixa.materialId, (deltas.get(baixa.materialId) ?? 0) - baixa.debitada)
  }
  return deltas
}

// Grava em cada adicional o que foi debitado e o material no momento do
// fechamento. `baixas[0]` é o principal (já guardado no próprio orçamento).
export function itemComBaixas(
  item: OrcamentoItem,
  baixas: BaixaItem[],
  materiais: Material[]
): OrcamentoItem {
  const extras = item.itensAdicionais
  if (!extras?.length) return item
  return {
    ...item,
    itensAdicionais: extras.map((extra, i) => {
      const material = materiais.find((m) => m.id === extra.materialId)
      const baixa = baixas[i + 1]
      if (!material || !baixa) return extra
      return {
        ...extra,
        quantidadeMaterialDebitada: baixa.debitada,
        materialFechado: {
          id: material.id,
          nome: material.nome,
          unidade: material.unidade,
          quantidade: baixa.solicitada,
          custo: baixa.solicitada * material.precoUnitario,
        },
      }
    }),
  }
}

// Cálculo de um orçamento já salvo (telas de histórico, OS, cliente).
export function calcularOrcamentoSalvo(
  orcamento: Orcamento,
  materiais: Material[],
  servicos: Servico[]
): ResultadoCalculoCompleto | null {
  const material = materiais.find((m) => m.id === orcamento.item.materialId)
  if (!material) return null
  const servico = servicos.find((s) => s.id === orcamento.item.servicoId)
  return calcularOrcamentoCompleto(
    orcamento.item,
    material,
    servico ?? null,
    orcamento.ajusteManual,
    acabamentosSeed,
    equipamentosAcessoSeed,
    { materiais, servicos }
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/orcamento-itens.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add lib/orcamento-itens.ts tests/orcamento-itens.test.ts
git commit -m "Orçamento: funções de estoque e cálculo para vários itens"
```

---

### Task 3: Estoque no data-context (fechar, editar, reabrir, excluir)

**Files:**
- Modify: `context/data-context.tsx` (blocos em `fecharOrcamento`, `updateOrcamento`, `reabrirOrcamento`, `removeOrcamento`)
- Test: `tests/data-context.test.tsx`

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/data-context.test.tsx`, acrescente `import { quantidadeMaterialConsumida } from "@/lib/calculo"` se necessário (não é preciso nestes testes). Dentro do `describe("fluxos de dados", ...)`, depois do teste `"estorna só a quantidade realmente debitada..."`, acrescente:

```tsx
  const itemAcm = {
    id: "ad-1",
    materialId: "mat-2",
    servicoId: "nenhum",
    largura: 1,
    altura: 1,
    quantidadeUnidades: 2,
    horasEstimadas: 0,
  }

  it("baixa o estoque de todos os itens ao fechar e devolve ao reabrir", async () => {
    const { result } = await montar()
    const lona = materiaisSeed.find((m) => m.id === "mat-1")!
    const acm = materiaisSeed.find((m) => m.id === "mat-2")!
    let orcamentoId = ""

    act(() => {
      orcamentoId = result.current.fecharOrcamento(
        criarDadosOrcamento({ itensAdicionais: [itemAcm] })
      ).id
    })

    await waitFor(() => {
      const estoque = (id: string) =>
        result.current.materiais.find((m) => m.id === id)?.quantidadeEstoque
      expect(estoque("mat-1")).toBe(lona.quantidadeEstoque - 6)
      expect(estoque("mat-2")).toBe(acm.quantidadeEstoque - 2)
      expect(result.current.orcamentos.find((o) => o.id === orcamentoId)).toMatchObject({
        totalFechado: 608, // 418 do principal + 2 m² x 95 do adicional
        item: { itensAdicionais: [{ quantidadeMaterialDebitada: 2 }] },
      })
    })

    act(() => {
      result.current.reabrirOrcamento(orcamentoId)
    })

    await waitFor(() => {
      const estoque = (id: string) =>
        result.current.materiais.find((m) => m.id === id)?.quantidadeEstoque
      expect(estoque("mat-1")).toBe(lona.quantidadeEstoque)
      expect(estoque("mat-2")).toBe(acm.quantidadeEstoque)
    })
  })

  it("limita a baixa do adicional ao estoque e devolve só o que baixou", async () => {
    const { result } = await montar()
    const acm = materiaisSeed.find((m) => m.id === "mat-2")!
    let orcamentoId = ""

    act(() => {
      orcamentoId = result.current.fecharOrcamento(
        criarDadosOrcamento({
          itensAdicionais: [{ ...itemAcm, largura: 5, altura: 5 }], // pede 50 m², só há 12
        })
      ).id
    })

    await waitFor(() => {
      expect(
        result.current.materiais.find((m) => m.id === "mat-2")?.quantidadeEstoque
      ).toBe(0)
      expect(
        result.current.orcamentos.find((o) => o.id === orcamentoId)?.item.itensAdicionais?.[0]
          .quantidadeMaterialDebitada
      ).toBe(acm.quantidadeEstoque)
    })

    act(() => {
      result.current.reabrirOrcamento(orcamentoId)
    })

    await waitFor(() => {
      expect(
        result.current.materiais.find((m) => m.id === "mat-2")?.quantidadeEstoque
      ).toBe(acm.quantidadeEstoque)
    })
  })

  it("ao editar um orçamento fechado, remover o adicional devolve o material dele", async () => {
    const { result } = await montar()
    const lona = materiaisSeed.find((m) => m.id === "mat-1")!
    const acm = materiaisSeed.find((m) => m.id === "mat-2")!
    let orcamentoId = ""

    act(() => {
      orcamentoId = result.current.fecharOrcamento(
        criarDadosOrcamento({ itensAdicionais: [itemAcm] })
      ).id
    })
    await waitFor(() =>
      expect(result.current.materiais.find((m) => m.id === "mat-2")?.quantidadeEstoque).toBe(
        acm.quantidadeEstoque - 2
      )
    )

    act(() => {
      result.current.updateOrcamento(orcamentoId, criarDadosOrcamento())
    })

    await waitFor(() => {
      const estoque = (id: string) =>
        result.current.materiais.find((m) => m.id === id)?.quantidadeEstoque
      expect(estoque("mat-2")).toBe(acm.quantidadeEstoque)
      expect(estoque("mat-1")).toBe(lona.quantidadeEstoque - 6)
    })
  })

  it("excluir um orçamento fechado devolve o estoque de todos os itens", async () => {
    const { result } = await montar()
    const lona = materiaisSeed.find((m) => m.id === "mat-1")!
    const acm = materiaisSeed.find((m) => m.id === "mat-2")!
    let orcamentoId = ""

    act(() => {
      orcamentoId = result.current.fecharOrcamento(
        criarDadosOrcamento({ itensAdicionais: [itemAcm] })
      ).id
    })
    await waitFor(() =>
      expect(result.current.orcamentos.some((o) => o.id === orcamentoId)).toBe(true)
    )

    act(() => {
      result.current.removeOrcamento(orcamentoId)
    })

    await waitFor(() => {
      const estoque = (id: string) =>
        result.current.materiais.find((m) => m.id === id)?.quantidadeEstoque
      expect(estoque("mat-1")).toBe(lona.quantidadeEstoque)
      expect(estoque("mat-2")).toBe(acm.quantidadeEstoque)
    })
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/data-context.test.tsx -t "itens|adicional|excluir um orçamento fechado"`
Expected: FAIL (estoque do ACM não muda; total sem o adicional).

- [ ] **Step 3: Imports e função de ajuste do estoque**

No topo de `context/data-context.tsx`, acrescente aos imports (junto dos de `@/lib/...`):

```ts
import {
  deltasDeEstoque,
  devolucoesDoOrcamento,
  itemComBaixas,
  itensDoOrcamento,
  planejarBaixas,
} from "@/lib/orcamento-itens"
```

Dentro do `DataProvider`, logo antes de `const fecharOrcamento`, acrescente:

```ts
  // Aplica uma variação de estoque por material (positiva devolve, negativa baixa).
  function ajustarEstoque(deltas: Map<string, number>) {
    if ([...deltas.values()].every((d) => d === 0)) return
    setMateriais((atual) =>
      atual.map((m) => {
        const delta = deltas.get(m.id) ?? 0
        if (delta === 0) return m
        const atualizado = {
          ...m,
          quantidadeEstoque: Math.max(0, m.quantidadeEstoque + delta),
        }
        apiPut(`/api/materiais/${m.id}`, { ...atualizado, id: undefined })
        return atualizado
      })
    )
  }
```

- [ ] **Step 4: `fecharOrcamento`**

(a) Troque o início (de `const quantidadeConsumidaSolicitada = ...` até o fim do `const resultado = material ? calcularOrcamentoCompleto(...) : null`) por:

```ts
    const baixas = planejarBaixas(itensDoOrcamento(dados.item), materiais)
    const itemFechado = itemComBaixas(dados.item, baixas, materiais)
    const quantidadeConsumidaSolicitada = baixas[0].solicitada
    const quantidadeMaterialDebitada = material ? baixas[0].debitada : undefined
    const resultado = material
      ? calcularOrcamentoCompleto(
          dados.item,
          material,
          servico ?? null,
          dados.ajusteManual,
          acabamentosSeed,
          equipamentosAcessoSeed,
          { materiais, servicos }
        )
      : null
```

(b) No objeto `novo`, troque `item: dados.item,` por `item: itemFechado,`.

(c) Troque o bloco inteiro `if (material) { setMateriais((atual) => atual.map((m) => { if (m.id !== material.id) return m ... })) }` (o que baixa `quantidadeConsumidaSolicitada`) por:

```ts
    ajustarEstoque(deltasDeEstoque(baixas, new Map()))
```

- [ ] **Step 5: `updateOrcamento` (ramo do orçamento fechado)**

(a) Troque o trecho de `const materialAntigo = ...` até o fim do bloco `setMateriais((atual) => atual.map((m) => { const delta = ... }))` e o `const resultado = ...` seguinte por:

```ts
    // Estoque: devolve o que a versão antiga baixou e baixa o da nova. Aberto
    // não tem baixa (o Reabrir já devolveu), mesmo que o campo tenha ficado.
    const devolucoes = estavaAberto
      ? new Map<string, number>()
      : devolucoesDoOrcamento(orcamento, materiais)
    const baixas = planejarBaixas(itensDoOrcamento(dados.item), materiais, devolucoes)
    const itemFechado = itemComBaixas(dados.item, baixas, materiais)
    const material = materiais.find((m) => m.id === dados.item.materialId)
    const servico = servicos.find((s) => s.id === dados.item.servicoId)
    const cliente = clientes.find((c) => c.id === dados.clienteId)
    const consumo = baixas[0].solicitada

    ajustarEstoque(deltasDeEstoque(baixas, devolucoes))

    const resultado = material
      ? calcularOrcamentoCompleto(
          dados.item,
          material,
          servico ?? null,
          dados.ajusteManual,
          acabamentosSeed,
          equipamentosAcessoSeed,
          { materiais, servicos }
        )
      : null
```

(b) No objeto `atualizado`, troque `quantidadeMaterialDebitada: material ? Math.min(estoqueDisponivel, consumo) : undefined,` por `quantidadeMaterialDebitada: material ? baixas[0].debitada : undefined,` e acrescente `item: itemFechado,` logo depois de `status: "fechado",`. (`consumo` continua usado em `materialFechado.quantidade`/`custo`.)

- [ ] **Step 6: `reabrirOrcamento` e `removeOrcamento`**

Em `reabrirOrcamento`, troque o bloco `const material = materiais.find(...)`/`if (material) { const consumido = ...; setMateriais(...) }` (dentro de `if (orcamento.status === "fechado")`, depois da checagem de lançamentos pagos) por:

```ts
      ajustarEstoque(devolucoesDoOrcamento(orcamento, materiais))
```

Em `removeOrcamento`, dentro de `if (orcamento.status === "fechado") {`, troque o bloco `const material = ...`/`if (material) {...}` (antes de `const relacionados = ...`) por:

```ts
      ajustarEstoque(devolucoesDoOrcamento(orcamento, materiais))
```

- [ ] **Step 7: Rodar a suíte inteira**

Run: `npx vitest run && npx tsc --noEmit`
Expected: tudo PASS, inclusive os testes antigos de estoque (devolução parcial, reabrir, editar). Se um teste antigo falhar, **pare e corrija a regressão**: o comportamento sem adicionais tem de ser idêntico.

- [ ] **Step 8: Commit**

```bash
git add context/data-context.tsx tests/data-context.test.tsx
git commit -m "Orçamento: estoque de todos os itens ao fechar, editar, reabrir e excluir"
```

---

### Task 4: Linhas do PDF por item

**Files:**
- Modify: `lib/orcamento-pdf.ts`
- Test: `tests/orcamento-pdf.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

No `describe("gerarLinhasOrcamento", ...)` de `tests/orcamento-pdf.test.ts`, acrescente (os imports `calcularOrcamentoCompleto`, `gerarLinhasOrcamento`, `material`, `acabamentos`, `item` já existem):

```ts
  it("gera uma linha de produto por item adicional e a soma bate com o total", () => {
    const comExtra: OrcamentoItem = {
      ...item,
      itensAdicionais: [
        {
          id: "ad-1",
          materialId: "m",
          servicoId: "nenhum",
          largura: 1,
          altura: 1,
          quantidadeUnidades: 2,
          horasEstimadas: 0,
          acabamentos: [{ acabamentoId: "a1", quantidade: 4 }],
        },
      ],
    }
    const r = calcularOrcamentoCompleto(comExtra, material, null, 0, acabamentos, [], {
      materiais: [material],
      servicos: [],
    })
    const linhas = gerarLinhasOrcamento({
      item: comExtra,
      nomeMaterial: "LONA",
      unidadeMaterial: "m2",
      acabamentosDisponiveis: acabamentos,
      resultado: r,
      total: r.total,
      adicionais: [{ item: comExtra.itensAdicionais![0], nomeMaterial: "LONA", unidadeMaterial: "m2" }],
    })
    expect(linhas.map((l) => l.nome)).toEqual([
      "LONA 2,00 x 1,00 m", // principal
      "Ilhós", // acabamentos do principal
      "LONA 1,00 x 1,00 m", // adicional
      "Ilhós", // acabamentos do adicional
    ])
    expect(linhas[2].quantidade).toBe(2)
    expect(linhas[3].quantidade).toBe(4)
    const soma = linhas.reduce((s, l) => s + l.valorTotal, 0)
    expect(Math.round(soma * 100)).toBe(Math.round(r.total * 100))
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/orcamento-pdf.test.ts`
Expected: FAIL (`adicionais` não existe em `gerarLinhasOrcamento`).

- [ ] **Step 3: Implementar**

Em `lib/orcamento-pdf.ts`:

(a) Troque o import de tipos por `import type { Acabamento, ItemProduto, OrcamentoItem, UnidadeMedida } from "./types"`.

(b) Antes de `gerarLinhasOrcamento`, acrescente:

```ts
export interface ItemAdicionalPdf {
  item: ItemProduto
  nomeMaterial: string
  unidadeMaterial: UnidadeMedida
}

type LinhaBruta = Omit<LinhaOrcamento, "valorUnitario">

function linhaDoProduto(
  item: ItemProduto,
  nomeMaterial: string,
  unidadeMaterial: UnidadeMedida,
  valorTotal: number
): LinhaBruta {
  const pecas = quantidadePecas(item)
  const nome =
    unidadeMaterial === "m2" && item.largura > 0 && item.altura > 0
      ? `${nomeMaterial} ${medida(item.largura)} x ${medida(item.altura)} m`
      : nomeMaterial
  return {
    nome,
    quantidade: unidadeMaterial === "m2" ? pecas : item.quantidadeUnidades || 1,
    unidade: "un",
    valorTotal,
  }
}

function linhasDosAcabamentos(
  item: ItemProduto,
  acabamentosDisponiveis: Acabamento[]
): LinhaBruta[] {
  const linhas: LinhaBruta[] = []
  for (const sel of item.acabamentos ?? []) {
    const acabamento = acabamentosDisponiveis.find((a) => a.id === sel.acabamentoId)
    if (!acabamento || sel.quantidade <= 0) continue
    linhas.push({
      nome: acabamento.nome,
      quantidade: sel.quantidade,
      unidade: acabamento.unidade,
      valorTotal: acabamento.precoUnitario * sel.quantidade,
    })
  }
  return linhas
}
```

(c) Em `gerarLinhasOrcamento`, acrescente `adicionais` aos parâmetros (`adicionais?: ItemAdicionalPdf[]` no destructuring e no tipo) e substitua o trecho que vai de `const pecas = quantidadePecas(item)` até o fim do `for (const sel of item.acabamentos ?? []) { ... }` por:

```ts
  // O resultado soma todos os itens; o principal é o total menos os adicionais.
  const partesAdicionais = resultado.itens.slice(1)
  const valorAdicionais = partesAdicionais.reduce(
    (s, p) => s + p.subtotalMaterial + p.subtotalMaoDeObra,
    0
  )
  const brutas: LinhaBruta[] = [
    linhaDoProduto(
      item,
      nomeMaterial,
      unidadeMaterial,
      resultado.subtotalMaterial + resultado.subtotalMaoDeObra - valorAdicionais
    ),
    ...linhasDosAcabamentos(item, acabamentosDisponiveis),
  ]
  ;(adicionais ?? []).forEach((adicional, i) => {
    const parte = partesAdicionais[i]
    brutas.push(
      linhaDoProduto(
        adicional.item,
        adicional.nomeMaterial,
        adicional.unidadeMaterial,
        parte ? parte.subtotalMaterial + parte.subtotalMaoDeObra : 0
      ),
      ...linhasDosAcabamentos(adicional.item, acabamentosDisponiveis)
    )
  })
```

Mantenha o restante da função (instalação, deslocamento, diluição, arredondamento) como está. O tipo `brutas` antigo (`Omit<LinhaOrcamento, "valorUnitario">[]`) some, pois agora é `LinhaBruta[]`.

- [ ] **Step 4: Rodar tudo**

Run: `npx vitest run tests/orcamento-pdf.test.ts && npx tsc --noEmit`
Expected: PASS (os 2 antigos + o novo). O teste antigo `"usa uma linha só..."` monta `vazio = { ...resultado, subtotalMaterial: 0, ... }`, que mantém `itens` com 1 posição, então `partesAdicionais` fica vazio e passa.

- [ ] **Step 5: Commit**

```bash
git add lib/orcamento-pdf.ts tests/orcamento-pdf.test.ts
git commit -m "Orçamento: linhas do PDF por item"
```

---

### Task 5: Formulário de item adicional (lógica pura)

**Files:**
- Create: `lib/item-adicional-form.ts`
- Test: `tests/item-adicional-form.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Crie `tests/item-adicional-form.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  formParaItem,
  formVazio,
  itemParaForm,
  pendenciasItem,
} from "@/lib/item-adicional-form"
import type { Material, Servico } from "@/lib/types"

const lona: Material = {
  id: "lona", nome: "Lona", tipo: "Lona", unidade: "m2",
  precoUnitario: 10, estoqueMinimo: 0, quantidadeEstoque: 10,
}
const parafuso: Material = { ...lona, id: "parafuso", nome: "Parafuso", unidade: "unidade" }
const porM2: Servico = { id: "s-m2", nome: "Instalação", formaCobranca: "m2", valor: 5 }
const porHora: Servico = { id: "s-h", nome: "Montagem", formaCobranca: "hora", valor: 30 }

describe("item adicional (formulário)", () => {
  it("começa vazio, com quantidade 1 e sem serviço", () => {
    const f = formVazio("ad-1")
    expect(f).toMatchObject({ id: "ad-1", materialId: "", servicoId: "nenhum", quantidadeUnidades: "1" })
  })

  it("converte formulário em item (textos viram números, só acabamentos marcados com quantidade)", () => {
    const f = {
      ...formVazio("ad-1"),
      materialId: "lona",
      largura: "2,5".replace(",", "."),
      altura: "1",
      quantidadeUnidades: "3",
      acabamentos: {
        "acb-1": { ativo: true, qtd: "4" },
        "acb-2": { ativo: true, qtd: "" },
        "acb-3": { ativo: false, qtd: "9" },
      },
    }
    expect(formParaItem(f)).toEqual({
      id: "ad-1",
      materialId: "lona",
      servicoId: "nenhum",
      largura: 2.5,
      altura: 1,
      quantidadeUnidades: 3,
      horasEstimadas: 0,
      acabamentos: [{ acabamentoId: "acb-1", quantidade: 4 }],
    })
  })

  it("converte item em formulário e volta sem perder dados", () => {
    const item = {
      id: "ad-2", materialId: "lona", servicoId: "s-m2", largura: 2, altura: 3,
      quantidadeUnidades: 2, horasEstimadas: 1.5,
      acabamentos: [{ acabamentoId: "acb-1", quantidade: 4 }],
    }
    expect(formParaItem(itemParaForm(item))).toEqual(item)
  })
})

describe("pendenciasItem", () => {
  const materiais = [lona, parafuso]
  const servicos = [porM2, porHora]

  it("pede o material primeiro", () => {
    expect(pendenciasItem(formVazio("a"), materiais, servicos, 2)).toEqual([
      "Item 2: selecione o material",
    ])
  })

  it("pede medidas quando o material é por m²", () => {
    const f = { ...formVazio("a"), materialId: "lona" }
    expect(pendenciasItem(f, materiais, servicos, 2)).toEqual([
      "Item 2: preencha as medidas corretamente",
    ])
    expect(pendenciasItem({ ...f, largura: "2", altura: "1" }, materiais, servicos, 2)).toEqual([])
  })

  it("material por unidade só precisa da quantidade", () => {
    const f = { ...formVazio("a"), materialId: "parafuso", quantidadeUnidades: "5" }
    expect(pendenciasItem(f, materiais, servicos, 3)).toEqual([])
  })

  it("quantidade precisa ser inteira e maior que zero", () => {
    const f = { ...formVazio("a"), materialId: "parafuso", quantidadeUnidades: "1.5" }
    expect(pendenciasItem(f, materiais, servicos, 3)).toEqual([
      "Item 3: preencha as medidas corretamente",
    ])
  })

  it("serviço por m² exige medidas mesmo com material por unidade", () => {
    const f = { ...formVazio("a"), materialId: "parafuso", servicoId: "s-m2" }
    expect(pendenciasItem(f, materiais, servicos, 2)).toEqual([
      "Item 2: preencha as medidas corretamente",
    ])
  })

  it("serviço por hora exige as horas", () => {
    const f = { ...formVazio("a"), materialId: "parafuso", servicoId: "s-h" }
    expect(pendenciasItem(f, materiais, servicos, 2)).toEqual([
      "Item 2: informe as horas estimadas do serviço",
    ])
  })

  it("acabamento marcado sem quantidade trava", () => {
    const f = {
      ...formVazio("a"),
      materialId: "parafuso",
      acabamentos: { "acb-1": { ativo: true, qtd: "" } },
    }
    expect(pendenciasItem(f, materiais, servicos, 2)).toEqual([
      "Item 2: informe a quantidade dos acabamentos marcados",
    ])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/item-adicional-form.test.ts`
Expected: FAIL ("Cannot find module '@/lib/item-adicional-form'").

- [ ] **Step 3: Implementar**

Crie `lib/item-adicional-form.ts`:

```ts
import { isPositiveNumberInput } from "./number"
import type { ItemAdicional, Material, Servico } from "./types"

// Versão em texto de um item adicional, do jeito que os campos da tela guardam.
export interface ItemAdicionalForm {
  id: string
  materialId: string
  servicoId: string
  largura: string
  altura: string
  quantidadeUnidades: string
  horasEstimadas: string
  acabamentos: Record<string, { ativo: boolean; qtd: string }>
}

function numeroOuZero(valor: string): number {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

export function formVazio(id: string): ItemAdicionalForm {
  return {
    id,
    materialId: "",
    servicoId: "nenhum",
    largura: "",
    altura: "",
    quantidadeUnidades: "1",
    horasEstimadas: "",
    acabamentos: {},
  }
}

export function formParaItem(form: ItemAdicionalForm): ItemAdicional {
  const acabamentos = Object.entries(form.acabamentos)
    .filter(([, sel]) => sel.ativo && isPositiveNumberInput(sel.qtd))
    .map(([acabamentoId, sel]) => ({
      acabamentoId,
      quantidade: numeroOuZero(sel.qtd),
    }))
  return {
    id: form.id,
    materialId: form.materialId,
    servicoId: form.servicoId,
    largura: numeroOuZero(form.largura),
    altura: numeroOuZero(form.altura),
    quantidadeUnidades: numeroOuZero(form.quantidadeUnidades),
    horasEstimadas: numeroOuZero(form.horasEstimadas),
    ...(acabamentos.length > 0 ? { acabamentos } : {}),
  }
}

export function itemParaForm(item: ItemAdicional): ItemAdicionalForm {
  return {
    id: item.id,
    materialId: item.materialId,
    servicoId: item.servicoId,
    largura: item.largura ? String(item.largura) : "",
    altura: item.altura ? String(item.altura) : "",
    quantidadeUnidades: String(item.quantidadeUnidades || 1),
    horasEstimadas: item.horasEstimadas ? String(item.horasEstimadas) : "",
    acabamentos: Object.fromEntries(
      (item.acabamentos ?? []).map(({ acabamentoId, quantidade }) => [
        acabamentoId,
        { ativo: true, qtd: String(quantidade) },
      ])
    ),
  }
}

// O que falta num item adicional, nas mesmas regras do item principal.
// `numero` é a posição mostrada ao usuário (o principal é o item 1).
export function pendenciasItem(
  form: ItemAdicionalForm,
  materiais: Material[],
  servicos: Servico[],
  numero: number
): string[] {
  const prefixo = `Item ${numero}: `
  const material = materiais.find((m) => m.id === form.materialId)
  if (!material) return [`${prefixo}selecione o material`]

  const servico = servicos.find((s) => s.id === form.servicoId)
  const dimensoesValidas =
    isPositiveNumberInput(form.largura) && isPositiveNumberInput(form.altura)
  const quantidadeValida =
    isPositiveNumberInput(form.quantidadeUnidades) &&
    Number.isInteger(Number(form.quantidadeUnidades))
  const medidasValidas =
    (material.unidade !== "m2" || dimensoesValidas) &&
    quantidadeValida &&
    (servico?.formaCobranca !== "m2" || dimensoesValidas)

  const pendencias: string[] = []
  if (!medidasValidas) pendencias.push(`${prefixo}preencha as medidas corretamente`)
  if (servico?.formaCobranca === "hora" && !isPositiveNumberInput(form.horasEstimadas)) {
    pendencias.push(`${prefixo}informe as horas estimadas do serviço`)
  }
  const acabamentosValidos = Object.values(form.acabamentos).every(
    (sel) => !sel.ativo || isPositiveNumberInput(sel.qtd)
  )
  if (!acabamentosValidos) {
    pendencias.push(`${prefixo}informe a quantidade dos acabamentos marcados`)
  }
  return pendencias
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/item-adicional-form.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/item-adicional-form.ts tests/item-adicional-form.test.ts
git commit -m "Orçamento: formulário e validação do item adicional"
```

---

### Task 6: Cartão do item adicional e tela de montagem

**Files:**
- Create: `components/orcamento/item-adicional-card.tsx`
- Modify: `app/(app)/orcamentos/novo/page.tsx`

- [ ] **Step 1: Criar o cartão**

Crie `components/orcamento/item-adicional-card.tsx`:

```tsx
"use client"

import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatarMoeda } from "@/lib/format"
import { acabamentosSeed } from "@/lib/seed-data"
import type { ItemAdicionalForm } from "@/lib/item-adicional-form"
import type { Material, Servico } from "@/lib/types"

interface ItemAdicionalCardProps {
  numero: number
  form: ItemAdicionalForm
  materiais: Material[]
  servicos: Servico[]
  onChange: (form: ItemAdicionalForm) => void
  onRemover: () => void
}

// Um item a mais do orçamento: material, serviço, medidas, quantidade e
// acabamentos. Instalação, desconto etc. valem pro orçamento todo (item 1).
export function ItemAdicionalCard({
  numero,
  form,
  materiais,
  servicos,
  onChange,
  onRemover,
}: ItemAdicionalCardProps) {
  const material = materiais.find((m) => m.id === form.materialId)
  const servico = servicos.find((s) => s.id === form.servicoId)
  const precisaMedidas =
    material?.unidade === "m2" || servico?.formaCobranca === "m2"

  function atualizar(campos: Partial<ItemAdicionalForm>) {
    onChange({ ...form, ...campos })
  }

  function atualizarAcabamento(id: string, campos: { ativo?: boolean; qtd?: string }) {
    const atual = form.acabamentos[id] ?? { ativo: false, qtd: "" }
    atualizar({ acabamentos: { ...form.acabamentos, [id]: { ...atual, ...campos } } })
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Item {numero}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemover}
          aria-label={`Remover item ${numero}`}
        >
          <Trash2 className="mr-1 h-4 w-4" />
          Remover
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Material</Label>
          <Select
            value={form.materialId}
            onValueChange={(v) => atualizar({ materialId: v ?? "" })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o material">
                {(v: string) =>
                  materiais.find((m) => m.id === v)?.nome ?? "Selecione o material"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {materiais.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>
            Serviço{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Select
            value={form.servicoId}
            onValueChange={(v) => atualizar({ servicoId: v ?? "nenhum" })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sem serviço adicional">
                {(v: string) =>
                  servicos.find((s) => s.id === v)?.nome ?? "Sem serviço adicional"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhum">Sem serviço adicional</SelectItem>
              {servicos.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {precisaMedidas && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`largura-${form.id}`}>Largura (m)</Label>
            <Input
              id={`largura-${form.id}`}
              type="number"
              min="0"
              step="0.01"
              value={form.largura}
              onChange={(e) => atualizar({ largura: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`altura-${form.id}`}>Altura (m)</Label>
            <Input
              id={`altura-${form.id}`}
              type="number"
              min="0"
              step="0.01"
              value={form.altura}
              onChange={(e) => atualizar({ altura: e.target.value })}
            />
          </div>
        </div>
      )}

      {material && (
        <div className="flex flex-col gap-2 sm:w-48">
          <Label htmlFor={`quantidade-${form.id}`}>Quantidade</Label>
          <Input
            id={`quantidade-${form.id}`}
            type="number"
            min="1"
            step="1"
            value={form.quantidadeUnidades}
            onChange={(e) => atualizar({ quantidadeUnidades: e.target.value })}
          />
        </div>
      )}

      {servico?.formaCobranca === "hora" && (
        <div className="flex flex-col gap-2 sm:w-48">
          <Label htmlFor={`horas-${form.id}`}>Horas estimadas</Label>
          <Input
            id={`horas-${form.id}`}
            type="number"
            min="0"
            step="0.5"
            value={form.horasEstimadas}
            onChange={(e) => atualizar({ horasEstimadas: e.target.value })}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label>
          Acabamentos{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        {acabamentosSeed.map((acabamento) => {
          const sel = form.acabamentos[acabamento.id] ?? { ativo: false, qtd: "" }
          return (
            <div
              key={acabamento.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="min-w-32 flex-1">
                <p className="text-sm font-medium">{acabamento.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {formatarMoeda(acabamento.precoUnitario)} / {acabamento.unidade}
                </p>
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Qtd."
                className="w-24"
                value={sel.qtd}
                disabled={!sel.ativo}
                onChange={(e) => atualizarAcabamento(acabamento.id, { qtd: e.target.value })}
              />
              <Switch
                checked={sel.ativo}
                onCheckedChange={(v) => atualizarAcabamento(acabamento.id, { ativo: v })}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Imports e estado na tela**

Em `app/(app)/orcamentos/novo/page.tsx`:

(a) Troque `import { Upload, FileCheck2, Printer, ArrowLeft, ArrowRight, X } from "lucide-react"` por `import { Upload, FileCheck2, Printer, ArrowLeft, ArrowRight, Plus, X } from "lucide-react"`.

(b) Depois do import de `OrcamentoOficial`, acrescente:

```ts
import { ItemAdicionalCard } from "@/components/orcamento/item-adicional-card"
import {
  formParaItem,
  formVazio,
  itemParaForm,
  pendenciasItem,
  type ItemAdicionalForm,
} from "@/lib/item-adicional-form"
```

(c) Logo depois de `const [horasEstimadas, setHorasEstimadas] = useState("")`, acrescente:

```ts
  // Itens a mais do orçamento (além do principal, que usa os campos acima).
  const [extras, setExtras] = useState<ItemAdicionalForm[]>([])
```

- [ ] **Step 3: Carregar adicionais na edição e no rascunho**

No `useEffect` que carrega `orcamentoEditando`, logo depois de `setFotos(orcamentoEditando.item.fotos ?? [])`, acrescente:

```ts
    setExtras((orcamentoEditando.item.itensAdicionais ?? []).map(itemParaForm))
```

No `useEffect` do `rascunho`, logo depois de `setFotos(rascunho.item.fotos ?? [])`, acrescente:

```ts
    setExtras((rascunho.item.itensAdicionais ?? []).map(itemParaForm))
```

- [ ] **Step 4: Incluir os adicionais no `item`, no cálculo e na validação**

(a) No `useMemo` do `item`, depois da linha `fotos: fotos.length > 0 ? fotos : undefined,` acrescente:

```ts
      itensAdicionais: extras.length > 0 ? extras.map(formParaItem) : undefined,
```

e, na lista de dependências do `useMemo`, acrescente `extras,` depois de `fotos,`.

(b) Na chamada `calcularOrcamentoCompleto(` de `const resultado = material ? ... : null`, acrescente o 7º argumento depois de `equipamentosAcessoSeed`:

```ts
        equipamentosAcessoSeed,
        { materiais, servicos }
```

(c) Antes de `const dadosValidos =`, acrescente:

```ts
  const pendenciasExtras = extras.flatMap((form, i) =>
    pendenciasItem(form, materiais, servicos, i + 2)
  )
  const extrasValidos = pendenciasExtras.length === 0
```

(d) Em `dadosValidos`, acrescente `extrasValidos &&` logo depois de `acabamentosValidos &&`.

(e) Na lista `pendencias` (a de fechar), acrescente `...pendenciasExtras,` logo depois de `material && !medidasValidas && "preencha as medidas corretamente",`.

(f) Em `pendenciasPorPasso[2]`, acrescente `...pendenciasExtras,` como último elemento do array do passo 2 (o tipo `(string | false | undefined)[]` aceita strings).

- [ ] **Step 5: Linhas do PDF com os adicionais**

Na chamada `gerarLinhasOrcamento({ item, nomeMaterial: material.nome, ... })` de `linhasPdf`, acrescente a propriedade:

```ts
          adicionais: extras.map((form) => {
            const materialExtra = materiais.find((m) => m.id === form.materialId)
            return {
              item: formParaItem(form),
              nomeMaterial: materialExtra?.nome ?? "Material removido",
              unidadeMaterial: materialExtra?.unidade ?? ("unidade" as const),
            }
          }),
```

- [ ] **Step 6: Lista de itens na etapa 2**

Na etapa 2 (`{mostrarPasso(2) && (...)}`), **antes** do primeiro `<div className="grid gap-4 sm:grid-cols-2">` do CardContent (o do Material/Serviço), acrescente o rótulo do item principal (só aparece quando já existe outro item):

```tsx
                {extras.length > 0 && (
                  <p className="text-sm font-semibold">Item 1</p>
                )}
```

E **no fim do `CardContent` da etapa 2** (depois do bloco `{servico?.formaCobranca === "hora" && (...)}` que fecha com `)}` e antes de `</CardContent>`), acrescente:

```tsx
                <Separator />
                <div className="flex flex-col gap-3">
                  {extras.map((form, i) => (
                    <ItemAdicionalCard
                      key={form.id}
                      numero={i + 2}
                      form={form}
                      materiais={materiais}
                      servicos={servicos}
                      onChange={(novo) =>
                        setExtras((atual) => atual.map((f) => (f.id === novo.id ? novo : f)))
                      }
                      onRemover={() =>
                        setExtras((atual) => atual.filter((f) => f.id !== form.id))
                      }
                    />
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setExtras((atual) => [
                        ...atual,
                        formVazio(`item-${Math.random().toString(36).slice(2, 10)}`),
                      ])
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar outro item
                  </Button>
                </div>
```

- [ ] **Step 7: Resumo com uma linha por item**

No cartão "Resumo do orçamento", **antes** da linha `<div className="flex justify-between"> ... Área ...`, acrescente:

```tsx
              {resultado && extras.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-md bg-muted/40 p-2 text-xs">
                  {resultado.itens.map((parte, i) => {
                    const nome =
                      materiais.find((m) => m.id === parte.materialId)?.nome ?? "Material removido"
                    return (
                      <div key={i} className="flex justify-between gap-3">
                        <span className="min-w-0 break-words text-muted-foreground">
                          Item {i + 1} — {nome}
                        </span>
                        <span className="shrink-0">
                          {formatarMoeda(
                            parte.subtotalMaterial +
                              parte.subtotalMaoDeObra +
                              parte.subtotalAcabamentos
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
```

- [ ] **Step 8: Verificar**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sem erros de tipo; todos os testes PASS.

Teste manual (celular 390 px, `npx next dev -p 3002`, login como dono): em Novo Orçamento, escolha cliente → material (etapa 2) → toque em **"Adicionar outro item"** → o "Próximo" trava com o aviso vermelho "Item 2: selecione o material" → preencha o item 2 → o resumo mostra "Item 1" e "Item 2" e o total soma os dois → avance até o fim e feche o orçamento → confira o estoque dos dois materiais em Materiais.

- [ ] **Step 9: Commit**

```bash
git add components/orcamento/item-adicional-card.tsx "app/(app)/orcamentos/novo/page.tsx"
git commit -m "Orçamento: lista de itens na tela de montagem"
```

---

### Task 7: Mostrar todos os itens nas telas do orçamento

**Files:**
- Create: `components/orcamentos/itens-adicionais-lista.tsx`
- Modify: `app/(app)/orcamentos/[id]/orcamento/page.tsx`, `app/(app)/orcamentos/[id]/os/page.tsx`, `components/orcamentos/orcamento-detalhes.tsx`
- Modify: `app/(app)/orcamentos/page.tsx`, `app/(app)/clientes/page.tsx`, `app/(app)/clientes/[id]/page.tsx`, `app/(app)/relatorios/page.tsx`

- [ ] **Step 1: Componente de lista (só leitura)**

Crie `components/orcamentos/itens-adicionais-lista.tsx`:

```tsx
"use client"

import { quantidadeMaterialConsumida, quantidadePecas, type ResultadoItem } from "@/lib/calculo"
import { formatarMoeda } from "@/lib/format"
import { acabamentosSeed } from "@/lib/seed-data"
import type { ItemAdicional, Material, Servico } from "@/lib/types"

interface ItensAdicionaisListaProps {
  itens: ItemAdicional[]
  // Partes do resultado dos adicionais (`resultado.itens.slice(1)`), na mesma ordem.
  partes: ResultadoItem[] | undefined
  materiais: Material[]
  servicos: Servico[]
}

// Itens a mais de um orçamento salvo (OS e detalhes): nome, medidas, serviço,
// acabamentos e valor de cada um. Não renderiza nada sem adicionais.
export function ItensAdicionaisLista({ itens, partes, materiais, servicos }: ItensAdicionaisListaProps) {
  if (itens.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">Outros itens do orçamento</p>
      {itens.map((item, i) => {
        const material = materiais.find((m) => m.id === item.materialId)
        const nome = item.materialFechado?.nome ?? material?.nome ?? "Material removido"
        const unidade = item.materialFechado?.unidade ?? material?.unidade
        const consumo =
          item.materialFechado?.quantidade ??
          (material ? quantidadeMaterialConsumida(item, material) : null)
        const servico = servicos.find((s) => s.id === item.servicoId)
        const parte = partes?.[i]
        const acabamentos = (item.acabamentos ?? [])
          .map((sel) => {
            const a = acabamentosSeed.find((x) => x.id === sel.acabamentoId)
            return a ? `${a.nome} (${sel.quantidade} ${a.unidade})` : null
          })
          .filter(Boolean)
        return (
          <div key={item.id} className="rounded-md border border-border p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 break-words font-medium">
                Item {i + 2} — {nome}
              </p>
              {parte && (
                <p className="shrink-0 font-medium">
                  {formatarMoeda(
                    parte.subtotalMaterial + parte.subtotalMaoDeObra + parte.subtotalAcabamentos
                  )}
                </p>
              )}
            </div>
            <p className="text-muted-foreground">
              {unidade === "m2"
                ? `${item.largura} × ${item.altura} m × ${quantidadePecas(item)} un`
                : `${item.quantidadeUnidades} un`}
              {consumo !== null && ` — ${consumo.toFixed(2)} ${unidade === "m2" ? "m²" : "un"}`}
            </p>
            {servico && item.servicoId !== "nenhum" && (
              <p className="text-muted-foreground">Serviço: {servico.nome}</p>
            )}
            {acabamentos.length > 0 && (
              <p className="text-muted-foreground">Acabamentos: {acabamentos.join(", ")}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Detalhes do histórico**

Em `components/orcamentos/orcamento-detalhes.tsx`:

(a) Troque o import `import { calcularOrcamentoCompleto, quantidadeMaterialConsumida, quantidadePecas } from "@/lib/calculo"` por `import { quantidadeMaterialConsumida, quantidadePecas } from "@/lib/calculo"` e acrescente:

```ts
import { calcularOrcamentoSalvo } from "@/lib/orcamento-itens"
import { ItensAdicionaisLista } from "./itens-adicionais-lista"
```

(b) Troque todo o bloco `const resultado = material ? calcularOrcamentoCompleto(...) : null` por:

```ts
  const resultado = calcularOrcamentoSalvo(orcamento, materiais, servicos)
```

(c) Logo depois do bloco `<div className="grid gap-4 sm:grid-cols-2">` que mostra Material / Medidas / Serviço (ou seja, depois do `</div>` que o fecha), acrescente:

```tsx
      <ItensAdicionaisLista
        itens={orcamento.item.itensAdicionais ?? []}
        partes={resultado?.itens.slice(1)}
        materiais={materiais}
        servicos={servicos}
      />
```

(d) Este arquivo não usa os subtotais de `resultado` (conferido com `grep -n "resultado\." components/orcamentos/orcamento-detalhes.tsx`, sem ocorrências além da declaração), então não há mais nada a trocar aqui. Se esse grep mostrar algum uso de `subtotalMaterial`, `subtotalMaoDeObra` ou `subtotalAcabamentos` no momento da implementação, troque por `resultado.itens[0].<campo>`.

- [ ] **Step 3: Ordem de serviço**

Em `app/(app)/orcamentos/[id]/os/page.tsx`:

(a) Troque o import de `@/lib/calculo` por `import { quantidadeMaterialConsumida, quantidadePecas } from "@/lib/calculo"` e acrescente:

```ts
import { calcularOrcamentoSalvo } from "@/lib/orcamento-itens"
import { ItensAdicionaisLista } from "@/components/orcamentos/itens-adicionais-lista"
```

(b) Troque o bloco `const resultado = material ? calcularOrcamentoCompleto(...) : null` por `const resultado = calcularOrcamentoSalvo(orcamento, materiais, servicos)`.

(c) Nas linhas da tabela, troque `resultado.subtotalMaterial` (linha ~182) por `resultado.itens[0].subtotalMaterial`, `resultado.subtotalMaoDeObra` (~196) por `resultado.itens[0].subtotalMaoDeObra` e `resultado.subtotalAcabamentos` (~206) por `resultado.itens[0].subtotalAcabamentos`. Deixe `subtotalInstalacao` e `valorImposto` como estão.

(d) Logo **depois** do `</table>` da tabela de itens, acrescente:

```tsx
          <div className="mt-4">
            <ItensAdicionaisLista
              itens={orcamento.item.itensAdicionais ?? []}
              partes={resultado?.itens.slice(1)}
              materiais={materiais}
              servicos={servicos}
            />
          </div>
```

- [ ] **Step 4: Orçamento oficial (PDF do cliente)**

Em `app/(app)/orcamentos/[id]/orcamento/page.tsx`:

(a) Troque o import de `calcularOrcamentoCompleto` por `import { calcularOrcamentoSalvo } from "@/lib/orcamento-itens"` e mantenha o import de `acabamentosSeed` (ainda usado em `acabamentosDisponiveis`); remova `equipamentosAcessoSeed` do import se ficar sem uso.

(b) Troque o bloco `const resultado = material ? calcularOrcamentoCompleto(...) : null` por `const resultado = calcularOrcamentoSalvo(orcamento, materiais, servicos)`.

(c) Na chamada de `gerarLinhasOrcamento`, acrescente:

```ts
        adicionais: (orcamento.item.itensAdicionais ?? []).map((extra) => {
          const materialExtra = materiais.find((m) => m.id === extra.materialId)
          return {
            item: extra,
            nomeMaterial: extra.materialFechado?.nome ?? materialExtra?.nome ?? "Material removido",
            unidadeMaterial: extra.materialFechado?.unidade ?? materialExtra?.unidade ?? ("unidade" as const),
          }
        }),
```

- [ ] **Step 5: Totais de orçamento aberto (histórico e clientes)**

Em `app/(app)/orcamentos/page.tsx`, troque o corpo de `totalOrcamento` por:

```ts
  function totalOrcamento(orcamentoId: string) {
    const orcamento = orcamentos.find((o) => o.id === orcamentoId)
    if (!orcamento) return 0
    if (orcamento.totalFechado !== undefined) return orcamento.totalFechado
    return calcularOrcamentoSalvo(orcamento, materiais, servicos)?.total ?? 0
  }
```

Em `app/(app)/clientes/page.tsx` e `app/(app)/clientes/[id]/page.tsx`, troque o corpo da função `totalOrcamento` por:

```ts
  if (o.totalFechado !== undefined) return o.totalFechado
  return calcularOrcamentoSalvo(o, materiais, servicos)?.total ?? 0
```

Nos três arquivos: acrescente `import { calcularOrcamentoSalvo } from "@/lib/orcamento-itens"` e remova os imports que ficarem sem uso (`calcularOrcamentoCompleto`, `acabamentosSeed`, `equipamentosAcessoSeed`). Rode `npx eslint <arquivo>` em cada um para achar sobras.

Na tabela de `clientes/[id]/page.tsx`, na célula do material (`{o.materialFechado?.nome ?? mat?.nome ?? "—"}`), acrescente o complemento de itens:

```tsx
                      {o.materialFechado?.nome ?? mat?.nome ?? "—"}
                      {(o.item.itensAdicionais?.length ?? 0) > 0 &&
                        ` +${o.item.itensAdicionais!.length} ${o.item.itensAdicionais!.length === 1 ? "item" : "itens"}`}
```

- [ ] **Step 6: Relatório de uso de material**

Em `app/(app)/relatorios/page.tsx`, dentro de `usoMaterial`, substitua o corpo do `for (const o of orcamentosPeriodo) { ... }` por um laço que cobre principal e adicionais:

```ts
    for (const o of orcamentosPeriodo) {
      const partes: { item: ItemProduto; snap?: Orcamento["materialFechado"] }[] = [
        { item: o.item, snap: o.materialFechado },
        ...(o.item.itensAdicionais ?? []).map((extra) => ({ item: extra, snap: extra.materialFechado })),
      ]
      for (const { item, snap } of partes) {
        const mat = materiais.find((m) => m.id === item.materialId)
        if (!snap && !mat) continue
        const id = snap?.id ?? mat!.id
        const nome = snap?.nome ?? mat!.nome
        const unidade = snap?.unidade ?? mat!.unidade
        const qtd = snap?.quantidade ?? quantidadeMaterialConsumida(item, mat!)
        const custo = snap?.custo ?? qtd * mat!.precoUnitario
        const atual = porMaterial.get(id)
        if (atual) { atual.quantidade += qtd; atual.custo += custo }
        else porMaterial.set(id, { nome, unidade: unidade === "m2" ? "m²" : "un", quantidade: qtd, custo })
      }
    }
```

e acrescente ao import de tipos do arquivo `ItemProduto` e `Orcamento` (`import type { ItemProduto, Orcamento } from "@/lib/types"`, juntando com um import de tipos já existente se houver).

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit && npx vitest run && npx eslint "app/(app)/orcamentos" "app/(app)/clientes" "app/(app)/relatorios" components/orcamentos components/orcamento lib 2>&1 | tail -20`
Expected: tsc limpo; testes PASS; eslint sem **novos** avisos (compare com os 3 avisos antigos conhecidos de `sidebar.tsx`, `equipe/page.tsx`, `notificacoes-bell.tsx`).

Teste manual: abra o orçamento criado na Task 6 → **Detalhes** (histórico), **Ordem de serviço** e **Orçamento oficial** → confira que os dois itens aparecem, as linhas do PDF somam o total, e em **Clientes** o orçamento mostra "+1 item".

- [ ] **Step 8: Commit**

```bash
git add components/orcamentos "app/(app)/orcamentos" "app/(app)/clientes" "app/(app)/relatorios"
git commit -m "Orçamento: mostrar todos os itens em detalhes, OS, PDF, clientes e relatórios"
```

---

### Task 8: Verificação final

- [ ] **Step 1: Suíte completa**

Run: `npx vitest run && npx tsc --noEmit && npx next build 2>&1 | tail -15`
Expected: testes PASS, tsc limpo, build conclui sem erro.

- [ ] **Step 2: Roteiro manual no celular (390 px)**

1. Novo orçamento só com 1 item: fluxo idêntico ao de antes; fechar funciona.
2. Novo orçamento com 3 itens (m² e unidade): travas do "Próximo" mostram o item que falta, em vermelho; resumo lista os itens; total correto.
3. Fechar → conferir estoque de cada material em Materiais.
4. Editar o orçamento fechado: remover um item → estoque dele volta; adicionar outro → baixa.
5. Reabrir → estoque volta; excluir → estoque volta.
6. Duplicar pelo Histórico → o rascunho já vem com todos os itens.
7. Abrir um orçamento **antigo** (de antes da mudança) em Detalhes, OS e PDF: sem diferença visual.
8. Gerar PDF de um orçamento com vários itens: uma linha por item e acabamentos, soma igual ao total.

- [ ] **Step 3: Não subir sem o dono pedir**

Nenhum `git push` neste plano. Quando o dono aprovar o resultado, subir com o mesmo cuidado de sempre: só os arquivos desta funcionalidade (`git add` explícito), sem os arquivos soltos do projeto (boleto, financeiro, pptx, logo, `.playwright-mcp/`).
