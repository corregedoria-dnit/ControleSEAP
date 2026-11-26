-- Adiciona o prazo de cumprimento em meses aos TACs.
-- O campo legado prazo_dias é preservado para manter os dados históricos.
ALTER TABLE public.tacs
    ADD COLUMN IF NOT EXISTS prazo_meses NUMERIC(8,2);

COMMENT ON COLUMN public.tacs.prazo_meses IS
    'Prazo de cumprimento do TAC em meses, contado a partir da data de assinatura.';
