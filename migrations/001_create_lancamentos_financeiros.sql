-- Migration: criar tabela de lançamentos financeiros com campos criptografados

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS lancamentos_financeiros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escritorio_id UUID NOT NULL,
    tipo TEXT NOT NULL,
    status TEXT NOT NULL,
    data_vencimento DATE NOT NULL,
    data_pagamento DATE,
    valor_encrypted BYTEA NOT NULL,
    valor_iv BYTEA NOT NULL,
    valor_tag BYTEA NOT NULL,
    descricao_encrypted BYTEA NOT NULL,
    descricao_iv BYTEA NOT NULL,
    descricao_tag BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lancamentos_escritorio_data_vencimento ON lancamentos_financeiros (escritorio_id, data_vencimento);
