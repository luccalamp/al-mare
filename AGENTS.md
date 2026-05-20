# Al'maré Saúde Capilar - Contexto do Projeto

## Deploy e Infraestrutura

### Vercel
- **Projeto**: `al-mare` (prj_k8DwW0egrGdGGtqrtqLoxEnEewlM)
- **Produção**: https://jakoliveira.com.br
- **Branch de produção**: `main`
- **Branch de desenvolvimento**: `develop`
- **Regra**: Push para `develop` → Preview deployment. Push para `main` → Produção.
- **Token Vercel**: `(configurado nas variáveis de ambiente do CI/CD)`
- **Scope**: `team_FkQFb1pwwgz9aeqo8U3U2u8R`
- **Projeto antigo removido**: `projeto-salao` (não usar mais)

### Supabase
- **Project Ref**: `prj_k8DwW0egrGdGGtqrtqLoxEnEewlM`
- **Migrations**: `supabase/migrations/`
- **Edge Functions**: `supabase/functions/` (audit-cleanup, quarantine-cleanup)

## Arquitetura de Fotos - Google Drive + Supabase

### Problema Original
Fotos originais (pesadas, vindas do celular) estavam sendo armazenadas diretamente no Supabase Storage, inflando o uso de storage e custos.

### Solução Implementada
Upload das fotos originais para o **Google Drive** via Service Account, mantendo no Supabase apenas uma referência leve (ID do arquivo).

### Componentes

#### 1. Google Drive Service
- **Arquivo**: `lib/server/driveService.ts`
- **Função principal**: `uploadImageToDrive(fileBuffer, filename, mimeType, clienteId)` → retorna apenas o `driveFileId` (string)
- **Autenticação**: Service Account do Google Cloud (variável `GOOGLE_DRIVE_CREDENTIALS` ou `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS`)
- **Estrutura de pastas no Drive**: `almare-clinica/clientes/{clienteId}/fotos/`
- **Nome do arquivo**: `{timestamp}_{filename}` (único)

#### 2. Tabela de Referência no Supabase
- **Tabela**: `public.google_drive_files`
- **Colunas principais**:
  - `id` (UUID)
  - `user_id` (UUID)
  - `cliente_id` (UUID)
  - `drive_file_id` (TEXT) - ID do arquivo no Google Drive
  - `drive_web_view_link` (TEXT)
  - `drive_thumbnail_link` (TEXT)
  - `original_filename` (TEXT)
  - `mime_type` (TEXT)
  - `size_bytes` (BIGINT)
  - `md5_checksum` (TEXT)
  - `category` (TEXT) - 'antes', 'depois', 'referencia', 'anamnese', 'documento'
  - `caption` (TEXT)
  - `anotacao_tecnica` (TEXT)
  - `captured_at` (TIMESTAMPTZ)
  - `drive_folder_path` (TEXT)
  - `sync_status` (TEXT) - 'pending', 'synced', 'failed', 'deleted'
  - `deleted_at`, `deleted_by`, `delete_reason` (soft delete)

#### 3. API Route
- **Endpoint**: `POST /api/google-drive`
- **Autenticação**: Token via header `Authorization: Bearer {ADMIN_OPERATIONS_TOKEN}`
- **Body**: FormData com `file`, `clienteId`, `userId`, `category`, `caption`, `anotacaoTecnica`
- **Retorno**: `{ success: true, drive: { driveFileId, ... }, database: { ... } }`

#### 4. Variáveis de Ambiente Necessárias
```
GOOGLE_DRIVE_CREDENTIALS='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
GOOGLE_SERVICE_ACCOUNT_CREDENTIALS='...' (alternativa)
ADMIN_OPERATIONS_TOKEN='seu-token-aqui'
```

### Fluxo de Upload
1. Frontend envia foto via FormData para `/api/google-drive`
2. API chama `uploadImageToDrive()` → upload para Google Drive
3. API chama `saveDriveReferenceToSupabase()` → salva referência no banco
4. Retorna o `driveFileId` e os dados do registro

### Fluxo de Listagem
1. Frontend chama `GET /api/google-drive?clienteId=...&userId=...`
2. API chama `getClientDriveFiles()` → busca na tabela `google_drive_files`
3. Para exibir thumbnail, usar `drive_thumbnail_link` ou gerar via `getDriveFileUrl()`

### Fluxo de Deleção
1. Frontend chama `DELETE /api/google-drive` com `{ fileId, userId, alsoDeleteFromDrive }`
2. API faz soft delete no Supabase (`deleted_at = NOW()`)
3. Se `alsoDeleteFromDrive = true`, deleta do Google Drive via `deleteFromGoogleDrive()`

## Auditoria e Limpeza

### Triggers de Auditoria
- **Ativos apenas em**: `clientes` e `ficha_anamnese_capilar`
- **Removidos de**: agendamentos, client_photos, services, clinic_preferences, company_document_folders, company_documents, diagnostico_capilar, historico_procedimentos, manutencao_homecare, pre_consulta_envios
- **Tabela**: `private.row_change_audit`
- **Arquivo morto**: `private.row_change_audit_archive`

### Limpeza Automática
- **Quarantine**: `/api/internal/cleanup/quarantine` - roda diariamente às 4h (cron: `0 4 * * *`)
  - Deleta arquivos dos buckets `recovery-quarantine` e `ops-backups` com >48h
  - Limpa referências no banco
- **Audit**: `/api/internal/cleanup/audit` - roda diariamente às 5h (cron: `0 5 * * *`)
  - Arquiva e deleta audit entries com >30 dias
  - Limpa arquivo morto com >90 dias

## Emails Autorizados
- `luccalamp12@gmail.com` (approved)
- `jakoliveira.aju@gmail.com` (approved)

## Comandos Úteis

### Deploy Preview
```bash
cd C:\Users\lucca\OneDrive\Desktop\projetos\sites\al-mare
npx vercel deploy --token $VERCEL_TOKEN --scope team_FkQFb1pwwgz9aeqo8U3U2u8R --yes
```

### Deploy Produção
```bash
cd C:\Users\lucca\OneDrive\Desktop\projetos\sites\al-mare
npx vercel deploy --prod --token $VERCEL_TOKEN --scope team_FkQFb1pwwgz9aeqo8U3U2u8R --yes
```

### Deploy via Git
```bash
git checkout develop
# faça alterações
git add -A
git commit -m "sua mensagem"
git push origin develop
# Vercel detecta e cria preview automaticamente
```

## Estrutura de Pastas Relevante
```
projeto-salao/
├── lib/server/
│   ├── driveService.ts          (upload para Google Drive)
│   ├── googleDrive.ts           (serviço completo legado)
│   └── supabaseAdmin.ts         (cliente admin Supabase)
├── app/api/
│   ├── google-drive/route.ts    (API de upload/listagem/delete)
│   └── internal/cleanup/
│       ├── quarantine/route.ts  (cron de limpeza quarentena)
│       └── audit/route.ts       (cron de limpeza auditoria)
── supabase/
│   ├── migrations/              (migrations SQL)
│   └── functions/
│       ├── quarantine-cleanup/  (Edge Function)
│       └── audit-cleanup/       (Edge Function)
└── vercel.json                  (configuração de crons)
```
