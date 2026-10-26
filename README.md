# ControleSEAP

Sistema de controle de processos correicionais.

## Migração de arquitetura

A branch `codex/migracao-arquitetura-supabase` inicia a separação entre interface, API e banco Supabase. A interface legada em `index.html` foi preservada para evitar perda de funcionalidades enquanto os módulos são migrados e testados.

Consulte [docs/MIGRACAO-SUPABASE.md](docs/MIGRACAO-SUPABASE.md) para arquitetura-alvo, configuração segura, endpoints iniciais e etapas pendentes.

### API

A API inicial fica em `backend/`. Configure as variáveis descritas em `backend/.env.example`. Não versione arquivos `.env` nem credenciais.
