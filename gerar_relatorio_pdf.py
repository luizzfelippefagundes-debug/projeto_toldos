import subprocess
import os

html_content = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Toldos Print - Relatório Executivo e Manual Operacional do Sistema</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    
    @page {
      size: A4;
      margin: 15mm 15mm 18mm 15mm;
      @bottom-right {
        content: counter(page);
      }
    }
    
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1e293b;
      line-height: 1.55;
      font-size: 11pt;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }

    .capa {
      height: 98vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 2px solid #0f172a;
      border-radius: 12px;
      padding: 50px 40px;
      page-break-after: always;
      background: linear-gradient(145deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
    }

    .capa-header {
      border-bottom: 2px solid #38bdf8;
      padding-bottom: 25px;
    }

    .capa-badge {
      display: inline-block;
      background: #ea580c;
      color: #ffffff;
      font-weight: 700;
      font-size: 11pt;
      padding: 6px 14px;
      border-radius: 30px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 15px;
    }

    .capa-title {
      font-size: 32pt;
      font-weight: 800;
      line-height: 1.15;
      margin: 0 0 10px 0;
      color: #ffffff;
    }

    .capa-subtitle {
      font-size: 16pt;
      font-weight: 400;
      color: #94a3b8;
      margin: 0;
    }

    .capa-body {
      margin: 40px 0;
    }

    .capa-desc {
      font-size: 13pt;
      color: #cbd5e1;
      max-width: 600px;
      line-height: 1.6;
    }

    .capa-info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 20px;
      margin-top: 30px;
    }

    .capa-info-item label {
      display: block;
      font-size: 9pt;
      text-transform: uppercase;
      color: #38bdf8;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .capa-info-item span {
      font-size: 12pt;
      font-weight: 600;
      color: #ffffff;
    }

    .capa-footer {
      border-top: 1px solid rgba(255, 255, 255, 0.15);
      padding-top: 20px;
      display: flex;
      justify-content: space-between;
      font-size: 10pt;
      color: #94a3b8;
    }

    .page-break {
      page-break-after: always;
    }

    h1, h2, h3, h4 {
      color: #0f172a;
      font-weight: 700;
      margin-top: 1.6em;
      margin-bottom: 0.6em;
      page-break-after: avoid;
    }

    h1 {
      font-size: 20pt;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 8px;
      margin-top: 0;
    }

    h2 {
      font-size: 15pt;
      color: #1e3a8a;
      border-left: 4px solid #2563eb;
      padding-left: 10px;
      margin-top: 1.4em;
    }

    h3 {
      font-size: 12pt;
      color: #334155;
      margin-top: 1.2em;
    }

    p {
      margin: 0.6em 0;
      text-align: justify;
    }

    ul, ol {
      margin: 0.6em 0 1em 1.5em;
      padding: 0;
    }

    li {
      margin-bottom: 0.4em;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 8.5pt;
      font-weight: 700;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-green { background: #d1fae5; color: #065f46; }
    .badge-orange { background: #ffedd5; color: #9a3412; }
    .badge-red { background: #fee2e2; color: #991b1b; }
    .badge-purple { background: #f3e8ff; color: #6b21a8; }

    .card-box {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 8px;
      padding: 14px 18px;
      margin: 14px 0;
      page-break-inside: avoid;
    }

    .card-alert {
      border-left: 4px solid #ef4444;
      background: #fef2f2;
      color: #991b1b;
    }

    .card-success {
      border-left: 4px solid #10b981;
      background: #f0fdf4;
      color: #065f46;
    }

    .card-highlight {
      border-left: 4px solid #2563eb;
      background: #eff6ff;
      color: #1e40af;
    }

    .card-warning {
      border-left: 4px solid #f59e0b;
      background: #fffbeb;
      color: #92400e;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 9.5pt;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 10px;
      text-align: left;
    }

    th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
    }

    tr:nth-child(even) {
      background: #f8fafc;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin: 16px 0;
      page-break-inside: avoid;
    }

    .summary-box {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
      background: #ffffff;
    }

    .summary-box .num {
      font-size: 22pt;
      font-weight: 800;
      color: #2563eb;
      line-height: 1;
      margin-bottom: 4px;
    }

    .summary-box .label {
      font-size: 8.5pt;
      font-weight: 600;
      text-transform: uppercase;
      color: #64748b;
    }

    .role-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 14px 0;
      page-break-inside: avoid;
    }

    .role-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
    }

    .role-card h4 {
      margin: 0 0 6px 0;
      font-size: 11pt;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .role-card p {
      font-size: 9.5pt;
      margin: 0;
      color: #475569;
    }

    .step-list {
      counter-reset: step-counter;
      list-style: none;
      margin: 12px 0;
      padding: 0;
    }

    .step-list li {
      counter-increment: step-counter;
      position: relative;
      padding-left: 36px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }

    .step-list li::before {
      content: counter(step-counter);
      position: absolute;
      left: 0;
      top: 0;
      width: 26px;
      height: 26px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 50%;
      text-align: center;
      line-height: 26px;
      font-size: 10pt;
      font-weight: 700;
    }

    .footer-note {
      font-size: 8.5pt;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      margin-top: 30px;
      text-align: center;
    }
  </style>
</head>
<body>

  <!-- CAPA -->
  <div class="capa">
    <div class="capa-header">
      <span class="capa-badge">Documento Oficial de Alinhamento</span>
      <h1 class="capa-title">TOLDOS PRINT</h1>
      <p class="capa-subtitle">Sistema Integrado de Gestão Comercial, Fábrica e Telão</p>
    </div>

    <div class="capa-body">
      <p class="capa-desc">
        Relatório consolidado de todas as implementações realizadas entre <strong>11 e 20 de Novembro de 2026</strong> (133 commits e dezenas de módulos novos), acompanhado do <strong>Manual Completo de Operação</strong> para alinhamento estratégico da equipe e liderança de produção.
      </p>

      <div class="capa-info-grid">
        <div class="capa-info-item">
          <label>Data da Reunião</label>
          <span>20 de Novembro de 2026</span>
        </div>
        <div class="capa-info-item">
          <label>Objetivo</label>
          <span>Alinhamento Geral & Treinamento</span>
        </div>
        <div class="capa-info-item">
          <label>Público Alvo</label>
          <span>Diretoria, Kaio (Produção), Colaboradores</span>
        </div>
        <div class="capa-info-item">
          <label>Escopo</label>
          <span>Loja Virtual, Fábrica, Telão, WhatsApp & Finanças</span>
        </div>
      </div>
    </div>

    <div class="capa-footer">
      <span>Toldos Print & Comunicação Visual</span>
      <span>Confidencial • Uso Interno</span>
    </div>
  </div>

  <!-- PÁGINA 1: RESUMO EXECUTIVO & NÚMEROS -->
  <div>
    <h1>1. Resumo Executivo da Evolução (11 a 20 de Novembro)</h1>
    <p>
      Durante os últimos 10 dias de desenvolvimento contínuo, a plataforma da <strong>Toldos Print</strong> passou por uma transformação completa de ponta a ponta. O foco saiu de um simples sistema de controle interno e evoluiu para um ecossistema operacional integrado, conectando <strong>Loja Online, WhatsApp Automatizado, Gestão Comercial (CRM), Chão de Fábrica (com Telão de TV) e Controle Financeiro</strong>.
    </p>

    <div class="summary-grid">
      <div class="summary-box">
        <div class="num">133</div>
        <div class="label">Commits Entregues</div>
      </div>
      <div class="summary-box">
        <div class="num">100%</div>
        <div class="label">Mobile Responsivo</div>
      </div>
      <div class="summary-box">
        <div class="num">275</div>
        <div class="label">Testes Automatizados</div>
      </div>
    </div>

    <h2>Destaques Principais das Implementações</h2>
    <ul>
      <li><strong>Nova Loja Virtual & APIs Públicas:</strong> Catálogo inteligente de toldos, lonas, ACM e adesivos com gerador de orçamento conectado ao cadastro do cliente e cálculo automático de preço e fechamento.</li>
      <li><strong>Chão de Fábrica Ultralimpo para Colaboradores:</strong> Segregação de papéis. Operadores não visualizam mais valores financeiros nem burocracias de contrato; contam com botão de 1 toque para indicar peça pronta e canal direto para relatar alertas/retrabalhos.</li>
      <li><strong>Telão de TV da Produção em Tempo Real:</strong> Sincronização a cada 3 segundos, auto-scroll inteligente para Smart TVs, exibição de recados da oficina, alertas de prioridade e modo mobile para visualização no bolso.</li>
      <li><strong>Automação WhatsApp & Evolution API:</strong> Conexão via código de pareamento numérico de 8 dígitos, reconhecimento instantâneo de clientes sem repetir perguntas, envio automático de PDFs oficiais de Orçamento, Contrato e Recibo de Pagamento.</li>
      <li><strong>Financeiro com Baixa Flexível e Recibo Oficial:</strong> Geração de PDF profissional de recibo assinado no servidor com 1 clique para envio no WhatsApp do cliente com comprovação de pagamento.</li>
      <li><strong>CRM de Retornos e Notificações Inteligentes:</strong> Alertas em tempo real divididos por categorias (Fábrica, Produção, Comercial e TV), com histórico, exclusão individual e restauração segura.</li>
    </ul>

    <div class="card-box card-highlight">
      <strong>Diretriz Estratégica da Reunião de Hoje:</strong><br>
      Cada membro da equipe deve entender exatamente o seu papel no sistema. O sistema foi desenhado para eliminar retrabalho, evitar perda de materiais, garantir que o cliente seja atendido em segundos pelo WhatsApp e que o telão da fábrica mostre a verdade do chão de fábrica sem atrasos.
    </div>
  </div>

  <div class="page-break"></div>

  <!-- PÁGINA 2: ESTRUTURA DE PAPÉIS & PERMISSÕES -->
  <div>
    <h1>2. Estrutura de Papéis e Perfis de Acesso</h1>
    <p>
      Para garantir a segurança dos dados financeiros e ao mesmo tempo simplificar a vida dos operadores no chão de fábrica, o sistema opera sob uma matriz rígida de permissões:
    </p>

    <div class="role-grid">
      <div class="role-card">
        <h4>👑 Dono / Administrador</h4>
        <p>Acesso irrestrito a todas as áreas: faturamento, relatórios, equipe, estoque, central de transmissão, bot e configurações mestras.</p>
      </div>
      <div class="role-card">
        <h4>💰 Financeiro</h4>
        <p>Gestão de contas a pagar/receber, conciliação de boletos, emissão e envio de recibos no WhatsApp, controle de caixa e relatórios fiscais.</p>
      </div>
      <div class="role-card">
        <h4>💼 Vendedor / Atendimento</h4>
        <p>Criação de orçamentos, acompanhamento do Kanban de retornos, envio de artes e contratos para assinatura do cliente.</p>
      </div>
      <div class="role-card">
        <h4>🛠️ Kaio (Líder de Produção)</h4>
        <p>Visão de gestão da produção, priorização de fila (1º lugar), aprovação de CQ com fotos, resolução de problemas e disparo de comunicados no telão.</p>
      </div>
    </div>

    <div class="card-box card-success">
      <h3 style="margin-top:0; color:#065f46;">👷 Papel do Colaborador (Chão de Fábrica)</h3>
      <p style="margin: 4px 0 0 0;">
        <strong>Totalmente blindado e simplificado:</strong> O colaborador acessa a produção pelo celular ou tablet e enxerga <em>exclusivamente</em>:
      </p>
      <ul style="margin: 6px 0 0 18px;">
        <li>Número da OS e Nome do Cliente;</li>
        <li>Medidas exatas da peça (Largura × Altura) e Material em destaque;</li>
        <li>Instruções técnicas e observações de confecção/instalação;</li>
        <li><strong>Botão Verde: "Marcar como Peça Pronta"</strong> (1 toque para avisar o Kaio e mover o fluxo);</li>
        <li><strong>Botão Vermelho: "Relatar Problema na Peça"</strong> (emite alerta sonoro/visual imediato para o Kaio e para a TV).</li>
        <li><em>Não vê valores em R$, dados financeiros de margem ou contratos comerciais.</em></li>
      </ul>
    </div>

    <h2>Matriz de Permissões por Tela</h2>
    <table>
      <thead>
        <tr>
          <th>Módulo / Tela</th>
          <th>Dono</th>
          <th>Financeiro</th>
          <th>Vendedor</th>
          <th>Líder Produção</th>
          <th>Colaborador</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Dashboard & Métricas</td>
          <td>Sim (Total)</td>
          <td>Sim (Parcial)</td>
          <td>Sim (Vendas)</td>
          <td>Sim (Produção)</td>
          <td>Não</td>
        </tr>
        <tr>
          <td>Novo Orçamento / Retornos</td>
          <td>Sim</td>
          <td>Não</td>
          <td>Sim</td>
          <td>Sim</td>
          <td>Não</td>
        </tr>
        <tr>
          <td>Esteira de Produção (/producao)</td>
          <td>Completa</td>
          <td>Completa</td>
          <td>Apenas Leitura</td>
          <td>Completa (Gestão)</td>
          <td>Modo Ultralimpo</td>
        </tr>
        <tr>
          <td>Telão TV (/tv)</td>
          <td>Sim</td>
          <td>Sim</td>
          <td>Sim</td>
          <td>Sim</td>
          <td>Sim (Sem Assinatura)</td>
        </tr>
        <tr>
          <td>Financeiro & Recibos</td>
          <td>Sim</td>
          <td>Sim</td>
          <td>Não</td>
          <td>Não</td>
          <td>Não</td>
        </tr>
        <tr>
          <td>WhatsApp Bot & Transmissão</td>
          <td>Sim</td>
          <td>Não</td>
          <td>Parcial</td>
          <td>Não</td>
          <td>Não</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="page-break"></div>

  <!-- PÁGINA 3: MÓDULO DA LOJA & VENDAS ONLINE -->
  <div>
    <h1>3. Módulo Loja Virtual & Integração de Catálogo</h1>
    <p>
      Implementamos uma infraestrutura de e-commerce e catálogo de orçamentos online para que os clientes da Toldos Print possam simular e solicitar serviços diretamente pelo site da gráfica:
    </p>

    <div class="card-box card-highlight">
      <h3 style="margin-top:0;">Como Funciona o Fluxo da Loja Virtual:</h3>
      <ol style="margin-left: 20px;">
        <li><strong>Catálogo Online Dinâmico (<code>/api/loja/catalogo</code>):</strong> O site consome os materiais, acabamentos e produtos cadastrados no sistema (toldos fixos/retráteis, lonas, letras caixa, adesivos, banners).</li>
        <li><strong>Cálculo Automático de Metragem e Estimativa:</strong> Ao digitar a largura e altura no site, a API calcula a área quadrada, aplica os coeficientes de material e mão de obra e exibe um valor estimado preliminar ao cliente.</li>
        <li><strong>Pedido de Orçamento Conectado (<code>/api/loja/pedidos</code>):</strong> O cliente preenche seus dados (nome, WhatsApp, cidade). O sistema localiza se ele já existe na base de clientes ou cria um registro com a tag <code>Origem: Loja Virtual</code>.</li>
        <li><strong>Entrada Direta no CRM de Retornos:</strong> O pedido cai instantaneamente na coluna de <em>Aguardando Retorno</em> do sistema, com a data de fechamento estimada, acendendo o sininho do vendedor para fazer o contato imediato.</li>
      </ol>
    </div>

    <h2>Benefícios Implementados para a Loja:</h2>
    <ul>
      <li><strong>Sem Duplicidade de Cadastro:</strong> O sistema checa pelo número de WhatsApp antes de cadastrar um novo cliente, unificando o histórico de compras.</li>
      <li><strong>Agilidade Comercial:</strong> O vendedor não precisa digitar medidas ou materiais na mão: o pedido do site já chega com os itens configurados.</li>
      <li><strong>Conversão Aumentada:</strong> O cliente tem a resposta de preço quase imediata, gerando o gatilho para o fechamento.</li>
    </ul>

    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">

    <h1>4. WhatsApp Bot, Atendimento e Transmissão</h1>
    <p>
      O motor de WhatsApp foi totalmente reformulado utilizando a Evolution API, trazendo inteligência artificial e alta disponibilidade:
    </p>

    <div class="card-box card-warning">
      <h3 style="margin-top:0;">Inovações no WhatsApp:</h3>
      <ul>
        <li><strong>Conexão por Código de 8 Dígitos (Pareamento Remoto):</strong> Não depende apenas de escanear QR Code pela câmera. É possível digitar o código de 8 dígitos no celular de qualquer lugar para conectar o WhatsApp da empresa.</li>
        <li><strong>Reconhecimento Automático de Clientes:</strong> Se o número já estiver na base ou na agenda, o robô chama o cliente pelo nome próprio e não fica perguntando nome/cidade toda vez que ele mandar mensagem.</li>
        <li><strong>Prevenção de Ruído na Base:</strong> Curiosos que mandam "oi" ou mensagens soltas não poluem a lista de clientes. O cadastro só é efetivado quando há intenção real de orçamento ou pedido.</li>
        <li><strong>Disparo de Documentos Oficiais em PDF:</strong> O sistema gera e envia o PDF real de Contratos, Ordens de Serviço e Recibos de Pagamento diretamente no chat do cliente.</li>
        <li><strong>Transmissão em Massa com Mídia:</strong> O painel de <code>/transmissao</code> permite selecionar segmentos de clientes e disparar fotos do portfólio de toldos e banners com link e texto personalizado.</li>
      </ul>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- PÁGINA 4: CHÃO DE FÁBRICA & ESTEIRA DE PRODUÇÃO -->
  <div>
    <h1>5. Esteira de Produção & Chão de Fábrica</h1>
    <p>
      O coração operacional da Toldos Print é a tela de <strong>Produção (<code>/producao</code>)</strong>. Ela gerencia o fluxo de trabalho desde a aprovação até a entrega.
    </p>

    <h2>O Fluxo Oficial das 8 Etapas da Produção</h2>
    <table>
      <thead>
        <tr>
          <th>Etapa</th>
          <th>Responsável</th>
          <th>Ação Exigida</th>
          <th>Visível na TV?</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>1. Aprovado / Produção</strong></td>
          <td>Kaio / Vendedor</td>
          <td>Orçamento aprovado. Inicia preparação técnica e fila de trabalho.</td>
          <td>Sim</td>
        </tr>
        <tr>
          <td><strong>2. Arte Enviada</strong></td>
          <td>Designer / Kaio</td>
          <td>Arte criada e enviada ao cliente com link público de aprovação.</td>
          <td>Sim</td>
        </tr>
        <tr>
          <td><strong>3. Ag. Confirmação</strong></td>
          <td>Vendedor</td>
          <td>Aguardando cliente validar a prova visual da arte.</td>
          <td>Sim</td>
        </tr>
        <tr>
          <td><strong>4. Impressão / Solda</strong></td>
          <td>Colaborador</td>
          <td>Peça em máquina de impressão ou confecção de lona/estrutura.</td>
          <td>Sim</td>
        </tr>
        <tr>
          <td><strong>5. Acabamento</strong></td>
          <td>Colaborador</td>
          <td>Solda, ilhós, costura, colocação de perfis ou pintura de ferragem.</td>
          <td>Sim</td>
        </tr>
        <tr>
          <td><strong>6. Controle Qualidade (QC)</strong></td>
          <td>Kaio / Líder</td>
          <td>Checklist de medidas e foto obrigatória da peça finalizada.</td>
          <td>Sim</td>
        </tr>
        <tr>
          <td><strong>7. Pronto p/ Retirada/Inst.</strong></td>
          <td>Expedição</td>
          <td>Peça pronta embalada. Aguardando cliente retirar ou equipe ir instalar.</td>
          <td>Sim</td>
        </tr>
        <tr>
          <td><strong>8. Entregue / Finalizado</strong></td>
          <td>Financeiro / Dono</td>
          <td>Instalação concluída e saldo restante quitado.</td>
          <td>Não (Arquivo)</td>
        </tr>
      </tbody>
    </table>

    <h2>Inovações Críticas Feitas na Produção</h2>
    <div class="card-box card-alert">
      <h3 style="margin-top:0;">🚨 Sistema de Alerta de Problemas / Retrabalho:</h3>
      <p>
        Quando um colaborador encontra um problema na confecção (ex: solda rasgou, ferragem torta, cliente pediu alteração de medida de última hora):
      </p>
      <ol style="margin-left: 20px;">
        <li>Ele clica em <strong>"Relatar Problema"</strong> no card e escolhe o motivo (Retrabalho, Medida Errada, etc.) + detalhe.</li>
        <li>O card ganha uma <strong>borda vermelha viva e tarja de alerta pulsante</strong> com o texto do problema.</li>
        <li>O <strong>Sininho de Notificações do Kaio e do Dono acende</strong> com aviso de fábrica imediato.</li>
        <li>No <strong>Telão da TV</strong>, a peça fica destacada com aviso prioritário para que a oficina saiba o que está travado.</li>
        <li>Ao resolver, o Kaio clica em <strong>"Resolver ✓"</strong> e o alerta é limpo, voltando a peça ao fluxo normal.</li>
      </ol>
    </div>

    <div class="card-box card-highlight">
      <h3 style="margin-top:0;">ℹ️ Modal "Mais Detalhes" Unificado:</h3>
      <p>
        Para não poluir o card da produção com textos quebrados e datas espremidas, foi criado o botão <strong>"Mais Detalhes"</strong>. Ao clicar, abre uma ficha técnica completa contendo:
      </p>
      <ul style="margin-left: 18px;">
        <li>Data de fechamento/emissão com relógio;</li>
        <li>Tipo de serviço (Serviço + material ou Orçamento simples);</li>
        <li>Status do contrato (✓ Assinado ou ⏳ Ag. Assinatura);</li>
        <li>Botões diretos para abrir a <strong>Ordem de Serviço em PDF</strong> e o <strong>Contrato de Assinatura</strong> em nova aba.</li>
      </ul>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- PÁGINA 5: TELÃO DA FÁBRICA & NOTIFICAÇÕES -->
  <div>
    <h1>6. Telão da Fábrica (Painel TV - <code>/tv</code>)</h1>
    <p>
      O telão instalado na parede da oficina é a bússola visual de todos os funcionários. Ele foi projetado para operar sem necessidade de teclado ou mouse:
    </p>

    <ul>
      <li><strong>Auto-Scroll Contínuo & Estável:</strong> A tela desce e sobe suavemente sem cortes, permitindo a visualização de dezenas de pedidos mesmo em Smart TVs comuns.</li>
      <li><strong>Tipografia de Alta Visibilidade:</strong> Letras grandes, contraste aprimorado, medidas e materiais em destaque para leitura nítida a 10 metros de distância.</li>
      <li><strong>Central do Telão (<code>/avisos-tv</code>):</strong> Permite que a gerência digite avisos urgentes (ex: "Limpeza da oficina dia 19", "Cuidado com corte do toldo do Clayton"). Esses recados passam num letreiro rotativo no topo do telão.</li>
      <li><strong>Disparo no WhatsApp da Fábrica:</strong> Pela Central do Telão, com 1 clique é possível enviar o mesmo comunicado diretamente no WhatsApp de todos os funcionários cadastrados na equipe de produção.</li>
    </ul>

    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">

    <h1>7. Gestão Financeira & Recibos Automáticos</h1>
    <p>
      O módulo financeiro (<code>/financeiro</code>) foi desenhado para eliminar a inadimplência e facilitar a prestação de contas com o cliente:
    </p>

    <div class="card-box card-success">
      <h3 style="margin-top:0;">Funcionalidades do Financeiro:</h3>
      <ul>
        <li><strong>Baixa Flexível com Abatimento Automático:</strong> Quando o cliente paga uma entrada (ex: 50%), o sistema dá baixa no valor recebido e recalcula instantaneamente o saldo devedor restante da Ordem de Serviço.</li>
        <li><strong>Gerador Oficial de Recibo em PDF:</strong> O sistema gera no servidor um recibo em PDF completo com logotipo da Toldos Print, dados do pagador, valor por extenso, forma de pagamento (PIX, Cartão, Boleto) e autenticação.</li>
        <li><strong>Botão "Enviar Recibo no WhatsApp":</strong> Assim que o pagamento cai, basta um toque para o PDF ser enviado diretamente para o WhatsApp do cliente com uma mensagem de agradecimento formal.</li>
        <li><strong>Filtros Avançados:</strong> Abas rápidas para alternar entre "Todos", "Apenas com OS", "Pendentes" e "Pagos", além de busca por nome de cliente ou empresa.</li>
      </ul>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- PÁGINA 6: GUIA PRÁTICO PARA A REUNIÃO E TREINAMENTO -->
  <div>
    <h1>8. Guia Prático de Operação para a Equipe</h1>
    <p>
      Para a reunião de hoje, utilize este roteiro passo a passo para orientar cada membro sobre suas responsabilidades diárias:
    </p>

    <div class="card-box">
      <h3 style="margin-top:0; color:#1e40af;">💼 Para os Vendedores / Atendimento:</h3>
      <ol class="step-list">
        <li><strong>Novo Orçamento:</strong> Sempre cadastrar com o máximo de precisão (medidas, acabamento e instruções). O que você digita aqui vai direto para o telão da fábrica.</li>
        <li><strong>Condições de Pagamento:</strong> Marcar entrada e saldo restante. Se houver desconto ou acréscimo, informar em porcentagem ou reais.</li>
        <li><strong>Envio de Contrato:</strong> Clicar no botão do WhatsApp para enviar o link do contrato para assinatura digital no celular do cliente.</li>
        <li><strong>Acompanhamento de Retornos:</strong> Olhar todo dia a tela de <code>/retornos</code>. Clientes com contatos atrasados ficam destacados em vermelho.</li>
      </ol>
    </div>

    <div class="card-box">
      <h3 style="margin-top:0; color:#b45309;">🎨 Para o Designer / Arte:</h3>
      <ol class="step-list">
        <li><strong>Anexar Arte:</strong> Assim que criar a arte do toldo ou adesivo, anexar o arquivo diretamente no card da produção.</li>
        <li><strong>Aprovação do Cliente:</strong> O sistema gera um link onde o cliente abre no celular dele, confere a imagem e clica em "Aprovar Arte".</li>
        <li><strong>Avanço para Impressão:</strong> Assim que aprovado, a peça move para "Iniciar Impressão" e a fábrica é liberada para rodar.</li>
      </ol>
    </div>

    <div class="card-box">
      <h3 style="margin-top:0; color:#065f46;">👷 Para os Colaboradores do Chão de Fábrica:</h3>
      <ol class="step-list">
        <li><strong>Abrir a Produção no Celular:</strong> A tela já carrega os pedidos na ordem de prioridade. A peça em 1º lugar tem medalha de ouro 🥇.</li>
        <li><strong>Conferir Medidas no Telão ou no Card:</strong> Ler as medidas em amarelo (<code>📏 5.5m × 1.2m</code>) e as instruções da fábrica antes de cortar material.</li>
        <li><strong>Teve problema? Clique em "Relatar Problema":</strong> Se a lona rasgar ou faltar ferro, aperte o botão vermelho na hora para avisar o Kaio. Não deixe o problema escondido.</li>
        <li><strong>Terminou a peça? Clique em "Marcar como Peça Pronta":</strong> Aperte o botão verde grande. O Kaio vai receber a notificação para fazer o controle de qualidade.</li>
      </ol>
    </div>

    <div class="card-box">
      <h3 style="margin-top:0; color:#7e22ce;">🛠️ Para o Kaio (Líder da Produção):</h3>
      <ol class="step-list">
        <li><strong>Organizar a Fila:</strong> Usar o botão "🔝 1º" para priorizar os pedidos mais urgentes do dia no topo da esteira.</li>
        <li><strong>Acompanhar Alertas da Fábrica:</strong> Resolver os alertas vermelhos relatados pelos colaboradores e clicar em "Resolver ✓" após sanar.</li>
        <li><strong>Controle de Qualidade (QC):</strong> Conferir as medidas finais e tirar uma foto da peça pronta para registrar no sistema antes de despachar.</li>
        <li><strong>Avisos na TV:</strong> Usar a Central do Telão para deixar recados visíveis para toda a fábrica.</li>
      </ol>
    </div>

    <div class="footer-note">
      Documento gerado automaticamente pelo Sistema Toldos Print em 20/11/2026. Todos os direitos reservados.
    </div>
  </div>

</body>
</html>
"""

with open("relatorio_alinhamento.html", "w", encoding="utf-8") as f:
    f.write(html_content)

print("HTML gerado com sucesso!")

# Gera o PDF via Google Chrome Headless com margens zeradas para CSS governar
cmd = [
    "google-chrome",
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--print-to-pdf=public/relatorio-alinhamento-sistema.pdf",
    "--no-pdf-header-footer",
    "relatorio_alinhamento.html"
]

res = subprocess.run(cmd, capture_output=True, text=True)
print("Chrome stdout:", res.stdout)
print("Chrome stderr:", res.stderr)

# Copia para a raiz e para o diretorio do brain se existir
os.system("cp public/relatorio-alinhamento-sistema.pdf RELATORIO_ALINHAMENTO_SISTEMA.pdf")
brain_dir = "/home/luiz-felippe/.gemini/antigravity/brain/27184ae0-116c-4d76-9718-c33e294acc51"
if os.path.exists(brain_dir):
    os.system(f"cp public/relatorio-alinhamento-sistema.pdf {brain_dir}/RELATORIO_ALINHAMENTO_SISTEMA.pdf")
    print("PDF copiado para o brain!")

print("PDF gerado em:")
print("1. public/relatorio-alinhamento-sistema.pdf")
print("2. RELATORIO_ALINHAMENTO_SISTEMA.pdf")
