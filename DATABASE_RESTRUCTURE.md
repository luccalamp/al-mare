# Database Restructure

## O que foi preparado

Esta rodada cria uma base de reestruturacao segura e aditiva para o projeto:

- backfill de `user_id` nos registros-filho a partir de `clientes` ou `company_document_folders`;
- triggers para manter o `user_id` consistente nas novas insercoes;
- colunas operacionais faltantes padronizadas (`deleted_at`, `restored_at`, `updated_at`, metadados JSON, campos de storage e links do portal);
- indices focados nos acessos reais do app;
- tabela e RPC atomica para rate limit persistente no banco;
- views privadas para resumo operacional e financeiro por cliente.

## Por que esta abordagem

O repositório atual nao traz a migracao-base original do schema, entao a estrategia adotada foi:

1. nao apagar tabelas nem colunas;
2. nao renomear estruturas que o app ja consome;
3. adicionar normalizacao, consistencia e performance por cima do modelo atual;
4. deixar a aplicacao pronta para aproveitar a nova base sem abrir superficie extra de seguranca.

## Como aplicar

Quando o ambiente tiver credenciais reais do banco:

```bash
npm run db:migrate:operational-restructure
```

O script faz backup local antes de enviar a alteracao.

## Brainstorm seguro para a proxima rodada

- mover `portal_token` e `token_pre_consulta` para uma tabela dedicada de links, com historico de emissao e expiracao;
- extrair `signatures` de `perfil_complementar` para uma tabela propria versionada;
- criar uma timeline clinica consolidada em view/materialized view para dashboard e busca;
- criar catalogo de servicos por usuaria com precificacao padrao e duracao;
- consolidar RLS por `user_id` em todas as tabelas operacionais, com politicas explicitas por acao.
