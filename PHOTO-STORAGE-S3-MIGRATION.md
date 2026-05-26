# Migracao de Fotos para AWS S3

## Objetivo

Este projeto agora grava novas fotos diretamente no AWS S3 e manteve apenas leitura compatível no servidor para assets antigos em `r2` e `cloudinary`.

O backfill abaixo atualiza os registros legados para `storage_bucket = "s3"` e reaponta as URLs para o proxy interno.

## Variaveis obrigatorias

Destino S3:

- `AWS_S3_REGION` ou `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_S3_BUCKET`, `WS_BUCKET_NAME` ou `AWS_BUCKET_NAME`

Supabase:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Legado Cloudflare R2:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

Legado Cloudinary:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

## Sequencia recomendada

1. Gere um backup antes da migracao.
2. Confirme que o deploy atual ja contem a escrita em S3 e a leitura compatível de legado.
3. Rode uma simulacao:

```bash
npm run storage:migrate:photos-to-s3 -- --dry-run
```

4. Se a simulacao listar os registros esperados, rode a migracao real:

```bash
npm run storage:migrate:photos-to-s3
```

5. Se quiser validar por lote pequeno antes, use:

```bash
npm run storage:migrate:photos-to-s3 -- --dry-run --limit=20
npm run storage:migrate:photos-to-s3 -- --limit=20
```

6. Verifique no Supabase:

- `client_photos.storage_bucket` deve convergir para `s3`
- `clientes.profile_photo_storage_bucket` deve convergir para `s3`
- `photo_url` deve apontar para `/api/media/...`

7. Depois de confirmar que nao restaram registros em `cloudinary` ou `r2`, a compatibilidade legado pode ser removida do runtime.

## Observacoes

- O script e idempotente no nivel de banco: ele so seleciona linhas ainda marcadas como `cloudinary` ou `r2`.
- O objeto migrado preserva o mesmo `storage_path` sempre que possivel, reduzindo diffs desnecessarios.
- Fotos ja arquivadas e com asset externo removido nao entram no backfill, porque a query ignora linhas com `deleted_at`.