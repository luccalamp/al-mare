# Plano de migracao AWS/S3 para Supabase Storage

## Diagnostico encontrado

AWS/S3 era usado no fluxo novo de backups em `lib/server/backup.ts`, enviando o mesmo JSON para `ops-backups` e para S3 quando `BACKUP_S3_*` existia. Esse envio novo foi removido; backups novos agora ficam apenas em Supabase Storage.

O pacote `@aws-sdk/client-s3` continua no projeto porque `scripts/migrate-aws-photos-to-supabase.ts` precisa ler fotos legadas em S3. Ele deve ser removido somente depois que o relatorio de migracao confirmar que nao ha fotos pendentes.

As tabelas com historico de storage sao:

- `client_photos`: usa `storage_bucket`, `storage_path` e agora tambem `optimized_storage_path`, `thumbnail_storage_path`, metadados de imagem e campos de migracao.
- `backup_run_history`: mantem `s3_bucket` e `s3_key` como legado, mas backups novos gravam `destination = "supabase-storage"` e deixam esses campos nulos.
- `company_documents`: usa `storage_bucket`, `storage_path` e `public_url`; novos registros gravam `public_url` como referencia interna `supabase://bucket/path`, nao URL publica.

Buckets Supabase usados:

- `anamnese-fotos`: privado, fotos e thumbnails da galeria/perfil.
- `company-documents`: privado, documentos internos.
- `recovery-quarantine`: privado, quarentena para archive/restore.
- `ops-backups`: privado, backups operacionais.

O front ainda usa o client Supabase para autenticacao/realtime. Os acessos sensiveis removidos do front foram:

- upload direto em `hooks/useClients.ts`;
- delete direto em `hooks/useClients.ts`;
- signed URL/public URL gerada no browser em `hooks/useClients.ts`;
- upload direto em `hooks/useCompanyDocuments.ts`;
- delete direto em `hooks/useCompanyDocuments.ts`.

## APIs internas obrigatorias

- `POST /api/gallery/upload`: valida usuario, valida dono do cliente, otimiza imagem, faz upload server-side e registra metadata quando for galeria.
- `DELETE /api/gallery/photo`: valida usuario e arquiva foto via quarentena.
- `POST /api/documents/upload`: valida usuario, valida dono da pasta, envia arquivo ao bucket privado e registra documento.
- `DELETE /api/documents`: valida usuario e arquiva documento via quarentena.
- `GET /api/clients`: gera signed URLs server-side para avatar, imagem otimizada e thumbnail.
- `POST /api/backup/run`: executa backup manual para `ops-backups`.

## Riscos de perda de fotos

- Registros antigos podem ter apenas URL publica AWS sem `s3_bucket/s3_key`; o script tenta baixar por URL quando nao ha bucket/key.
- Fotos privadas no S3 exigem credenciais `MIGRATION_AWS_*` e bucket real (`MIGRATION_AWS_BUCKET`, `AWS_S3_BUCKET`, `AWS_BUCKET_NAME` ou `WS_BUCKET_NAME`); sem elas o dry-run funciona, mas a migracao real falha.
- Se a migration do banco nao for aplicada antes do app novo, campos como `optimized_storage_path` e `thumbnail_storage_path` nao existirao.
- Signed URLs expiram; a UI deve recarregar dados pelo servidor quando uma URL antiga falhar.

## Plano seguro

1. Aplicar a migration `20260622000000_storage_supabase_only_images.sql`.
2. Rodar dry-run: `npm run storage:migrate-aws-photos`.
3. Conferir inventario, total de candidatos e amostra.
4. Migrar uma amostra: `npx tsx scripts/migrate-aws-photos-to-supabase.ts --execute --limit=5`.
5. Validar galeria, thumbnails, portal e buckets privados.
6. Migrar o restante: `npx tsx scripts/migrate-aws-photos-to-supabase.ts --execute`.
7. Conferir registros com `migration_status = 'error'`.
8. Manter AWS intacto ate o relatorio confirmar que nao ha pendencias.
9. So entao remover o SDK AWS e variaveis `MIGRATION_AWS_*`.
