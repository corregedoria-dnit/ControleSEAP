# Fronteira de acesso a dados do SEAP

## Objetivo desta etapa

`index.html` continua usando o Supabase enquanto as telas passam a depender de uma interface única, `seapBackend`. O adaptador `createSupabaseBackend` contém as chamadas específicas do SDK. Um adaptador futuro para a API FastAPI poderá substituir essa implementação sem espalhar consultas PostgreSQL/HTTP pelas telas.

As operações expostas hoje são:

- `auth`: restaurar sessão, entrar, sair e carregar perfil;
- `config`: carregar e salvar configurações;
- `processes`: listar, salvar, excluir e receber atualizações;
- `users`: listar, criar, atualizar e excluir perfis.

Operações retornam dados normalizados ou lançam um erro. As telas não devem depender de objetos `{ data, error }` do Supabase nem construir consultas `.from(...)`.

## Limites atuais

Esta é uma etapa de preparação, não a migração do serviço. O adaptador ativo ainda acessa Supabase no navegador, mantém o Realtime e não substitui a autenticação institucional pendente. Não há API FastAPI implementada neste commit.

A inicialização do Supabase, a seleção de ambiente e as chaves públicas continuam no HTML. A tela isolada de diligências também não foi alterada.

Antes de trocar o adaptador, é necessário:

1. Confirmar o schema, constraints, RLS, funções, triggers, views e dados implantados no Supabase.
2. Definir os contratos HTTP, paginação, conflitos de edição e regras de autorização da API.
3. Definir o fluxo OIDC institucional e mapear o `sub` do provedor para o perfil SEAP.
4. Migrar a gestão de usuários para o backend. A listagem deixou de selecionar `usuarios.senha`, mas o fluxo legado de gravação ainda envia o campo; ele não deve permanecer no modelo de perfil nem no banco de destino.
5. Decidir se a tela isolada `features/copilot/plans/diligencias.html` será migrada para a API ou desativada. Ela ainda usa Supabase diretamente.
6. Migrar o Realtime para eventos da API, SSE/WebSocket ou atualização sob demanda.

## Contrato para o próximo adaptador

O próximo adaptador deve implementar as operações de `seapBackend` usando `fetch` para a API institucional e um provedor de identidade injetável. Deve enviar identificador de correlação, tratar respostas HTTP em erros funcionais e nunca expor DSN, credenciais de banco ou segredo de servidor ao navegador.

Não adicionar regras de domínio, cálculos de prescrição ou autorização às chamadas do frontend. Essas responsabilidades devem ser movidas para serviços do backend e cobertas por migrations e validações versionadas.
