# ToldoSys — Protótipo clicável do sistema interno (design)

Data: 2026-09-15

## Contexto e objetivo

Empresa de toldos e comunicação visual (fachadas, ACM, banners, lonas, adesivos,
placas, letreiros) precisa de um sistema interno de uso diário pelo
dono/orçamentista da loja. Público-alvo: dono de loja pequena de cidade do
interior, sem familiaridade com sistemas complexos — a interface deve ser
simples, direta, sem jargão técnico.

Referência visual de estilo: capturas de tela do concorrente "VisualCalc ERP
Pro" (tema escuro, acento verde vibrante, sidebar com grupos de navegação,
dashboard com cards de métricas, checklist de configuração inicial no topo do
dashboard).

Esta primeira entrega é um **protótipo clicável**, não o sistema final com
backend real. Objetivo: validar telas, fluxo e visual antes de investir em
persistência de dados de verdade.

## Escopo

- Protótipo navegável cobrindo as 6 telas abaixo, com dados de exemplo.
- Sem autenticação real, sem banco de dados real, sem envio de arquivos para
  servidor.
- Estado dos dados (materiais, mão de obra, clientes, orçamentos, estoque)
  mantido em memória/`localStorage` via React Context, pré-carregado com dados
  de exemplo (seed), para que o fluxo pareça real durante a demonstração
  (ex.: cadastrar um material e já poder usá-lo em um orçamento).

Fora de escopo nesta entrega: geração de PDF no servidor, autenticação,
multi-empresa, integração com NF-e, notificações, telas "em breve" da sidebar
(Produção, Financeiro).

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Tema escuro fixo, cor de acento **azul** (`#3b82f6` como base, ajustável)
- Estado global simples via React Context + `localStorage` (sem backend, sem
  ORM/DB nesta fase)
- Deploy futuro possível na Vercel (fora do escopo desta entrega)

## Navegação (sidebar agrupada)

```
🧭 ToldoSys
  PRINCIPAL
    Dashboard
    Novo Orçamento
    Histórico de Orçamentos
  CADASTROS
    Materiais
    Mão de Obra
  ESTOQUE
    Estoque
  (itens bloqueados "em breve": Produção, Financeiro — visual apenas, sem tela)
```

## Telas

### 1. Dashboard (`/dashboard`)
- Checklist de configuração inicial no topo (ex.: "Cadastrar materiais",
  "Cadastrar mão de obra", "Fazer primeiro orçamento") — inspirado no
  checklist "Configure sua gráfica" do concorrente.
- Cards de resumo: orçamentos abertos, orçamentos fechados no mês, itens de
  estoque com alerta baixo.
- Botão de destaque "Novo Orçamento".

### 2. Materiais (`/materiais`)
- Tabela: nome, tipo (lona, ACM, PVC, adesivo vinil, metalon etc.), preço por
  m² ou por unidade, quantidade mínima (usada para disparar o alerta de
  estoque baixo).
- Modal de adicionar/editar material.

### 3. Mão de Obra (`/mao-de-obra`)
- Tabela: tipo de serviço (instalação de toldo, fachada, letreiro etc.), forma
  de cobrança (valor fixo / por hora / por m² / % sobre material).
- Modal de adicionar/editar tipo de serviço.

### 4. Novo Orçamento (`/orcamentos/novo`) — tela central
- Seleção de cliente (busca na lista existente) ou cadastro rápido de cliente
  novo via modal.
- Seleção de produto/serviço (a partir dos materiais e mão de obra
  cadastrados).
- Campos de medida (largura × altura, ou quantidade, conforme o tipo de item).
- Cálculo automático em tempo real: material + mão de obra = total, exibido
  ao vivo conforme os campos mudam.
- Campo de ajuste manual (desconto/acréscimo), refletido no total.
- Upload obrigatório de foto ou vídeo (input de arquivo real, sem envio a
  servidor — só precisa existir um arquivo selecionado). O botão "Fechar
  Orçamento" fica desabilitado até haver um upload.
- Botão "Gerar PDF": abre uma visualização do orçamento estilizada para
  impressão (CSS de impressão) e aciona o diálogo de impressão do navegador
  ("Salvar como PDF"). Não há geração de PDF no servidor nesta fase.
- Botão "Fechar Orçamento": salva o orçamento como fechado, debita a
  quantidade usada do estoque mock, e atualiza os números do dashboard e do
  histórico.

### 5. Estoque (`/estoque`)
- Lista de materiais com quantidade disponível e indicador visual de estoque
  baixo (abaixo de um limite definido no cadastro do material).
- "Nova Entrada de Estoque" (modal ou tela): material, quantidade, fornecedor
  (opcional), toggle "Com nota fiscal" / "Sem nota fiscal"; campo "número da
  nota" só aparece quando o toggle está em "Com nota fiscal".

### 6. Histórico de Orçamentos (`/orcamentos`)
- Lista de orçamentos por cliente, com status (aberto, fechado, cancelado).
- Filtro por data e por cliente.
- Ações: reabrir orçamento antigo, duplicar orçamento antigo (pré-preenche um
  novo orçamento com os mesmos dados).

## Fluxo principal a destacar

Cliente pede orçamento → orçamentista escolhe produto e informa medidas →
sistema calcula automaticamente → anexa foto/vídeo → fecha orçamento →
estoque é atualizado → gera PDF pra enviar ao cliente final.

Esse é o caminho que será testado manualmente ponta a ponta antes da entrega.

## Dados de exemplo (seed)

Pré-carregar, para que o protótipo não pareça vazio na demonstração:
- 5–8 materiais variados (lona, ACM, PVC, adesivo vinil, metalon).
- 4–5 tipos de mão de obra com formas de cobrança diferentes.
- 3–4 clientes de exemplo.
- 6–8 orçamentos distribuídos entre os status (aberto, fechado, cancelado).
- Estoque com pelo menos 1 item propositalmente abaixo do limite mínimo, para
  mostrar o alerta visual.

## Verificação

Sem testes automatizados (protótipo de UI, sem regras de negócio críticas
persistidas). Verificação por navegação manual cobrindo o fluxo principal
completo (ver seção acima) em `npm run dev` antes de considerar a entrega
concluída.
