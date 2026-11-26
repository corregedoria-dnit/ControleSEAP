-- Campos de prazo em meses para o modelo legado de TAC vinculado ao processo.
ALTER TABLE public.processos
    ADD COLUMN IF NOT EXISTS tac_data_assinatura DATE,
    ADD COLUMN IF NOT EXISTS tac_prazo_meses NUMERIC(8,2);
COMMENT ON COLUMN public.processos.tac_prazo_meses IS
    'Prazo de cumprimento do TAC em meses, contado a partir da data de assinatura.';
