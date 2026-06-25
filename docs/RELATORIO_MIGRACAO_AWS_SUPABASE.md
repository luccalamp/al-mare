# Relatorio de migracao AWS/S3 para Supabase Storage

## Alteracoes entregues

- Novos uploads de fotos passam por `POST /api/gallery/upload`.
- Novos uploads de documentos passam por `POST /api/documents/upload`.
- Archive de fotos/documentos passa por APIs internas.
- Backups novos usam somente `ops-backups` em Supabase Storage.
- Signed URLs sao geradas no servidor.
- Buckets sensiveis continuam privados.
- AWS/S3 nao recebe mais arquivos novos de backup.
- AWS/S3 permanece apenas como fonte legada para o script de migracao.

## Script de migracao

Arquivo:

`scripts/migrate-aws-photos-to-supabase.ts`

Dry-run padrao:

```bash
npm run storage:migrate-aws-photos
```

Dry-run com inventario em arquivo:

```bash
npx tsx scripts/migrate-aws-photos-to-supabase.ts --dry-run --inventory=storage-migration-inventory.json
```

Migrar uma amostra:

```bash
npx tsx scripts/migrate-aws-photos-to-supabase.ts --execute --limit=5
```

Migrar um registro especifico:

```bash
npx tsx scripts/migrate-aws-photos-to-supabase.ts --execute --id=<client_photo_id>
```

Migrar todos os candidatos:

```bash
npx tsx scripts/migrate-aws-photos-to-supabase.ts --execute
```

## Variaveis para migracao AWS

Usar somente em ambiente server-side/local controlado:

- `MIGRATION_AWS_REGION`
- `MIGRATION_AWS_ACCESS_KEY_ID`
- `MIGRATION_AWS_SECRET_ACCESS_KEY`
- `MIGRATION_AWS_ENDPOINT`
- `MIGRATION_AWS_FORCE_PATH_STYLE`

O script tambem aceita `AWS_*` e `BACKUP_S3_*` como fallback legado, mas `.env.example` nao publica mais variaveis `BACKUP_S3_*`.

## Como validar que nada foi perdido

1. Contar candidatos no dry-run.
2. Rodar amostra com `--limit=5`.
3. Conferir no banco:
   - `migration_status = 'migrated'`;
   - `migrated_from = 'aws-s3'`;
   - `migrated_at` preenchido;
   - `optimized_storage_path` preenchido;
   - `thumbnail_storage_path` preenchido;
   - `legacy_s3_bucket/legacy_s3_key` preservados quando existirem.
4. Abrir a galeria no app e confirmar thumbnail.
5. Abrir foto e conferir qualidade da imagem otimizada.
6. Testar portal da cliente com token valido.
7. Confirmar que buckets seguem privados.
8. Confirmar que signed URL funciona e URL publica nao e usada para bucket privado.
9. Consultar registros com `migration_status = 'error'` e revisar `migration_error`.
10. Nao apagar AWS ate todos os registros esperados estarem migrados ou justificados.

## Quando remover AWS completamente

Remover `@aws-sdk/client-s3` e variaveis `MIGRATION_AWS_*` somente quando:

- dry-run retornar zero candidatos;
- nao houver registros `migration_status = 'error'` sem decisao;
- amostras antigas abrirem pelo Supabase Storage;
- backups recentes tiverem `destination = 'supabase-storage'`;
- nenhum codigo fora do script importar `@aws-sdk/client-s3`.

## Riscos restantes

- Fotos antigas sem `s3_bucket/s3_key` e com URL AWS privada podem exigir URL assinada ou credenciais especificas.
- Registros legados sem `user_id` podem exigir saneamento antes de archive seguro.
- A migration deve ser aplicada antes do novo fluxo de upload, porque as APIs gravam novas colunas.

## Resultado local em 2026-06-22

- `npm run storage:migrate-aws-photos`: dry-run concluido com `totalCandidates = 0`.
- `npm run lint`: sem warnings ou erros.
- `npm run build`: build concluido com sucesso.
