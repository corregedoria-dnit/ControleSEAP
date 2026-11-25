-- SEAP | 002 - Migração dos campos TAC legados
-- PostgreSQL / Supabase
-- Copia os dados de public.processos para public.tacs.
-- Não apaga nem altera os campos legados da tabela processos.
-- Pode ser reexecutado: processo_legado_id impede duplicação.
--
-- IMPORTANTE:
-- 1) Faça backup antes da execução.
-- 2) Execute primeiro em homologação com dados fictícios/anonimizados.
-- 3) Confirme os resultados antes de executar em produção.
-- 4) Este script migra no máximo um TAC legado por processo, pois a estrutura
--    antiga armazenava apenas um conjunto de campos TAC em cada registro.

BEGIN;

DO $preflight$
DECLARE
    v_missing TEXT[];
BEGIN
    SELECT ARRAY_AGG(required.column_name)
      INTO v_missing
      FROM (VALUES
          ('id'),
          ('tac_sit'),
          ('tac_numero_processo'),
          ('tac_status_data'),
          ('tac_data_limite'),
          ('tac_obs')
      ) AS required(column_name)
     WHERE NOT EXISTS (
         SELECT 1
           FROM information_schema.columns c
          WHERE c.table_schema = 'public'
            AND c.table_name = 'processos'
            AND c.column_name = required.column_name
     );

    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION
            'Migração cancelada. Colunas ausentes em public.processos: %',
            array_to_string(v_missing, ', ');
    END IF;

    IF to_regclass('public.tacs') IS NULL THEN
        RAISE EXCEPTION
            'Migração cancelada. Execute primeiro 001_create_tacs.sql.';
    END IF;
END
$preflight$;

INSERT INTO public.tacs (
    processo_origem_id,
    processo_legado_id,
    numero_processo,
    status,
    status_legado,
    data_status,
    data_limite,
    observacoes,
    cadastrado_epad,
    origem_pad
)
SELECT
    p.id,
    p.id,
    NULLIF(BTRIM(p.tac_numero_processo::TEXT), ''),
    CASE
        WHEN LOWER(BTRIM(COALESCE(p.tac_sit::TEXT, ''))) = LOWER('Recusado')
            THEN 'TAC proposto e não aceito'
        ELSE COALESCE(NULLIF(BTRIM(p.tac_sit::TEXT), ''), 'Em negociação')
    END,
    p.tac_sit::TEXT,
    p.tac_status_data::DATE,
    p.tac_data_limite::DATE,
    p.tac_obs::TEXT,
    FALSE,
    FALSE
FROM public.processos p
WHERE
       p.tac_sit IS NOT NULL
    OR p.tac_numero_processo IS NOT NULL
    OR p.tac_status_data IS NOT NULL
    OR p.tac_data_limite IS NOT NULL
    OR p.tac_obs IS NOT NULL
ON CONFLICT (processo_legado_id) DO NOTHING;

COMMIT;

-- RELATÓRIO DE CONFERÊNCIA 1: quantidade de registros legados elegíveis e migrados.
-- Execute após o COMMIT.
-- SELECT
--   (SELECT COUNT(*) FROM public.processos p
--     WHERE p.tac_sit IS NOT NULL
--        OR p.tac_numero_processo IS NOT NULL
--        OR p.tac_status_data IS NOT NULL
--        OR p.tac_data_limite IS NOT NULL
--        OR p.tac_obs IS NOT NULL) AS total_legado,
--   (SELECT COUNT(*) FROM public.tacs t
--     WHERE t.processo_legado_id IS NOT NULL) AS total_migrado;

-- RELATÓRIO DE CONFERÊNCIA 2: deve retornar zero linhas.
-- SELECT p.id, p.tac_numero_processo, p.tac_sit
-- FROM public.processos p
-- LEFT JOIN public.tacs t ON t.processo_legado_id = p.id
-- WHERE (
--       p.tac_sit IS NOT NULL
--    OR p.tac_numero_processo IS NOT NULL
--    OR p.tac_status_data IS NOT NULL
--    OR p.tac_data_limite IS NOT NULL
--    OR p.tac_obs IS NOT NULL
-- ) AND t.id IS NULL;
