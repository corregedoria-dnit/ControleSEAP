# Frontend do ControleSEAP

A interface atualmente mantida na raiz (`/index.html`) permanece preservada durante a migração. A extração integral para React/Vite deve ser feita por módulos funcionais, com testes de regressão antes de substituir a interface legada.

## Regras de integração

- Consumir a API FastAPI por uma URL configurada no build/runtime (`VITE_API_BASE_URL`).
- Não armazenar segredos privilegiados do Supabase no frontend.
- Para autenticação, usar a sessão do Supabase Auth e enviar o access token como `Authorization: Bearer <token>` para a API.
- Não migrar operações de negócio sem mapear tabelas, políticas RLS e contratos atuais do Supabase.


## Módulo de diligências

A tela React atual contém a primeira migração funcional do controle de diligências. Ela lê `processos` e atualiza apenas o campo `diligencias`, serializando a coleção como JSON em texto para manter compatibilidade com o código legado. Operações de negócio usam o cliente Supabase no navegador nesta fase provisória; antes de produção, validar RLS e o tipo real da coluna e decidir a transição para a API FastAPI.
