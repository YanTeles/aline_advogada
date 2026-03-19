-- Migration 002: Tabelas de apoio para prazos, processos, usuários e feriados

CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escritorio_id UUID NOT NULL,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    telefone TEXT,
    senha_hash TEXT NOT NULL,
    google_refresh_token TEXT,
    criado_em TIMESTAMPTZ DEFAULT now(),
    atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS processos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escritorio_id UUID NOT NULL,
    numero_processo TEXT NOT NULL,
    cliente TEXT,
    descricao TEXT,
    valor_causa_encrypted BYTEA,
    valor_causa_iv BYTEA,
    valor_causa_tag BYTEA,
    status TEXT DEFAULT 'ATIVO',
    criado_em TIMESTAMPTZ DEFAULT now(),
    atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feriados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escritorio_id UUID,
    data DATE NOT NULL,
    descricao TEXT,
    criado_em TIMESTAMPTZ DEFAULT now(),
    atualizado_em TIMESTAMPTZ DEFAULT now(),
    UNIQUE(escritorio_id, data)
);

CREATE TABLE IF NOT EXISTS prazos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escritorio_id UUID NOT NULL,
    processo_id UUID NOT NULL,
    tipo_prazo TEXT NOT NULL,
    descricao TEXT,
    data_publicacao DATE NOT NULL,
    data_limite DATE NOT NULL,
    dias_uteis INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDENTE',
    responsavel_id UUID,
    criado_por UUID,
    alerta_whatsapp BOOLEAN DEFAULT true,
    alerta_calendar BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT now(),
    atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prazos_escritorio_data_limite ON prazos (escritorio_id, data_limite);
CREATE INDEX IF NOT EXISTS idx_processos_escritorio_numero ON processos (escritorio_id, numero_processo);
CREATE INDEX IF NOT EXISTS idx_usuarios_escritorio ON usuarios (escritorio_id);
