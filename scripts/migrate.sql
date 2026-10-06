-- Toldos Print — schema inicial
-- Execute no painel SQL do Neon: https://console.neon.tech

CREATE TABLE IF NOT EXISTS materiais (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  unidade TEXT NOT NULL,
  preco_unitario NUMERIC NOT NULL,
  estoque_minimo NUMERIC NOT NULL,
  quantidade_estoque NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS servicos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  forma_cobranca TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  ferramentas TEXT
);

CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT
);

CREATE TABLE IF NOT EXISTS acabamentos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  preco_unitario NUMERIC NOT NULL,
  unidade TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS equipamentos_acesso (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  preco_diaria NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS vendedores (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  comissao_percent NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS orcamentos (
  id TEXT PRIMARY KEY,
  numero INTEGER NOT NULL,
  cliente_id TEXT NOT NULL,
  item JSONB NOT NULL,
  quantidade_material_debitada NUMERIC,
  material_fechado JSONB,
  servico_fechado JSONB,
  total_fechado NUMERIC,
  ajuste_manual NUMERIC NOT NULL DEFAULT 0,
  anexo_nome TEXT,
  anexo_url TEXT,
  status TEXT NOT NULL DEFAULT 'aberto',
  criado_em TEXT NOT NULL,
  fechado_em TEXT,
  validade_dias INTEGER
);

CREATE TABLE IF NOT EXISTS entradas_estoque (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL,
  quantidade NUMERIC NOT NULL,
  fornecedor TEXT,
  com_nota_fiscal BOOLEAN NOT NULL DEFAULT FALSE,
  numero_nota TEXT,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS produtos_rapidos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  prazo_dias INTEGER NOT NULL,
  tem_acabamento BOOLEAN NOT NULL DEFAULT FALSE,
  variantes JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS pedidos_rapidos (
  id TEXT PRIMARY KEY,
  numero INTEGER NOT NULL,
  produto_id TEXT NOT NULL,
  variante_id TEXT NOT NULL,
  acabamento TEXT,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT NOT NULL,
  observacao TEXT NOT NULL DEFAULT '',
  total NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'aguardando',
  criado_em TEXT NOT NULL,
  vendedor_id TEXT,
  produto_nome TEXT,
  variante_nome TEXT,
  prazo_entrega_em TEXT
);

CREATE TABLE IF NOT EXISTS lancamentos_financeiros (
  id TEXT PRIMARY KEY,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  vencimento TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  pago_em TEXT,
  origem TEXT NOT NULL,
  origem_id TEXT,
  criado_em TEXT NOT NULL,
  cliente_id TEXT,
  forma_pagamento TEXT,
  numero_boleto TEXT
);

CREATE TABLE IF NOT EXISTS mensagens_bot (
  id TEXT PRIMARY KEY,
  cliente_id TEXT,
  cliente_nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  texto TEXT NOT NULL,
  origem TEXT NOT NULL,
  autor TEXT NOT NULL,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS avisos_tv (
  id TEXT PRIMARY KEY,
  mensagem TEXT NOT NULL,
  criado_em TEXT NOT NULL
);
