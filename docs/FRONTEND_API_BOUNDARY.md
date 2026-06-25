# Fronteira Frontend/API

## Permitido no front

- Autenticacao Supabase via browser client.
- Realtime para atualizar telas.
- `fetch()` para APIs internas.
- Exibir signed URLs recebidas do servidor.

## Proibido no front

- `supabase.storage.from(...).upload(...)`
- `supabase.storage.from(...).remove(...)`
- `supabase.storage.from(...).createSignedUrl(...)`
- `supabase.storage.from(...).getPublicUrl(...)`
- Insert/update direto em tabelas para operacoes sensiveis de fotos, documentos, backup, archive ou restore.
- Uso de `SUPABASE_SERVICE_ROLE_KEY`.

## APIs atuais

- `GET /api/clients`: leitura de pacientes e signed URLs.
- `POST /api/gallery/upload`: upload de avatar/galeria.
- `DELETE /api/gallery/photo`: arquivamento de foto.
- `POST /api/documents/upload`: upload de documentos.
- `DELETE /api/documents`: arquivamento de documentos.
- `POST /api/backup/run`: backup manual em Supabase Storage.
- `POST /api/admin/archive/photo`: mantida como compatibilidade administrativa, tambem server-side.

## Validacoes server-side

Cada rota sensivel deve:

- validar sessao;
- validar dono do cliente, pasta, foto ou documento;
- so depois usar service role para Storage;
- gravar metadata no banco;
- retornar signed URLs, nunca URL publica de bucket privado.

## Estado atual

`hooks/useClients.ts` e `hooks/useCompanyDocuments.ts` nao fazem mais upload/delete direto no Supabase Storage. O browser client permanece para realtime.
