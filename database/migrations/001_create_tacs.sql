-- SEAP | 001 - Estrutura para múltiplos TACs
-- PostgreSQL / Supabase
-- Cria a tabela independente de TACs sem alterar a tabela public.processos.
-- Execute em homologação primeiro. Este script NÃO migra dados.

BEGIN;

DO $migration$
DECLARE
    v_id_type TEXT;
BEGIN
    SELECT pg_catalog.format_type(a.atttypid, a.atttypmod)
      INTO v_id_type
      FROM pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'processos'
       AND a.attname = 'id'
       AND a.attnum > 0
       AND NOT a.attisdropped;

    IF v_id_type IS NULL THEN
        RAISE EXCEPTION 'Não foi possível localizar public.processos.id. Criação cancelada.';
    END IF;

    EXECUTE format($ddl$
        CREATE TABLE IF NOT EXISTS public.tacs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            processo_origem_id %1$s NOT NULL
                REFERENCES public.processos(id) ON DELETE RESTRICT,
            processo_legado_id %1$s UNIQUE
                REFERENCES public.processos(id) ON DELETE RESTRICT,
            numero_processo TEXT,
            origem_pad BOOLEAN NOT NULL DEFAULT FALSE,
            processo_pad TEXT,
            processo_comunicacao_chefia TEXT,
            cadastrado_epad BOOLEAN NOT NULL DEFAULT FALSE,
            data_assinatura DATE,
            status TEXT NOT NULL DEFAULT 'Em negociação',
            status_legado TEXT,
            data_status DATE,
            prazo_dias INTEGER,
            data_limite DATE,
            data_finalizacao DATE,
            observacoes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT tacs_prazo_dias_check
                CHECK (prazo_dias IS NULL OR prazo_dias >= 0),
            CONSTRAINT tacs_origem_pad_check
                CHECK (origem_pad = FALSE OR NULLIF(BTRIM(processo_pad), '') IS NOT NULL)
        )
    $ddl$, v_id_type);
END
$migration$;

CREATE INDEX IF NOT EXISTS idx_tacs_processo_origem
    ON public.tacs(processo_origem_id);
CREATE INDEX IF NOT EXISTS idx_tacs_status
    ON public.tacs(status);
CREATE INDEX IF NOT EXISTS idx_tacs_data_assinatura
    ON public.tacs(data_assinatura);
CREATE INDEX IF NOT EXISTS idx_tacs_numero_processo
    ON public.tacs(numero_processo);

COMMENT ON TABLE public.tacs IS
'TACs vinculados a processos de origem; um processo pode possuir vários TACs.';
COMMENT ON COLUMN public.tacs.cadastrado_epad IS
'Indica se este TAC individual foi cadastrado no ePAD. Não corresponde a processos.cad_epad.';
COMMENT ON COLUMN public.tacs.processo_legado_id IS
'Identifica o TAC único migrado dos campos legados de processos; NULL para novos TACs.';
COMMENT ON COLUMN public.tacs.status_legado IS
'Valor original de processos.tac_sit preservado na migração.';

COMMIT;

-- Verificação básica:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'tacs'
-- ORDER BY ordinal_position;
