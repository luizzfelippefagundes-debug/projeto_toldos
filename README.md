# Toldos Print

Protótipo local de um sistema interno para orçamentos, materiais, mão de obra,
estoque, produção, financeiro e pedidos rápidos de uma gráfica de comunicação
visual.

## Requisitos

- Node.js 20.9 ou superior
- npm

## Executar localmente

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Os dados de exemplo são
carregados automaticamente na primeira execução.

A chave `GOOGLE_GENERATIVE_AI_API_KEY` é opcional e só habilita o teste de
perguntas livres ao Gemini na Central do Bot. Sem ela, os fluxos locais e as
mensagens automáticas continuam disponíveis.

## Verificações

```bash
npm test
npm run lint
npm run build
```

## Limites desta versão

Este projeto é um protótipo para uso local e demonstração, não um ERP pronto
para operação compartilhada ou produção comercial:

- Cadastros e movimentações ficam no `localStorage` do navegador. Cada
  navegador/dispositivo tem seus próprios dados; limpar os dados do navegador
  pode apagá-los. Não há banco de dados, sincronização, autenticação ou backup
  automático.
- Os papéis de dono, produção e financeiro e a área de vendedor são somente
  modos de demonstração, não controles de acesso.
- O orçamento exige selecionar um arquivo, mas nesta versão só o nome do
  arquivo é registrado; a foto ou o vídeo não é enviado nem armazenado.
- O PDF é gerado pelo diálogo de impressão do navegador. O WhatsApp não está
  conectado; mensagens automáticas ficam apenas registradas na tela.
- Os dados iniciais são exemplos, não dados comerciais reais.
- Relatórios distinguem dinheiro recebido/pago de contas ainda em aberto. Para
  lançamentos antigos sem data de baixa, a data de criação é usada como
  referência e isso é identificado na tela.
- A produção da Gráfica Rápida guarda o prazo do pedido no momento do cadastro;
  pedidos antigos sem esse campo continuam usando o prazo atual do produto.
- A integração com Mercado Pago e o envio automático pelo WhatsApp não fazem
  parte desta versão.

Antes de usar com dados reais, será necessário definir e implementar persistência
centralizada, autenticação/permissões, backup e armazenamento de anexos.
