-- Complementa a estrutura de TACs com as datas utilizadas pelo cadastro,
-- dashboard e relatórios. Seguro para execução repetida.
ALTER TABLE public.tacs
    ADD COLUMN IF NOT EXISTS data_proposta DATE,
    ADD COLUMN IF NOT EXISTS data_publicacao DATE;

COMMENT ON COLUMN public.tacs.data_proposta IS
    'Data em que a proposta de TAC foi apresentada.';

COMMENT ON COLUMN public.tacs.data_publicacao IS
    'Data de publicação do TAC.';
