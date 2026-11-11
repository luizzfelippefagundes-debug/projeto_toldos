# ToldosPrint — Relatório de Desenvolvimento

Gerado em 11/11/2026 · Sistema de gestão gráfica

---

## ✅ Concluído

### Feito nessa sessão

| Funcionalidade | Arquivos alterados |
|---|---|
| **Acabamentos editáveis pelo banco de dados** — CRUD completo (add / edit / delete via interface) | `app/api/acabamentos/route.ts`, `app/api/acabamentos/[id]/route.ts`, `components/acabamentos/acabamento-form-dialog.tsx`, `app/(app)/acabamentos/page.tsx`, `components/layout/nav-groups.ts` |
| **Acabamentos buscados do DB no PDF da OS** — servidor busca do banco com fallback para seed | `lib/pdf-os-servidor.ts` |
| **Acabamentos buscados do DB na página do orçamento** | `app/(app)/orcamentos/[id]/orcamento/page.tsx` |
| **Retornos "Aprovado" → sempre cai em Ag. Assinatura na Produção** — antes só movia quando WhatsApp era enviado | `context/data-context.tsx`, `app/(app)/retornos/page.tsx` |
| **Parcelas (1x/2x/3x) sempre visíveis no PDF do orçamento** — antes ficava oculto quando condições de pagamento preenchidas | `app/(app)/orcamentos/[id]/orcamento/page.tsx`, `components/orcamento/novo-orcamento-form.tsx` |
| **Card "Despesas fixas pendentes" no financeiro** — exibe total de despesas com flag `despesaFixa` pendentes | `lib/financeiro.ts`, `app/(app)/financeiro/page.tsx` |
| **Lupa de busca na página de Materiais** — campo de pesquisa por nome e tipo | `app/(app)/materiais/page.tsx` |
| **Nomes longos de clientes corrigidos no orçamento** — container expandido com flex-1 para não truncar precocemente | `components/orcamento/novo-orcamento-form.tsx` |
| **CPF e E-mail opcionais no cadastro rápido de cliente** — disponíveis direto dentro do orçamento | `components/orcamento/cliente-quick-add-dialog.tsx` |
| **E-mail da empresa atualizado no PDF** — substituído por contato@toldosprint.com.br | `lib/orcamento-pdf.ts` |
| **Garantia de 3 meses no PDF do Orçamento** — adicionada tanto no PDF web quanto no PDF do servidor | `components/orcamentos/orcamento-oficial.tsx`, `lib/pdf-orcamento-servidor.ts` |
| **Parcelamento (1x, 2x, 3x) e Validade no PDF do servidor** — agora também saem no PDF enviado pelo WhatsApp | `lib/pdf-orcamento-servidor.ts` |
| **Filtro Só com OS no Financeiro ajustado** — ativo por padrão para orçamentos sem ocultar despesas normais | `app/(app)/financeiro/page.tsx` |
| **Formas de pagamento e Acréscimo/Desconto na precificação** — atalhos de À vista, Boleto, Débito, Cartão e campo com indicação de +/- R$ | `components/orcamento/novo-orcamento-form.tsx` |
| **Exclusão de produto na Gráfica Rápida** — botão de lixeira no card do produto confirmado | `app/(app)/grafica-rapida/page.tsx`, `context/data-context.tsx` |
| **Retorno automático pelo WhatsApp** — bot identifica resposta do cliente (aprovação/negociação/recusa) e move o card em Retornos e Produção | `app/api/whatsapp/webhook/route.ts`, `lib/retornos.ts`, `lib/retornos-automatico.ts` |
| **Cliente automático pelo WhatsApp** — bot cria cadastro no banco automaticamente quando pessoa nova manda mensagem | `app/api/whatsapp/webhook/route.ts`, `lib/bot-whatsapp.ts` |

### Já existia antes (confirmado durante a sessão)

- Toggle "soComOs" no financeiro — mostrar só orçamentos com OS
- CPF e e-mail opcionais no cadastro de cliente
- Bloquear etapa 6 só no celular (mobile)
- OS assinada → envia automaticamente pelo WhatsApp
- Validade 7 dias visível no PDF do orçamento
- Combobox com busca no campo de material (orçamento)
- Toggle despesa fixa + aba "Fixas" no financeiro
- Email oficial da empresa no PDF (contato@toldosprint.com.br)
- Upload de arte direto no card da Produção + link público de aprovação (`/arte/[id]`) que avança o card para Impressão ao ser aprovado pelo cliente

---

## ❌ Falta fazer

| Funcionalidade | Complexidade | Observação |
|---|---|---|
| **QR Code Mercado Pago na OS** | 🟢 Baixa | Aguardando chave Pix / link MP |
| **Loja / portfólio online** | ⏳ Fase futura | Catálogo e vitrine de produtos |

---

_Gerado por Claude Sonnet 4.6_
