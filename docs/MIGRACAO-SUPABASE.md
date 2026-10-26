# Migração de arquitetura do ControleSEAP

## Estado desta branch

Esta branch inicia a separação da API e da conexão ao PostgreSQL do Supabase. O `index.html` da raiz foi mantido sem alteração para preservar o sistema existente. A extração de todos os fluxos de negócio para uma nova interface ainda é uma etapa pendente, não uma migração concluída.

## Arquitetura-alvo

- `frontend/`: futura interface modular React/Vite.
- `backend/`: API FastAPI, autenticação de tokens Supabase e acesso PostgreSQL via SQLAlchemy/psycopg.
- `infrastructure/`: configurações de container, deploy e CI/CD.
- `docs/`: documentação de arquitetura, dados, segurança e operação.
- `index.html`: interface legada preservada durante a migração.

## Configuração do backend

1. Copie `backend/.env.example` para `.env` no ambiente de execução.
2. Configure `DATABASE_URL` com a string de conexão PostgreSQL do Supabase e TLS conforme exigido pelo projeto.
3. Configure `SUPABASE_URL` e, se necessário, `SUPABASE_JWKS_URL`.
4. Para projetos com assinatura JWT assimétrica, a API busca as chaves públicas JWKS. `SUPABASE_JWT_SECRET` é reservado apenas para projetos legados que comprovadamente usem HS256.
5. Nunca grave senha, JWT secret ou chave service-role no repositório, no frontend ou em logs.

## Endpoints iniciais

- `GET /health/live`: liveness sem dependência do banco.
- `GET /health/ready`: verifica conectividade PostgreSQL com `SELECT 1`.
- `GET /api/v1/me`: exemplo protegido que valida access token e devolve apenas o identificador/role do usuário.

Esses endpoints são a base técnica; os endpoints de processos, usuários, relatórios e demais módulos devem ser definidos a partir do comportamento real da aplicação e do schema Supabase existente.

## Dados, modelos e migrations

Não foram inventados modelos de negócio nem migrations de tabelas porque o schema atual do Supabase não foi disponibilizado nesta alteração. Antes de criar migrations Alembic, exporte/revise o schema existente e decida se o banco será gerenciado por migrations Alembic ou Supabase CLI. Evite manter duas fontes de verdade concorrentes.

## Segurança e autorização

- Validar JWT no backend para qualquer endpoint protegido.
- A autenticação não substitui autorização: cada rota deverá verificar permissões de negócio.
- Nunca confiar em `is_admin` enviado pelo cliente; obter claims confiáveis ou perfil persistido e aplicar autorização no servidor.
- Revisar RLS das tabelas existentes antes de alterar o acesso direto do navegador.
- Configurar CORS apenas para as origens reais dos ambientes.

## Próximas etapas obrigatórias

1. Levantar tabelas, constraints, índices, RLS, triggers e funções do Supabase.
2. Mapear cada operação CRUD e relatório da aplicação atual para contratos de API.
3. Implementar os modelos/endpoints por módulo e testes de regressão.
4. Extrair a interface HTML para React/Vite gradualmente.
5. Adicionar CI/CD, scans, build de imagens e deploy homologado.
6. Testar em projeto Supabase de homologação; não executar migrations em produção nesta etapa.


## Unificação das diligências

O controle legado de diligências está incorporado ao `index.html` e ao campo `processos.diligencias`, incluindo indicadores de prazo no dashboard. O protótipo isolado que propunha a tabela `public.diligencias` foi removido da branch de migração porque seus campos e seu vínculo com o processo divergem do contrato usado no sistema principal.

Nesta etapa, não criar tabela, migration ou endpoint de persistência para diligências. Primeiro confirmar no Supabase se a tabela separada existe e contém dados, e inspecionar os tipos e a estrutura efetiva do campo `processos.diligencias`. O módulo React/API deve preservar o comportamento do fluxo principal, evitando duplicidade de registros.
