# Orçamento offline (PWA)

Data: 2026-10-28 · Status: aguardando revisão do dono

## Objetivo

O vendedor está na roça, sem sinal, com o app instalado no celular. Ele precisa
**montar e fechar um orçamento de toldo** (com vários itens) e **gerar o PDF**,
e quando o celular voltar a ter internet o orçamento tem que subir sozinho (ou
com um toque) e aparecer para os outros usuários.

## Decisões já tomadas

- **Escopo offline:** só **criar orçamento novo** (`/orcamentos/novo`), de ponta
  a ponta: escolher ou **cadastrar cliente novo** (nome e telefone), vários
  itens, instalação, deslocamento, preço, fotos e PDF. Editar orçamentos,
  financeiro, produção, estoque etc. continuam exigindo internet. A Gráfica
  Rápida (`/vendedor`) fica de fora por enquanto.
- **Não trocar de tecnologia.** Fica Next.js; o offline vem de um service
  worker, uma cópia local dos dados e uma fila no aparelho.
- **Número do orçamento:** o PDF feito offline sai como **"Orçamento
  provisório", sem número**. O número oficial é definido quando o orçamento
  sobe. Nunca há número repetido por causa do offline.
- **Aparelhos:** iPhone e Android. O iPhone não envia nada em segundo plano;
  então o envio acontece **ao abrir o app com sinal** (e no botão "Enviar
  agora"). No Android, quando o navegador permitir, também pode subir sozinho.

## Como funciona

### 1. App abre offline (service worker)

`public/sw.js`, registrado só em produção. Guarda no aparelho: as páginas do
app que o vendedor usa (Novo Orçamento, Histórico), os arquivos estáticos
(`/_next/static`), fontes e ícones. Navegação sem rede cai na cópia guardada;
com rede, busca a versão nova. O `sw.js` é servido sem cache (cabeçalhos
descritos no guia de PWA do Next.js desta versão) para atualizar sempre.

Não guarda: respostas de `/api/*` (esses dados vão pela cópia local, abaixo),
páginas de login e do painel da TV.

### 2. Cópia local dos dados (IndexedDB)

Banco `toldosprint-offline`, loja `catalogo`. A cada carga bem-sucedida do
`DataProvider` com internet, grava uma cópia de **clientes, materiais e
serviços** e a data/hora da cópia. Sem internet, o `DataProvider` usa essa
cópia em vez de mostrar erro. Clientes novos criados offline aparecem na lista
de clientes do aparelho (marcados "novo, aguardando envio") para poderem ser
reutilizados em outros orçamentos antes do sinal voltar. A tela mostra "Dados de DD/MM às HH:mm" quando
está usando a cópia. Acabamentos e equipamentos já são constantes do código.

### 3. Fila de orçamentos (IndexedDB)

Loja `fila`. Cada item guarda: `id` (gerado no aparelho, ex. `orc-ab12cd34`),
o **cliente novo** quando houver (com `id` próprio gerado no aparelho, nome e
telefone), os dados do orçamento (cliente, `item` com `itensAdicionais`, ajuste, validade),
as fotos como Blob, o `totalProvisorio` mostrado no PDF offline, `criadoEm`, `tentativas` e `ultimoErro`.

Ao tocar em **Fechar Orçamento** sem internet, o orçamento **não** vai para o
servidor: entra na fila e o vendedor vê a confirmação "Salvo no aparelho —
será enviado quando houver sinal".

### 4. Envio (sincronização)

Componente `SincronizadorOffline`, dentro do `DataProvider`. Dispara quando:
(a) o app abre com internet, (b) o evento `online` do navegador, (c) o botão
"Enviar agora", (d) Background Sync, nos navegadores que suportam.

Para cada item da fila, em ordem de criação, **depois que o `DataProvider`
terminou de carregar os dados atuais**:
1. Se já existe orçamento com esse `id` nos dados carregados, o item é dado
   como enviado (idempotência) e sai da fila.
2. Se o item traz cliente novo e esse `id` de cliente ainda não existe, cria o
   cliente primeiro (mesma regra do cadastro rápido de hoje). Cliente novo
   usado em mais de um orçamento da fila é criado uma vez só.
3. Envia as fotos (`/api/upload`) e troca os Blobs pelas URLs.
4. Chama `fecharOrcamento` com o `id` do item. Isso reaproveita a regra que já
   existe: número oficial a partir dos dados atuais, estoque, parcelas
   financeiras e mensagem do bot. Se o total final for diferente do
   `totalProvisorio`, o vendedor vê um aviso "Orçamento #1003: o valor mudou de
   R$ X para R$ Y" (preço de material pode ter mudado desde a última cópia).
5. Só remove da fila depois que o orçamento aparece salvo no servidor.

Se algo falhar, o item **continua na fila** com `ultimoErro` e `tentativas`
somadas; nada se perde. Itens com 5 falhas seguidas ficam marcados "Precisa de
atenção" e deixam de tentar sozinhos, mas continuam no aparelho.

`fecharOrcamento` ganha um parâmetro opcional `id` (hoje gera o próprio) e o
`DataProvider` expõe `carregado: boolean`.

### 5. O que o vendedor vê

- Faixa no topo: "Sem internet — seus orçamentos serão enviados quando o sinal
  voltar".
- Contador "N aguardando envio" com o botão "Enviar agora" (e "Precisa de
  atenção" quando houver falha repetida).
- No Histórico, os itens da fila aparecem no topo como "Aguardando envio", sem
  número, e abrem em modo leitura.
- O PDF gerado offline tem a marca "ORÇAMENTO PROVISÓRIO", sem número, e a nota
  "O número oficial será enviado quando o orçamento for sincronizado".

## Riscos e como tratar

| Risco | Tratamento |
|---|---|
| **Login (Clerk) offline.** O app é protegido; a página guardada pode tentar validar a sessão e falhar sem rede. | **Teste de viabilidade antes de tudo (Fase 0).** Se não funcionar, para e avisa. |
| iPhone apaga dados de sites pouco usados. | App instalado na tela inicial é isento; manter a faixa "Dados de…" e avisar para abrir o app com sinal antes de ir pra roça. |
| Cópia local desatualizada (preço de material mudou). | Mostra a data da cópia. O valor do orçamento offline usa a cópia; ao enviar, o `fecharOrcamento` recalcula com os dados atuais e o total do servidor prevalece (o vendedor é avisado se mudou). |
| Cache do service worker servir versão velha do app. | `sw.js` sem cache, versão do cache no nome, limpeza de caches antigos ao ativar. |
| Fotos grandes enchem o aparelho. | Mantém o limite atual de 50 MB por arquivo e mostra o tamanho da fila. Sem compressão nesta versão. |
| Dois celulares enviando no mesmo instante pegarem o mesmo número. | Mesmo risco que já existe online hoje; fora deste projeto. |

## Fases (cada uma termina testada e comitada)

0. **Viabilidade:** service worker mínimo + app instalado abre `/orcamentos/novo`
   em modo avião, já logado. **Ponto de decisão:** se falhar, para e volta a
   conversar.
1. **Dados locais e fila**, com testes automáticos (banco IndexedDB falso):
   cópia do catálogo, fila, sincronização, idempotência e falhas.
2. **Telas:** faixa offline, contador, "Aguardando envio" no Histórico, PDF
   provisório.
3. **Teste real:** celular em modo avião (iPhone e Android): criar orçamento
   com 3 itens e foto, religar o sinal, conferir envio, número, parcelas e
   estoque; depois remover o orçamento de teste.

## Testes

- Fila: gravar, ordenar, remover só após confirmação, manter com erro.
- Cliente novo offline: criado uma vez só mesmo usado em 2 orçamentos; enviar
  duas vezes não duplica o cliente.
- Sincronização: sucesso; falha no meio (foto ok, fechar falha); envio duplo
  não duplica; item já existente no servidor é dado como enviado.
- Cópia local: grava após carga online; é usada quando o `fetch` falha.
- PDF provisório: sem número e com a marca.
- Manual (Fase 3): modo avião real nos dois sistemas.

## Fora deste projeto

- Editar, excluir ou reabrir orçamento offline.
- Editar dados de cliente já cadastrado offline.
- Gráfica Rápida / Produção offline.
- Perfil do funcionário e tarefas da Produção (próxima frente).
