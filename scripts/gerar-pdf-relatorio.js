
const { jsPDF } = require('jspdf');
const fs = require('fs');
const path = require('path');

const doc = new jsPDF({ unit: 'pt', format: 'a4' });
const esq = 40;
const dir = 555;
const larguraUtil = dir - esq;
let y = 40;

function checkPage(height) {
  if (y + height > 780) {
    doc.addPage();
    y = 40;
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(120);
    doc.text('TOLDOS PRINT — GUIA COMPLETO DAS MELHORIAS DO SISTEMA', esq, y);
    doc.text('Página ' + doc.getNumberOfPages(), dir, y, { align: 'right' });
    y += 12;
    doc.setDrawColor(220).setLineWidth(0.5).line(esq, y, dir, y);
    y += 16;
  }
}

try {
  const logoBuf = fs.readFileSync(path.join(process.cwd(), 'public/brand/logo-orcamento.png'));
  doc.addImage('data:image/png;base64,' + logoBuf.toString('base64'), 'PNG', esq, y, 110, 52);
} catch (e) {}

doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(15, 23, 42);
doc.text('GUIA PRÁTICO DAS MELHORIAS DO SISTEMA', dir, y + 18, { align: 'right' });
doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(71, 85, 105);
doc.text('Resumo simples e direto das funcionalidades e como usar', dir, y + 32, { align: 'right' });
doc.text('Atualizado em Novembro de 2026', dir, y + 44, { align: 'right' });

y += 62;
doc.setDrawColor(15, 23, 42).setLineWidth(1.5).line(esq, y, dir, y);
y += 18;

function blocoCategoria(titulo, subtitulo, corBg = [241, 245, 249], corTexto = [15, 23, 42]) {
  checkPage(45);
  doc.setFillColor(corBg[0], corBg[1], corBg[2]);
  doc.rect(esq, y, larguraUtil, 24, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(corTexto[0], corTexto[1], corTexto[2]);
  doc.text(titulo.toUpperCase(), esq + 8, y + 14);
  if (subtitulo) {
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(corTexto[0], corTexto[1], corTexto[2]);
    doc.text(subtitulo, dir - 8, y + 14, { align: 'right' });
  }
  y += 32;
}

function cardExplicativo(icone, titulo, comoEra, comoFicou, noDiaADia) {
  checkPage(90);
  
  // Título do recurso
  doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(15, 23, 42);
  doc.text(icone + ' ' + titulo, esq + 4, y);
  y += 13;

  // Como era antes
  if (comoEra) {
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(185, 28, 28);
    doc.text('Como era:', esq + 12, y);
    doc.setFont('helvetica', 'normal').setTextColor(70, 70, 70);
    const lAntes = doc.splitTextToSize(comoEra, larguraUtil - 70);
    doc.text(lAntes, esq + 65, y);
    y += lAntes.length * 9.5 + 3;
  }

  // Como ficou agora
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(16, 120, 60);
  doc.text('Como ficou:', esq + 12, y);
  doc.setFont('helvetica', 'normal').setTextColor(20, 20, 20);
  const lAgora = doc.splitTextToSize(comoFicou, larguraUtil - 70);
  checkPage(lAgora.length * 9.5 + 20);
  doc.text(lAgora, esq + 65, y);
  y += lAgora.length * 9.5 + 3;

  // No dia a dia
  if (noDiaADia) {
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(30, 64, 175);
    doc.text('Na prática:', esq + 12, y);
    doc.setFont('helvetica', 'italic').setTextColor(50, 50, 50);
    const lPrat = doc.splitTextToSize(noDiaADia, larguraUtil - 70);
    checkPage(lPrat.length * 9.5 + 15);
    doc.text(lPrat, esq + 65, y);
    y += lPrat.length * 9.5 + 6;
  }

  doc.setDrawColor(230).setLineWidth(0.5).line(esq + 8, y, dir - 8, y);
  y += 10;
}

// -------------------------------------------------------------
// PARTE 1: FUNCIONALIDADES SOLICITADAS
// -------------------------------------------------------------
blocoCategoria(
  'Parte 1: Funcionalidades solicitadas', 
  '20 itens implementados',
  [16, 185, 129], 
  [255, 255, 255]
);

cardExplicativo(
  '1.', 
  'Arraste nos Retornos vai direto para a Produção',
  'Antes ficava confuso com a coluna \'Aguardando\' e não integrava sozinho com a oficina.',
  'Ao arrastar o orçamento nos Retornos para \'Aprovado\', ele gera a Ordem de Serviço na hora e já cria o cartão lá no quadro da Produção.',
  'Você fechou a venda, arrastou o card e os meninos da oficina já veem o serviço na hora sem você ter que recadastrar nada.'
);

cardExplicativo(
  '2.', 
  'Retornos com WhatsApp Automático',
  'Tinha que abrir o celular e digitar manualmente mensagens cobrando resposta do cliente.',
  'O sistema manda mensagem no WhatsApp quando você move de etapa e lê a resposta do cliente. Se o cliente responde que aprovou, o sistema já avisa você.',
  'Menos tempo digitando no celular e acompanhamento mais rápido das vendas.'
);

cardExplicativo(
  '3.', 
  'Envio de Arte e Confirmação do Cliente pelo Celular',
  'Tinha que mandar a foto solta no WhatsApp e torcer para o cliente confirmar direito.',
  'Criada a coluna \'Arte Enviada\' na Produção. Você anexa a foto da arte no card e o cliente recebe um link exclusivo. Ele abre, dá zoom e clica em \'Aprovar Arte\'.',
  'Assim que o cliente clica em Aprovar, o card avança sozinho para \'Impressão\' e você tem certeza formal de que a arte foi autorizada.'
);

cardExplicativo(
  '4.', 
  'Filtro \'Só com OS\' no Financeiro',
  'O financeiro misturava orçamentos que ainda eram propostas com serviços fechados de verdade.',
  'Criado um botão no topo do Financeiro chamado \'Só com OS\'.',
  'Com 1 clique você limpa a tela e enxerga apenas o dinheiro dos serviços reais fechados com Ordem de Serviço.'
);

cardExplicativo(
  '5.', 
  'E-mail da Empresa no PDF do Orçamento',
  'Aparecia e-mail pessoal ou dados desencontrados.',
  'Agora sai padronizado e profissional com o e-mail oficial da Toldos Print (contato@toldosprint.com.br).',
  'Transmite credibilidade de empresa séria para qualquer cliente ou órgão que receber o PDF.'
);

cardExplicativo(
  '6.', 
  'Validade do Orçamento de 7 Dias no PDF',
  'O cliente podia querer fechar um orçamento meses depois com preço desatualizado.',
  'O PDF agora calcula e escreve no rodapé: \'Válido por 7 dias (até dd/mm/aaaa)\'.',
  'Segurança jurídica para você reajustar valores caso os materiais subam após 7 dias.'
);

cardExplicativo(
  '7.', 
  'Garantia de 3 Meses por Serviço no PDF',
  'Não ficava claro no papel o tempo e as regras da garantia.',
  'Agora sai impresso na OS e no Contrato a garantia de 3 meses de fabricação e fixação.',
  'O cliente sabe exatamente o que cobre e você fica protegido contra trincas na parede de terceiros.'
);

cardExplicativo(
  '8.', 
  'Contrato de Serviço Enviado Automático após Assinatura',
  'O cliente assinava no celular e recebia apenas a folha resumida da OS.',
  'Agora o sistema gera o Contrato Jurídico Oficial de 8 Cláusulas com a assinatura dele e manda o arquivo em PDF direto no WhatsApp dele para guardar.',
  'O cliente recebe o contrato completo assinado sem você precisar gerar nada manualmente.'
);

cardExplicativo(
  '9.', 
  'Botão de Enviar OS com Assinatura Digital pelo WhatsApp',
  'Tinha que imprimir a folha de papel para o cliente assinar presencialmente com caneta.',
  'Você clica no botão de WhatsApp e o cliente recebe um link seguro para assinar com o próprio dedo na tela do celular.',
  'Agilidade máxima: você fecha o negócio mesmo se o cliente estiver longe ou na empresa dele.'
);

cardExplicativo(
  '10.', 
  'Excluir Produto na Gráfica Rápida',
  'Produtos ou modelos de testes ficavam presos sem ter como apagar.',
  'Colocamos o botão de lixeira com confirmação para excluir qualquer item indesejado.',
  'O catálogo fica sempre limpo só com o que você realmente vende.'
);

cardExplicativo(
  '11.', 
  'Lupa de Pesquisa nos Clientes e Nomes Sem Corte',
  'Ao selecionar cliente, nomes de empresas grandes apareciam cortados no meio.',
  'Agora tem campo de pesquisa com lupa instantânea e os nomes aparecem completos e nítidos.',
  'Fácil de achar qualquer cliente em 2 segundos mesmo se tiver centenas cadastrados.'
);

cardExplicativo(
  '12.', 
  'CPF e E-mail não obrigatórios no Cadastro de Cliente',
  'Se você não tivesse o CPF da pessoa na hora, o cadastro travava ou não deixava avançar.',
  'Agora CPF e E-mail são opcionais. Você cadastra só o nome e telefone para orçar rápido e preenche CPF depois se for parcelar no boleto ou assinar contrato.',
  'Atendimento muito mais rápido no balcão e no WhatsApp.'
);

cardExplicativo(
  '13.', 
  'Lupa de Pesquisa nos Materiais',
  'Tinha que rolar uma lista enorme procurando lonas, ACM ou metalon.',
  'Adicionada a barra de pesquisa rápida com lupa.',
  'Você digita \'Lona\' ou \'ACM\' e ele filtra na hora os materiais disponíveis.'
);

cardExplicativo(
  '14.', 
  'Editar Valor dos Acabamentos Direto em R$',
  'O acabamento usava só preço fixo de tabela, sem permitir ajuste manual.',
  'Agora você pode digitar o valor em reais (R$) diretamente no item do orçamento.',
  'Facilidade para você negociar ou aplicar um valor especial para aquele cliente.'
);

cardExplicativo(
  '15.', 
  'Precificação com Boleto, Cartão e Parcelas Calculadas no PDF',
  'O PDF só mostrava o valor total à vista, sem detalhar parcelas.',
  'O sistema calcula a entrada (ex: 50%) e as parcelas (ex: 3x no boleto ou cartão) com acréscimo ou desconto, e imprime a conta toda mastigada no PDF.',
  'O cliente abre o orçamento e já vê: \'Entrada de R$ X + 3x de R$ Y no boleto\'.'
);

cardExplicativo(
  '16.', 
  'Foto do Local (Etapa 6) Obrigatória apenas no Celular',
  'Quem estava no computador de mesa era obrigado a anexar foto do local para fechar.',
  'A obrigatoriedade foi programada apenas para quem usa no celular (onde tem câmera na mão). No computador o botão avança direto.',
  'Quem está no escritório fecha orçamentos rapidamente sem travar.'
);

cardExplicativo(
  '17.', 
  'Central do Bot e Lista de Transmissão',
  'Não havia como acompanhar o que o robô falava nem mandar aviso para vários clientes.',
  'Criada a tela /bot para acompanhar as conversas e a tela /transmissao para disparar comunicados em massa.',
  'Você tem controle total sobre o WhatsApp da empresa e pode fazer pós-venda em lote.'
);

cardExplicativo(
  '18.', 
  'Cadastro Automático de Clientes que chamam no WhatsApp',
  'Toda nova pessoa que mandava mensagem tinha que ser cadastrada à mão.',
  'O sistema agora cria a ficha do cliente sozinho assim que ele manda um \'Oi\' no WhatsApp.',
  'Banco de clientes cresce automaticamente sem retrabalho da sua equipe.'
);

cardExplicativo(
  '19.', 
  'Vitrine do Portfólio Online (/portfolio)',
  'Tinha que ficar mandando várias fotos soltas para o cliente escolher o que queria.',
  'Criada a página pública grafica-flax.vercel.app/portfolio com fotos de toldos, placas e banners.',
  'Você manda um único link bonito para o cliente olhar os modelos e escolher.'
);

cardExplicativo(
  '20.', 
  'Despesas Fixas com Card Separado no Financeiro',
  'Contas de aluguel, luz e água ficavam misturadas com gastos soltos de materiais.',
  'Agora você marca \'Despesa Fixa\' no cadastro e tem um card exclusivo no topo do Financeiro mostrando o total dessas despesas.',
  'Visão clara de quanto a empresa precisa faturar todo mês só para pagar os custos fixos.'
);

// -------------------------------------------------------------
// PARTE 2: RECURSOS EXTRAS IMPLEMENTADOS
// -------------------------------------------------------------
checkPage(40);
blocoCategoria(
  'Parte 2: Recursos extras implementados', 
  '10 melhorias complementares no sistema',
  [14, 116, 144], 
  [255, 255, 255]
);

cardExplicativo(
  '21.', 
  'Painel da Smart TV da Fábrica com Rolagem Suave sem Travamentos',
  'O painel da TV dava solavancos, cortava texto de serviços e travava em Smart TVs da LG e Samsung.',
  'Nova engenharia do auto-scroll implementada. Ele desce e sobe de forma contínua e suave, atualiza em tempo real a cada 3s e tem letras grandes que dá para ler de longe.',
  'A TV na oficina funciona o dia todo sozinha como uma esteira de produção profissional.'
);

cardExplicativo(
  '22.', 
  'Filtro dos 5 Pedidos Recentes na TV',
  'A TV ficava cheia de pedidos antigos poluindo a visão dos funcionários.',
  'Colocamos um botão rápido que filtra e mostra na TV apenas os 5 trabalhos mais recentes que chegaram.',
  'A fábrica foca imediatamente no que precisa ser produzido primeiro.'
);

cardExplicativo(
  '23.', 
  'Módulo de Lixeira e Recuperação de Exclusões (/exclusoes)',
  'Se alguém clicasse em apagar sem querer em um orçamento ou cliente, o dado sumia para sempre.',
  'Lixeira de Segurança implementada que guarda o que foi apagado, quem apagou, data e hora, com botão de \'Restaurar em 1 clique\'.',
  'Paz de espírito total: nada se perde por engano no sistema.'
);

cardExplicativo(
  '24.', 
  'Contrato Completo de Prestação de Serviços (8 Cláusulas Jurídicas)',
  'O modelo de contrato estava esquecido em um arquivo Word (.docx) no computador.',
  'O contrato foi integrado em tela oficial (/contrato) com diagramação executiva A4, logo da Toldos Print, regras do Código de Defesa do Consumidor e carimbo digital.',
  'Documento com valor jurídico formal pronto para imprimir ou mandar por PDF.'
);

cardExplicativo(
  '25.', 
  'Botão \'Ver Contrato\' nos Cards da Produção',
  'Não havia atalho rápido para abrir o contrato enquanto acompanhava o serviço na oficina.',
  'Botão verde \'Ver Contrato\' disponível em todos os cards de orçamento na tela de Produção.',
  'Com um clique no card da produção você já abre e confere o contrato assinado do cliente.'
);

cardExplicativo(
  '26.', 
  'Logo Oficial da Toldos Print em Todas as Telas de Assinatura e Arte',
  'Aparecia um quadrado preto com \'TP\' genérico que parecia site de teste.',
  'Aplicado o logo oficial colorido da Toldos Print com o WhatsApp oficial de atendimento (27) 99748-9714.',
  'O cliente que abre o link de assinatura no celular vê a marca bonita e profissional da sua gráfica.'
);

cardExplicativo(
  '27.', 
  'Telas de Relatórios, Estoque, Acabamentos e Mão de Obra 100% no Celular',
  'No celular ficava tudo espremido, tabelas quebrando e botões impossíveis de clicar.',
  'Tabelas adaptadas para cartões confortáveis de tocar com o polegar.',
  'Você consegue olhar relatórios, dar baixa em estoque ou ver custos deitado no sofá pelo celular.'
);

cardExplicativo(
  '28.', 
  'Relatórios com Filtro por Ano, Meses e Exportação para Excel (.xlsx)',
  'O relatório não permitia filtrar mês a mês e a planilha de Excel saía simples demais.',
  'Seletor de ano, botões dos 12 meses, separação de Pagos vs Pendentes e exportação para Excel com abas e formatação profissional.',
  'Se o seu contador pedir o fechamento de qualquer mês, você gera em 2 segundos.'
);

cardExplicativo(
  '29.', 
  'Fim das Linhas Pretas na Impressão do PDF',
  'Ao tentar imprimir o relatório no modo escuro, saíam faixas pretas grossas parecendo código de barras.',
  'Código de impressão ajustado: agora o documento sai 100% branco limpo, com cabeçalhos cinza suave e texto escuro nítido.',
  'Gasta pouquíssima tinta de impressora e tem acabamento executivo de diretoria.'
);

cardExplicativo(
  '30.', 
  'Sistema Funciona Mesmo Sem Internet (Modo Offline PWA)',
  'Se caísse a internet na rua ou na oficina, você não conseguia abrir nem orçar.',
  'Tecnologia offline que guarda dados no aparelho e envia tudo sozinho assim que a internet volta.',
  'O vendedor pode fazer orçamento no meio do pasto ou na obra sem sinal.'
);

// Finalização
checkPage(35);
doc.setDrawColor(200).setLineWidth(0.5).line(esq, y, dir, y);
y += 14;
doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(15, 23, 42);
doc.text('TOLDOS PRINT & COMUNICAÇÃO VISUAL — SISTEMA INTEGRADO DE GESTÃO', (esq + dir) / 2, y, { align: 'center' });
y += 11;
doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(100);
doc.text('Relatório explicativo gerado em ' + new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR'), (esq + dir) / 2, y, { align: 'center' });

const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
fs.writeFileSync(path.join(process.cwd(), 'public/relatorio-deploys-toldosprint.pdf'), pdfBuffer);
console.log('PDF Explicativo gerado com sucesso: public/relatorio-deploys-toldosprint.pdf (' + pdfBuffer.length + ' bytes)');
