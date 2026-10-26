# Mapeamento funcional e de dados — ControleSEAP

## 1. Escopo e confiabilidade

Este levantamento foi feito por leitura estática do `index.html` da branch `main` (arquivo monolítico com cerca de 252 KB) e do protótipo isolado `features/copilot/plans/diligencias.html`. A aplicação principal já possui controle de prazo das diligências no dashboard e armazena diligências dentro do campo `processos.diligencias`. O HTML isolado é um protótipo independente que propõe uma tabela `public.diligencias`; ele não deve ser tratado como parte integrada do fluxo principal.

**Limitação importante:** este documento é um mapeamento do contrato que o código cliente sugere, não uma introspecção do banco. Não tivemos acesso ao catálogo PostgreSQL/Supabase, constraints, tipos reais, índices, triggers, políticas RLS, funções, usuários de Auth nem dados. Nenhuma migration deve ser executada com base apenas neste documento.

## 2. Inventário do repositório

| Caminho | Função observada |
|---|---|
| `index.html` | Aplicação legada: interface, autenticação, CRUD, regras de negócio, dashboard, relatórios, importação/exportação e conexão Supabase. |
| `features/copilot/plans/diligencias.html` | Protótipo independente removido desta branch para evitar manter uma segunda interface e um segundo contrato de dados para diligências. O controle funcional legado permanece em `index.html`. |
| `README.md` | Apenas descrição curta do repositório. |
| `frontend/` | Nova base React/Vite adicionada na branch de migração; ainda não substitui os módulos legados. |
| `backend/` | Nova base FastAPI adicionada na branch de migração; os endpoints de negócio ainda não foram implementados. |
| `docs/` | Documentação da arquitetura e deste mapeamento. |

## 3. Entidades/tabelas identificadas

### 3.1 `processos` — entidade principal

Operações observadas no cliente: `SELECT *`, `UPSERT` de um registro, `DELETE` por `id`, e assinatura Realtime para qualquer alteração na tabela `public.processos`.

O formulário constrói e persiste os campos abaixo. A presença no código não confirma tipo, nulabilidade, default ou constraint no PostgreSQL.

| Grupo | Campos identificados no cliente |
|---|---|
| Identificação e origem | `id`, `sei`, `data_ent`, `objeto`, `unidade_origem`, `doc_origem`, `juntado`, `relacionados` |
| Contexto e prioridade | `op_policial`, `op_policial_detalhes`, `possui_inquerito`, `inquerito_detalhes`, `cad_epad`, `epad_detalhes`, `prioritario` |
| Tipo e prescrição | `tipo_acusado`, `penalidades`, `data_conhecimento`, `calc_advertencia`, `calc_suspensao`, `calc_demissao`, `calc_pj` |
| Distribuição e análise | `analista`, `data_distribuicao`, `prazo_nt_data`, `data_entrega_nt`, `data_analise_preliminar`, `ips`, `status_manual`, `data_despacho` |
| Acusados e decisão | `acusados`, `resultados_acusados`, `resultado`, `doc_resp` |
| TAC | `tac_sit`, `tac_numero_processo`, `tac_status_data`, `tac_data_limite`, `tac_obs` |
| Diligências e observações | `diligencias`, `obs` |

**Estruturas aninhadas:** `acusados`, `resultados_acusados`, `relacionados` e `diligencias` são arrays no estado da interface. O código converte esses arrays para JSON em texto antes de enviar ao Supabase e tenta fazer parse no carregamento. É necessário verificar no banco se as colunas são `text`, `json` ou `jsonb`; a representação atual é um sinal de dívida técnica e deve ser normalizada com migração validada.

Campos adicionais podem existir no banco, porque o cliente lê `SELECT *` e salva o objeto inteiro; o inventário acima lista os campos explicitamente montados pelo formulário e usados pelo relatório, não necessariamente todas as colunas.

### 3.2 `configuracoes` — configuração global

| Campo | Uso observado |
|---|---|
| `id` | Chave do registro de configuração; o cliente usa o identificador fixo `main`. |
| `dados` | Objeto `config` com parâmetros de interface e regras de cálculo/alerta. |

Estrutura de `dados` observada:
- `orgName`, `subtitle`, `defaultUnit`, `itemsPerPage`;
- `pjYears`;
- `pf.adv`, `pf.susp`, `pf.dem`;
- `alerts.crit.adv`, `alerts.crit.susp`, `alerts.crit.dem`, `alerts.crit.task`;
- `alerts.high.adv`, `alerts.high.susp`, `alerts.high.dem`, `alerts.high.task`.

A leitura é por `id = 'main'`; gravação via `upsert` com conflito em `id`. O tipo SQL de `dados` ainda precisa ser confirmado.

### 3.3 `usuarios` — perfil/controle de acesso legado

Campos acessados pelo cliente:
- `id`;
- `nome_completo`;
- `username`;
- `senha`;
- `is_admin`.

A tela de perfil busca `is_admin, nome_completo, username` por `id = currentUser.id`. A gestão de usuários lista também `senha`, cria/atualiza perfis e exclui registros. A autenticação do login, porém, usa Supabase Auth `signInWithPassword(email, password)`, cujo identificador é o e-mail; não usa `username` para autenticar.

**Risco prioritário:** o cliente seleciona e grava `usuarios.senha` em texto fornecido pelo formulário. Não foi confirmado se há senhas reais armazenadas nessa coluna nem se ela é usada para autenticar. Na arquitetura nova, não se deve ler nem armazenar senha na tabela de perfil. A autenticação deve ficar no Supabase Auth; a tabela de perfil deve conter apenas o ID do usuário Auth e atributos não secretos. Antes de remover/alterar a coluna, verificar dependências e política de retenção com o responsável pelo sistema.

## 4. Fluxos funcionais mapeados

1. **Login/logout:** login por e-mail e senha via Supabase Auth; recuperação de sessão no carregamento; perfil consultado na tabela `usuarios`; perfil administrativo controla a visibilidade de operações na interface.
2. **Inicialização:** carrega `configuracoes` e `processos`, mostra o estado da conexão e assina eventos Realtime em `processos`.
3. **Dashboard:** contagens por status, controle de prazo de nota técnica e diligências/tarefas, alertas relacionados a prescrição e acompanhamento do acervo.
4. **Consulta de processos:** filtros por diversos atributos, pesquisa, ordenação e modos de visualização em cartões, tabela e lista/detalhe.
5. **Cadastro/edição:** valida campos obrigatórios (SEI, data de conhecimento, objeto, tipo de pessoa e ao menos um acusado), mantém dados de origem, análise, distribuição, prazos, resultado, TAC, diligências e observações; grava via upsert.
6. **Exclusão:** exclusão de processo por ID após confirmação na interface.
7. **Gestão de usuários:** lista perfis; usuário comum edita apenas seu cadastro; administrador pode criar e excluir usuários e definir o indicador administrativo na interface. Essas regras precisam ser aplicadas no servidor/RLS, não apenas na UI.
8. **Configurações:** edição de parâmetros institucionais, prazos/limites de prescrição e limiares de alerta; salva no registro `main`.
9. **Relatórios:** geral, distribuição, prescrição, entregues/pendentes, situação, tramitação e gerencial; filtros por período, status, analista e atributos do processo; tabelas analíticas e exportação.
10. **Exportação/importação:** exporta relatório para Word/Excel, exporta backup JSON de configuração e processos, e importa backup gravando configuração e processos no Supabase.
11. **Tempo real:** alteração em `processos` dispara recarga da lista de processos.

## 5. Regras de negócio que devem ser preservadas em testes de regressão

- Status conhecidos: `Cadastrado`, `Aguardando Distribuição`, `Em análise`, `Pendente de análise do(a) Corregedor(a)`, `TAC`, `Suspenso`, `Concluído`.
- Cálculo de prazos de prescrição configurável por tipo de pessoa e parâmetros `pf`/`pjYears`.
- Alertas de prazo com faixas críticas e de alta prioridade configuráveis.
- Resultado geral e resultados por acusado, incluindo data de despacho por acusado.
- Regras condicionais de TAC: quando o resultado não indica TAC, o cliente limpa campos de TAC; a data limite é mantida apenas quando a situação normalizada é “TAC proposto e aceito”.
- Dados compostos: múltiplos acusados, resultados individuais, processos relacionados e diligências.
- Relatório gerencial agrupa análise preliminar, juízo de admissibilidade e situações de TAC, com métricas de tempo médio; esses cálculos precisam ser comparados com os resultados atuais antes de qualquer refatoração.
- Filtros e exportações devem manter os mesmos critérios e campos selecionados.
- Realtime deve refletir alterações concorrentes sem duplicar ou perder registros.

## 6. Mapa CRUD observado

| Tabela | Leitura | Criação/atualização | Exclusão | Eventos |
|---|---|---|---|---|
| `processos` | `SELECT *` | `UPSERT` | por `id` | Realtime em alterações da tabela |
| `configuracoes` | por `id = 'main'` | `UPSERT` por `id` | Não observada | Não observados |
| `usuarios` | perfil por ID; lista ordenada por nome | `INSERT` e `UPDATE` | por `id` | Não observados |

## 7. Riscos e decisões de arquitetura

### P0 — resolver antes de expor API de produção
- Confirmar políticas RLS de cada tabela e garantir que o usuário autenticado não possa ler/modificar processos ou usuários fora das suas permissões.
- Migrar a autorização administrativa para o backend e/ou políticas RLS confiáveis. Ocultar botões no frontend não é controle de acesso.
- Auditar a coluna `usuarios.senha` e remover qualquer dependência de senha em texto; não a incluir nos modelos de resposta da API.
- Verificar se as chaves publicáveis atualmente incorporadas ao HTML são apenas publishable/anon e se nenhuma chave secreta/service-role foi exposta. Chaves públicas podem estar no navegador, mas só são seguras com RLS/policies corretas.
- Não registrar payloads completos de processos no console, porque podem conter dados pessoais ou informações correicionais.

### P1 — resolver durante a migração
- Confirmar tipos reais e converter arrays serializados em `text` para `jsonb` ou tabelas relacionais, apenas após backup e testes.
- Definir se os resultados por acusado, processos relacionados e diligências ficam como JSONB ou em tabelas normalizadas. A decisão depende de consultas, integridade e relatórios.
- Definir estratégia única de migrations (Supabase CLI ou Alembic) para não criar fontes de verdade concorrentes.
- Paginar a leitura de processos e filtrar no servidor; o cliente atual baixa todos os registros.
- Criar trilha de auditoria para criação/alteração/exclusão, com usuário, data, ação e campos alterados, conforme política institucional.
- Formalizar validação de schema, constraints, índices e regras de exclusividade (por exemplo, SEI), após consulta ao catálogo e dados existentes.

## 8. Arquitetura-alvo sugerida

- **Frontend React/Vite:** apresentação, formulários, filtros e relatórios; Supabase Auth pode manter o fluxo de login, mas chamadas de negócio passam pela API.
- **FastAPI:** autentica access token, autoriza cada operação, valida payloads, aplica regras de negócio e fornece endpoints paginados.
- **Supabase PostgreSQL:** fonte de dados existente; acesso de backend com credencial de conexão protegida. Nunca usar service-role no navegador.
- **RLS:** manter defesa em profundidade. Definir com clareza se a API usa o usuário do banco de serviço ou contexto JWT do usuário; isso altera a forma de aplicar políticas. Não presumir que validar JWT na API, sozinho, faz RLS ser aplicada como se fosse o usuário final.
- **Realtime:** escolher entre Supabase Realtime direto com sessão do usuário e policies revisadas, ou atualização/polling/eventos intermediados. Não replicar a assinatura até validar segurança e necessidade.
- **Relatórios:** primeiro reproduzir os cálculos existentes com testes de caracterização; depois decidir o que vai para consultas SQL/API e o que pode permanecer no frontend.

## 9. Proposta inicial de endpoints (a validar com os consumidores)

| Endpoint proposto | Função |
|---|---|
| `GET /api/v1/processos` | Listagem paginada e filtrada |
| `GET /api/v1/processos/{id}` | Detalhe |
| `POST /api/v1/processos` | Criação |
| `PATCH /api/v1/processos/{id}` | Atualização parcial |
| `DELETE /api/v1/processos/{id}` | Exclusão autorizada |
| `GET /api/v1/configuracoes` | Obter configuração |
| `PUT /api/v1/configuracoes` | Atualizar configuração com permissão administrativa |
| `GET /api/v1/usuarios` | Lista de perfis permitida ao usuário |
| `GET /api/v1/usuarios/me` | Perfil do usuário autenticado |
| `PATCH /api/v1/usuarios/me` | Atualizar campos de perfil permitidos |
| `POST /api/v1/admin/usuarios` | Provisionamento administrativo por fluxo seguro |
| `PATCH /api/v1/admin/usuarios/{id}` | Alterar perfil/role com autorização |
| `DELETE /api/v1/admin/usuarios/{id}` | Desativar/remover usuário via fluxo administrativo auditado |
| `GET /api/v1/relatorios/{tipo}` | Consultas de relatório, após definir parâmetros e formato |
| `GET /health/live`, `GET /health/ready` | Saúde da API e do banco |

Os caminhos são propostas, não contratos implementados. O provisionamento de contas deve usar fluxo administrativo seguro do Supabase Auth no servidor, sem armazenar senhas no perfil.

## 10. Evidências ainda necessárias do Supabase

Solicitar ao administrador do projeto, sem compartilhar segredos:
1. DDL/schema exportado de `public.processos`, `public.configuracoes`, `public.usuarios` e tabelas relacionadas.
2. Tipos de coluna, defaults, PK/FK, índices, constraints, triggers, views e funções.
3. Policies RLS e configuração de publicação Realtime para `processos`.
4. Contagem aproximada de linhas e amostras **anonimizadas** representativas para arrays/JSON e relatórios.
5. Configuração de Auth (provedores, formato de claims/roles, associação entre `auth.users.id` e `usuarios.id`), sem exportar senhas, tokens ou chaves secretas.
6. Definição de ambiente homologação e procedimento de backup/rollback.

## 11. Sequência de migração segura

1. Exportar schema e confirmar RLS/policies e mapeamento Auth.
2. Criar testes de caracterização para cálculos, status, filtros, relatórios e importação/exportação atuais.
3. Implementar modelos Pydantic/SQLAlchemy que correspondam ao schema confirmado, sem inventar tipos.
4. Implementar endpoints de leitura primeiro, comparando resultados com o sistema atual.
5. Migrar cadastro/edição/exclusão com autorização no backend e auditoria.
6. Migrar configurações e gestão de usuários; eliminar a coluna/fluxo de senha legado somente após comprovar que não há dependências.
7. Migrar relatórios e comparar totais e médias, inclusive períodos-limite e múltiplos acusados.
8. Validar Realtime, concorrência, paginação e exportações.
9. Homologar com cópia controlada/anonimizada, plano de rollback e aceite do responsável.
10. Só então promover a nova interface e API; manter o legado disponível até o aceite.

## 12. Nota de segurança sobre configuração

O cliente legado permite selecionar ambiente e sobrescrever a chave via query string, guardando-a em `localStorage`. Essa mecânica deve ser removida na nova interface e substituída por configuração de build/deploy. Chaves publicáveis não são credenciais administrativas; a segurança real depende de RLS e políticas. Nunca colocar senha de banco, JWT secret ou service-role em `VITE_*`, HTML, URL ou repositório.


## 13. Unificação do módulo de diligências

A leitura do sistema legado confirmou que o controle de diligências **já está incorporado ao código principal** (`index.html`): há indicadores de prazo no dashboard e o processo possui a coleção `diligencias`, utilizada também na apresentação de dados e nos relatórios. Para a migração, a referência funcional inicial será esse fluxo incorporado ao processo.

O arquivo isolado `features/copilot/plans/diligencias.html` implementava outro fluxo, baseado numa tabela separada `public.diligencias` com os campos `numero_documento`, `data_envio`, `data_resposta` e `processo_id`. Esse contrato diverge do fluxo legado, que utiliza propriedades como `doc_solicitante`, `prazo_atendimento` e `data_resposta` dentro de `processos.diligencias`. Mantê-los como duas fontes funcionais criaria duplicidade e exigiria uma regra de sincronização que não foi definida.

**Decisão nesta etapa:** remover da branch de migração o HTML independente, sem alterar o `index.html` legado nem criar/alterar tabelas. Na migração React/API, as diligências serão tratadas como parte do módulo de processos até que a inspeção do schema real e a definição de compatibilidade esclareçam se existe uma tabela separada em uso. Não se deve criar a tabela `public.diligencias` apenas com base no SQL comentado no protótipo.

**Pendente antes de implementar persistência:** confirmar no Supabase os tipos e a estrutura de `processos.diligencias`, se há tabela `public.diligencias` em uso e se existem registros nessa tabela. A remoção do protótipo não exclui nem migra dados do banco.


## 14. Migração inicial do módulo React de diligências

Foi implementada uma primeira interface em `frontend/src/App.tsx`, com:

- autenticação via Supabase Auth;
- listagem de processos e suas diligências;
- inclusão de diligência vinculada a processo com documento solicitante, prazo e data de resposta opcional;
- alteração/limpeza da data de resposta e remoção de diligências;
- busca por SEI, objeto ou documento e filtros por pendentes, respondidas e todas;
- resumo de pendentes dentro do prazo, vencidas, próximas do vencimento e respondidas.

O comportamento usa o contrato legado `processos.diligencias` e a serialização JSON em texto observada em `saveProcessToSupabase`. O limiar de alerta é 15 dias, correspondente ao valor padrão legado `alerts.high.task`; a configuração personalizada ainda não foi conectada à nova interface.

**Não validado em ambiente real:** tipos SQL, permissões RLS, atualização via Supabase, existência de registros na tabela separada `public.diligencias` e build da aplicação. A implementação não cria, exclui ou migra tabelas. O acesso direto ao Supabase é provisório, mantendo a compatibilidade com o cliente legado até implementar e validar endpoints FastAPI.
