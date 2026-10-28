# Orçamento com vários itens

Data: 2026-10-28 · Status: aguardando revisão do dono

## Objetivo

Hoje um orçamento tem um único item (um material, uma medida). O vendedor chega
no cliente e precisa lançar vários itens diferentes (ex.: 3 portas de vidro de
2×1 m e 1 janela de 1×1 m) em **um orçamento só**, com **um valor total**.

## Decisões já tomadas

- **Valores gerais valem uma vez para o orçamento todo:** instalação,
  deslocamento, margem, desconto, imposto, entrada, validade, condições de
  pagamento e fotos. (Uma visita ao cliente, um total.)
- **Cada item tem o seu:** material, serviço (mão de obra), medidas,
  quantidade, horas estimadas e acabamentos.
- **Abordagem A:** o item que existe hoje continua sendo o "item principal" e
  ganha uma lista opcional de **itens adicionais**. Não há conversão de dados:
  orçamentos antigos seguem idênticos e abrem sem mudança.
- Não precisa alterar o banco: o item já é salvo em JSON (`orcamentos.item`).

## Modelo de dados

`OrcamentoItem` (lib/types.ts) ganha um campo opcional:

```ts
itensAdicionais?: ItemAdicional[]

interface ItemAdicional {
  id: string
  materialId: string
  servicoId: string
  largura: number
  altura: number
  quantidadeUnidades: number
  horasEstimadas: number
  acabamentos?: AcabamentoSelecionado[]
  // Preenchidos ao fechar (mesma ideia do materialFechado do item principal)
  materialFechado?: Orcamento["materialFechado"]
  quantidadeMaterialDebitada?: number
}
```

O item principal guarda, como hoje, os campos gerais (instalação, desconto
etc.). Itens adicionais **não** repetem esses campos. Sem `itensAdicionais`
(ou lista vazia), tudo se comporta exatamente como antes.

## Cálculo (lib/calculo.ts)

`calcularOrcamentoCompleto` passa a somar, ao custo base, o material, a mão de
obra e os acabamentos de cada item adicional. Margem, desconto, imposto e
ajuste manual continuam aplicados **uma vez sobre o custo base total**. O
resultado ganha um detalhamento por item (`itens[]`: nome, material, mão de
obra, acabamentos) para o resumo e o PDF. Sem itens adicionais, o resultado é
o mesmo de hoje (os testes atuais devem continuar passando sem alteração).

## Tela de montagem (orcamentos/novo/page.tsx)

- **Etapa 2 (Produto):** mostra a lista "Itens do orçamento". Item 1 = o
  principal. Botão **"+ Adicionar outro item"** abre um cartão com material,
  serviço, medidas e quantidade. Cada item pode ser editado e removido (o
  principal não pode ser removido, só trocado).
- **Etapa 3 (Acabamentos):** os acabamentos passam a valer por item (um bloco
  por item, recolhível no celular).
- **Etapas 4, 5 e 6:** sem mudança (valores gerais).
- **Resumo:** uma linha por item (nome + valor) antes dos totais gerais.
- **Validação por etapa** (já existe): cada item adicional exige material e
  medidas válidas; acabamento marcado exige quantidade. O "Próximo" trava e
  mostra o aviso vermelho dizendo qual item falta (ex.: "Item 2: selecione o
  material").
- Rascunho local e modo edição carregam/salvam a lista de itens.

## Onde o orçamento é exibido (todos precisam listar os itens)

PDF oficial (lib/orcamento-pdf.ts: uma linha por item + acabamentos de cada um,
depois instalação e deslocamento; a diluição proporcional até bater com o total
continua igual), orçamento imprimível, ordem de serviço, detalhes e histórico,
tela do cliente e relatórios. Cada lugar usa um helper único
`itensDoOrcamento(orcamento)` que devolve o principal + adicionais, para não
repetir a regra.

## Estoque (context/data-context.tsx)

Hoje fechar, editar, reabrir e excluir um orçamento mexem no estoque de **um**
material. Passa a ser por item: um helper `consumosDoOrcamento` devolve a lista
`{materialId, quantidade}` de todos os itens. Fechar baixa todos; reabrir e
excluir devolvem todos; editar devolve os antigos e baixa os novos. Cada item
guarda o que foi realmente debitado (limitado ao estoque disponível), igual ao
item principal hoje.

## Compatibilidade e riscos

- Orçamentos antigos: sem `itensAdicionais`, nenhum caminho novo é executado.
- Maior risco: o estoque (várias rotas de fechar/editar/reabrir/excluir) e o
  PDF. Os dois ganham testes antes da mudança.

## Testes

- Cálculo: orçamento com 1 item igual ao atual; com 2 e 3 itens (soma de
  material, mão de obra, acabamentos, margem/desconto/imposto uma vez).
- PDF: linhas por item somam exatamente o total.
- Estoque: fechar, editar (trocando e removendo item), reabrir e excluir
  devolvem/baixam corretamente cada material, inclusive o mesmo material
  repetido em dois itens e estoque insuficiente.
- Fluxo da tela: "Próximo" trava com item incompleto.

## Fora deste projeto (próximas frentes)

- Orçamento offline (PWA) com envio automático ao voltar o sinal.
- Perfil do funcionário e distribuição de tarefas na Produção.
