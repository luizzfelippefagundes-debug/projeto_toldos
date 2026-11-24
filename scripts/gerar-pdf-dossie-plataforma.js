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
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(100, 116, 139);
    doc.text('TOLDOS PRINT — DOSSIÊ DA PLATAFORMA & PRODUTO SAAS', esq, y);
    doc.text('Página ' + doc.getNumberOfPages(), dir, y, { align: 'right' });
    y += 12;
    doc.setDrawColor(226, 232, 240).setLineWidth(0.8).line(esq, y, dir, y);
    y += 18;
  }
}

// Cabeçalho da Primeira Página
try {
  const logoBuf = fs.readFileSync(path.join(process.cwd(), 'public/brand/logo-orcamento.png'));
  doc.addImage('data:image/png;base64,' + logoBuf.toString('base64'), 'PNG', esq, y, 115, 54);
} catch (e) {}

doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(15, 23, 42);
doc.text('DOSSIÊ EXECUTIVO DA PLATAFORMA', dir, y + 16, { align: 'right' });
doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(2, 132, 199);
doc.text('ECOSSISTEMA DIGITAL & MOTOR SAAS', dir, y + 29, { align: 'right' });
doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(100, 116, 139);
doc.text('Mapeamento Completo de Funcionalidades e Potencial de Mercado', dir, y + 42, { align: 'right' });
doc.text('Novembro de 2026 • Versão 2.5 Produção', dir, y + 53, { align: 'right' });

y += 68;
doc.setDrawColor(15, 23, 42).setLineWidth(1.5).line(esq, y, dir, y);
y += 16;

// Box de Visão Geral
doc.setFillColor(248, 250, 252);
doc.setDrawColor(203, 213, 225);
doc.roundedRect(esq, y, larguraUtil, 58, 6, 6, 'FD');

doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(15, 23, 42);
doc.text('VISÃO GERAL DO PRODUTO', esq + 12, y + 18);
doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(51, 65, 85);
const resumoGeral = 'A plataforma é um ecossistema integrado que une Loja Online com Simulador Inteligente de Toldos, Robô Comercial no WhatsApp com IA, Orçamentador Paramétrico de Fábrica, Experiência Digital do Cliente (Aprovação de Arte e Assinatura sem login) e Chão de Fábrica (PCP / Kanban / TV). 100% web, moderna e pronta para expansão.';
const linhasResumo = doc.splitTextToSize(resumoGeral, larguraUtil - 24);
doc.text(linhasResumo, esq + 12, y + 32);
y += 72;

function secaoTitulo(numero, titulo, tag) {
  checkPage(50);
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(esq, y, larguraUtil, 24, 4, 4, 'F');
  
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(255, 255, 255);
  doc.text(`${numero}. ${titulo.toUpperCase()}`, esq + 10, y + 15);
  
  if (tag) {
    doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(56, 189, 248);
    doc.text(tag.toUpperCase(), dir - 10, y + 15, { align: 'right' });
  }
  y += 32;
}

function cardFuncionalidade(nome, desc, beneficios = []) {
  // Pré-calcula a altura exata
  doc.setFont('helvetica', 'normal').setFontSize(8);
  const linhasDesc = doc.splitTextToSize(desc, larguraUtil - 24);
  
  let alturaBeneficios = 0;
  const listaLinhasBeneficios = [];
  for (const b of beneficios) {
    const l = doc.splitTextToSize(b, larguraUtil - 32);
    listaLinhasBeneficios.push(l);
    alturaBeneficios += l.length * 11 + 3;
  }

  const alturaTotal = 26 + (linhasDesc.length * 10) + alturaBeneficios + 8;
  checkPage(alturaTotal + 6);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(esq, y, larguraUtil, alturaTotal, 4, 4, 'FD');

  // Marcador lateral
  doc.setFillColor(2, 132, 199);
  doc.rect(esq, y, 4, alturaTotal, 'F');

  doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(15, 23, 42);
  doc.text(nome, esq + 12, y + 14);

  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(71, 85, 105);
  doc.text(linhasDesc, esq + 12, y + 26);

  let by = y + 26 + (linhasDesc.length * 10) + 4;
  for (const linhasB of listaLinhasBeneficios) {
    // Marcador redondo verde elegante
    doc.setFillColor(16, 185, 129);
    doc.circle(esq + 16, by - 2.5, 2, 'F');

    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(51, 65, 85);
    doc.text(linhasB, esq + 24, by);
    by += (linhasB.length * 11) + 3;
  }

  y += alturaTotal + 8;
}

// 1. LOJA ONLINE & SIMULADOR INTELIGENTE
secaoTitulo('1', 'Loja Online & Simulador Paramétrico de Toldos', 'B2C / B2B / Vendas');
cardFuncionalidade(
  'Calculadora Paramétrica de Toldos em Tempo Real',
  'Permite que o cliente ou parceiro comercial simule na hora orçamentos de toldos e coberturas diretamente pelo navegador.',
  [
    'Cálculo automático de área (m²), metragem de tubos e lona por modelo (Cortina de Enrolar, Fixo, Policarbonato).',
    'Seleção de acessórios e opcionais: visor cristal transparente, braços, acionamento manual por manivela ou motorizado.',
    'Carrinho com checkout instantâneo que gera e envia o pedido pronto para o WhatsApp da empresa.',
    'Elimina a dependência de visita técnica prévia apenas para passar estimativa de preço.'
  ]
);

cardFuncionalidade(
  'Catálogo Completo de Comunicação Visual & Portfólio Digital',
  'Vitrine interativa de produtos da gráfica rápida e serviços sob medida com galeria de fotos de alta resolução.',
  [
    'Produtos cadastrados: Fachadas de ACM, Letras 3D/Caixa, Placas de identificação, Banners, Faixas e Adesivos.',
    'Portfólio público (/portfolio) com filtros por categoria de serviço para validação e autoridade da marca.',
    'Cálculo e orçamento rápido de serviços expressos diretamente online.'
  ]
);

// 2. ROBÔ DE WHATSAPP COM IA
secaoTitulo('2', 'Robô de Atendimento WhatsApp 24/7 (IA & Regras)', 'Atendimento & Triagem');
cardFuncionalidade(
  'Motor Híbrido de Atendimento com Triagem Inteligente',
  'Atendimento contínuo 24 horas por dia conectado à API oficial do WhatsApp com resposta instantânea e humanizada.',
  [
    'Reconhece automaticamente se o número é de um cliente já cadastrado ou um novo contato.',
    'Menu interativo que direciona o cliente entre Toldos e Coberturas ou Comunicação Visual e Fachadas.',
    'Coleta inteligente de medidas, ambiente de instalação (varanda, garagem, fachada) e intenção de compra.',
    'Respeito rigoroso aos horários comerciais com respostas automáticas e anti-flood aos fins de semana e noites.'
  ]
);

cardFuncionalidade(
  'Resumo Analítico da Demanda para o Vendedor (Notificação Prioritária)',
  'Ao transferir para o atendente humano, o robô não manda apenas a última frase crua do cliente.',
  [
    'Analisa todo o histórico da conversa e sintetiza: Produto + Medidas + Ambiente + Opcionais em destaque.',
    'Dispara notificação push/alerta direto no WhatsApp do vendedor (+55 27 99748-8023) com os dados mastigados.',
    'O vendedor entra na conversa sabendo exatamente o que o cliente quer, acelerando o fechamento.'
  ]
);

// 3. ERP COMERCIAL E ORÇAMENTADOR TÉCNICO
secaoTitulo('3', 'ERP Comercial & Orçamentador Técnico de Fábrica', 'Gestão Comercial');
cardFuncionalidade(
  'Orçamentação Paramétrica de Precisão e Proposta em PDF',
  'Motor de cálculo interno que divide o preço em insumos, mão de obra e margem de contribuição com extrema exatidão.',
  [
    'Cálculo por m², metro linear de ferro/alumínio, perda de chapa e tempo estimado de fabricação.',
    'Geração instantânea de Proposta Comercial em PDF profissional com logo oficial, validade e condições de pagamento.',
    'Trava de aprovação do dono para propostas vindas do robô de WhatsApp antes de fechar contrato.',
    'Módulo de Pedidos Rápidos para balcão de gráfica com emissão de canhoto e cupom térmico.'
  ]
);

cardFuncionalidade(
  'Gestão de Retornos & Follow-Up Ativo de Vendas',
  'Painel dedicado ao vendedor para monitorar propostas em aberto e não perder oportunidades de negócio.',
  [
    'Alerta visual e contagem de dias desde o último contato com o cliente.',
    'Botão de ação rápida para chamar no WhatsApp com mensagem de acompanhamento personalizada.',
    'Métricas de taxa de conversão comercial entre propostas enviadas e contratos fechados.'
  ]
);

// 4. EXPERIÊNCIA DIGITAL DO CLIENTE
secaoTitulo('4', 'Experiência Digital do Cliente (Sem Fricção)', 'Mobile-First / Sem Login');
cardFuncionalidade(
  'Página Pública de Aprovação de Arte Online (/arte/[id])',
  'O cliente recebe um link exclusivo por WhatsApp e aprova o layout diretamente no celular com total conveniência.',
  [
    'Acesso público sem necessidade de senha ou cadastro para não criar atrito com o cliente.',
    'Visualização da arte em alta definição com ferramenta de zoom para conferência minuciosa.',
    'Aprovação formal com 1 clique que atualiza o sistema e move o pedido direto para a fila de Impressão.',
    'Botão de solicitação de ajuste que abre o WhatsApp do designer já com a mensagem contextualizada.'
  ]
);

cardFuncionalidade(
  'Assinatura Digital de Contrato e OS (/assinar/[token])',
  'Formalização jurídica digital com coleta de assinatura na tela do smartphone.',
  [
    'Contrato completo com termos legais, prazo de execução, cláusulas de cancelamento e garantia contratual de 3 meses.',
    'Campo para preenchimento de CPF ou CNPJ com validação e máscara automática.',
    'Coleta de assinatura manuscrita na tela (touchscreen) com carimbo de data, horário exato e IP.',
    'Gera Ordem de Serviço vinculada com histórico inalterável para segurança da empresa e do cliente.'
  ]
);

cardFuncionalidade(
  'Pagamento Pix Integrado Mercado Pago com Baixa Automática',
  'Integração financeira direta com o checkout transparente do Mercado Pago.',
  [
    'Gera QR Code Pix dinâmico e chave Copia e Cola na própria Ordem de Serviço.',
    'Flexibilidade para o cliente pagar a entrada de 50% ou o valor total com desconto.',
    'Webhook automático que detecta o pagamento em segundos e altera o status sem conferência manual de comprovante.'
  ]
);

// 5. CHÃO DE FÁBRICA & PRODUÇÃO
secaoTitulo('5', 'PCP, Chão de Fábrica & Ficha de Instrução Técnica', 'Produção & Qualidade');
cardFuncionalidade(
  'Kanban Visual de Fábrica e Painel TV (/tv)',
  'Controle visual do fluxo de fabricação que organiza a equipe sem papelada perdida ou retrabalho.',
  [
    'Colunas do fluxo: Aprovado -> Criação de Arte -> Aguardando Confirmação -> Impressão -> Acabamento -> Instalação.',
    'Arraste de cards (drag and drop) intuitivo que atualiza o status em tempo real.',
    'Painel TV dedicado (/tv) com tema escuro para ser exibido em Smart TVs na parede da oficina/fábrica.'
  ]
);

cardFuncionalidade(
  'Ficha de Instrução de Bancada para Impressão',
  'Documento técnico impresso entregue aos soldadores e montadores na bancada de fabricação.',
  [
    'Medidas exatas para produção em destaque tipográfico gigante para conferência com trena (Largura x Altura).',
    'Especificações do material, tubo estrutural, lona, cor e acabamento.',
    'Checklist de Controle de Qualidade (QC): Medidas no esquadro, Solda/Acabamento OK, Limpeza e sem riscos.',
    'Espaço para assinatura e visto do operador responsável e conferência final do Kaio.'
  ]
);

// 6. FINANCEIRO & ADMINISTRAÇÃO
secaoTitulo('6', 'Gestão Financeira & Auditoria Administrativa', 'Financeiro & Segurança');
cardFuncionalidade(
  'Controle Financeiro, Recibos e Auditoria',
  'Controle completo das finanças da empresa com emissão de documentos oficiais e registro de ações.',
  [
    'Contas a pagar e receber com controle de fluxo, parcelas e alertas de vencimento.',
    'Emissão de Recibos formais em PDF com numeração sequencial e assinatura.',
    'DRE e relatórios de lucratividade real por tipo de produto e linha de produção.',
    'Histórico de exclusões e auditoria detalhada (registra quem alterou ou cancelou orçamentos e pedidos).'
  ]
);

// 7. POTENCIAL DE ESCALA SAAS
secaoTitulo('7', 'O Potencial de Escala: Da Fábrica para o Mercado SaaS', 'Estratégia & Negócios');
cardFuncionalidade(
  'Como este software se torna um produto escalável (SaaS White Label)',
  'A inteligência mais complexa e as regras do setor já foram criadas, testadas e validadas no dia a dia da Toldos Print.',
  [
    'Arquitetura em Nuvem Serverless: Roda em Next.js 16 + Neon PostgreSQL + Vercel, garantindo escalabilidade ilimitada e custo fixo mínimo.',
    'Potencial White Label: Outras fábricas de toldos e serralherias podem assinar o sistema com sua própria marca, cores e catálogo.',
    'Modelo de Assinatura Recorrente (MRR): Mensalidades de R$ 290 a R$ 890 por fábrica assinante, gerando receita previsível.',
    'Diferencial Competitivo Único: Nenhum ERP genérico de mercado entende de corte de lona, acionamento de toldo cortina e cálculo de policarbonato como este.'
  ]
);

cardFuncionalidade(
  'Roadmap Rápido para Comercialização como SaaS (3 Passos)',
  'O caminho técnico para plugar os primeiros 10 clientes e começar a monetizar:',
  [
    '1. Multi-Tenant no Banco: Adição do identificador de empresa (empresa_id) nas tabelas existentes.',
    '2. Painel de Customização da Marca: Interface para cada assinante subir sua logo, cadastrar sua chave Pix e número de WhatsApp.',
    '3. Checkout de Assinatura Recorrente: Cobrança automática mensal via cartão de crédito ou Pix através do Mercado Pago / Stripe.'
  ]
);

// Rodapé da última página
checkPage(48);
doc.setFillColor(241, 245, 249);
doc.setDrawColor(203, 213, 225);
doc.roundedRect(esq, y, larguraUtil, 36, 4, 4, 'FD');
doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(15, 23, 42);
doc.text('TOLDOS PRINT & COMUNICAÇÃO VISUAL • PRODUTO DE TECNOLOGIA PROPRIETÁRIA', esq + 12, y + 14);
doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(100, 116, 139);
doc.text('Documento gerado automaticamente pelo sistema operacional da empresa. Todos os módulos descritos estão ativos e em produção.', esq + 12, y + 25);

const outPublic = path.join(process.cwd(), 'public/apresentacao-plataforma-toldosprint.pdf');
const outArtifact = path.join('/home/luiz-felippe/.gemini/antigravity/brain/27184ae0-116c-4d76-9718-c33e294acc51/apresentacao-plataforma-toldosprint.pdf');

const pdfBytes = doc.output('arraybuffer');
fs.writeFileSync(outPublic, Buffer.from(pdfBytes));
try {
  fs.writeFileSync(outArtifact, Buffer.from(pdfBytes));
} catch (e) {}

console.log('PDF gerado com sucesso!');
console.log('Public:', outPublic);
console.log('Total de páginas:', doc.getNumberOfPages());
