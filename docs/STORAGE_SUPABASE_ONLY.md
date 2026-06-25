# Storage Supabase Only

## Buckets

- `anamnese-fotos`: fotos de perfil, fotos de evolucao, tricoscopia e thumbnails.
- `company-documents`: documentos internos da empresa.
- `recovery-quarantine`: objetos arquivados antes de restore definitivo.
- `ops-backups`: exports JSON de backup.

Todos devem permanecer privados. O front nao deve chamar `supabase.storage.from(...)` para upload, delete ou signed URL.

## Fluxo novo de upload

Fotos:

1. Browser envia `multipart/form-data` para `POST /api/gallery/upload`.
2. API valida sessao e dono do cliente.
3. API otimiza a imagem com `sharp`.
4. API faz upload no bucket privado usando service role no servidor.
5. API grava metadata em `client_photos`.
6. API devolve signed URL e thumbnail signed URL.

Documentos:

1. Browser envia `multipart/form-data` para `POST /api/documents/upload`.
2. API valida sessao e dono da pasta.
3. API grava no bucket `company-documents`.
4. API grava metadata em `company_documents`.
5. API devolve signed URL.

Backups:

1. `POST /api/backup/run` ou rota interna executa `runBackupExport`.
2. O JSON vai somente para `ops-backups`.
3. `backup_run_history.destination` fica `supabase-storage`.
4. `s3_bucket` e `s3_key` ficam nulos para backups novos.

## Legado AWS

Arquivos antigos em AWS/S3 nao devem ser apagados agora. Eles sao fonte de leitura para `scripts/migrate-aws-photos-to-supabase.ts` ate a migracao terminar e ser validada.
