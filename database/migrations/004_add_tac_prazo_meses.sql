-- SEAP | 004 - Prazo de cumprimento dos TACs em meses
-- PostgreSQL / Supabase
-- Preserva prazo_dias para consulta histórica e adiciona o campo vigente em meses.
-- Execute primeiro em homologação e valide os dados antes da produção.

ALTER TABLE public.tacs
    ADD COLUMN IF NOT EXISTS prazo_meses NUMERIC(8,2);

COMMENT ON COLUMN public.tacs.prazo_meses IS
    'Prazo de cumprimento do TAC em meses, contado a partir da data de assinatura.';

-- Conferência:
-- SELECT id, data_assinatura, data_limite, prazo_meses, prazo_dias
-- FROM public.tacs
-- ORDER BY data_assinatura DESC NULLS LAST;
