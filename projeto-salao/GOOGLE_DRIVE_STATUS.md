# Status Atual do Sistema Google Drive

Data da revisao: 2026-05-20

## Resumo

O sistema de Google Drive esta funcionalmente estruturado em tres camadas:

1. `app/api/google-drive/route.ts`
2. `lib/server/googleDrive.ts`
3. `public.google_drive_files` no Supabase

Hoje, a integracao usa o Google Drive como armazenamento primario do arquivo original e o Supabase apenas como catalogo leve de metadados e referencia.

## Arquitetura real em uso

### 1. Endpoint principal

- Rota: `POST|GET|DELETE /api/google-drive`
- Arquivo: `app/api/google-drive/route.ts`
- Autenticacao atual: `Authorization: Bearer {ADMIN_OPERATIONS_TOKEN}`
- Observacao importante: a rota foi marcada como publica no `middleware`, mas continua protegida pelo token no proprio handler.

### 2. Servico ativo

- Arquivo principal: `lib/server/googleDrive.ts`
- Responsabilidades:
  - ler credenciais do Google
  - garantir a estrutura de pastas no Drive
  - fazer upload e delete fisico no Drive
  - salvar/listar/atualizar referencias no Supabase

### 3. Wrapper legado compatibilizado

- Arquivo: `lib/server/driveService.ts`
- Estado atual: wrapper de compatibilidade sobre `lib/server/googleDrive.ts`
- Motivo: evitar divergencia entre duas implementacoes diferentes da mesma integracao

### 4. Persistencia

- Tabela: `public.google_drive_files`
- Migration relevante: `supabase/migrations/20260519242000_google_drive_files_table.sql`
- Uso atual:
  - salvar `drive_file_id`
  - manter metadados clinicos e tecnicos
  - controlar soft delete
  - controlar `sync_status`

## Fluxo atual

### Upload

1. O cliente envia `file`, `clienteId`, `userId` e metadados opcionais para `/api/google-drive`
2. A API valida token, UUIDs, categoria e propriedade do cliente
3. O arquivo sobe para o Google Drive
4. A referencia e salva em `google_drive_files`
5. Se o save no banco falhar, a API tenta remover o arquivo recem-enviado do Drive para evitar orfao

### Listagem

1. O cliente chama `GET /api/google-drive?clienteId=...&userId=...`
2. A API valida token, UUIDs, categoria e ownership do cliente
3. A consulta e feita em `google_drive_files`

### Delecao

1. O cliente chama `DELETE /api/google-drive` com `fileId`, `userId` e `alsoDeleteFromDrive`
2. O registro e soft-deletado no Supabase
3. Se `alsoDeleteFromDrive = true`, a API tenta apagar o arquivo fisico do Google Drive
4. O `sync_status` passa a refletir o resultado:
   - `pending` durante a tentativa de delete externo
   - `deleted` quando o delete no Drive conclui
   - `failed` quando o delete no Drive falha

## Correcoes aplicadas nesta revisao

### 1. Autenticacao da rota alinhada com o middleware

Problema anterior:

- a rota exigia `ADMIN_OPERATIONS_TOKEN` no handler
- mas o `middleware` ainda tratava `/api/google-drive` como API privada de sessao
- resultado: chamadas com token administrativo podiam morrer antes de chegar no handler

Correcao:

- `/api/google-drive` entrou em `PUBLIC_API_PREFIXES`
- a protecao continua no proprio handler via bearer token

### 2. Credenciais do Google unificadas

Problema anterior:

- o servico ativo aceitava apenas `GOOGLE_DRIVE_CREDENTIALS`
- o wrapper legado aceitava outras variaveis
- a documentacao e o comportamento real nao batiam

Correcao:

- `lib/server/googleDrive.ts` agora aceita:
  - `GOOGLE_DRIVE_CREDENTIALS`
  - `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS`
  - `GOOGLE_SERVICE_ACCOUNT`
  - `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- o parse agora normaliza `private_key` com `\n`

### 3. Rollback de upload orfao

Problema anterior:

- se o upload no Drive funcionasse e o insert no Supabase falhasse
- o sistema deixava arquivo orfao no Google Drive

Correcao:

- o handler agora tenta remover o arquivo do Drive quando a persistencia no banco falha

### 4. Validacao de entrada endurecida

Correcao aplicada:

- validacao de UUID para `clienteId`, `userId` e `fileId`
- validacao de `category`
- validacao de `limit` e `offset`
- validacao de arquivo vazio

### 5. Validacao de ownership do cliente

Problema anterior:

- a API confiava no `userId` recebido sem confirmar se o `clienteId` pertencia mesmo a esse usuario

Correcao:

- o sistema agora verifica se o `clienteId` realmente pertence ao `userId` informado antes de upload ou listagem

### 6. Divergencia entre `driveService.ts` e `googleDrive.ts`

Problema anterior:

- havia duas implementacoes independentes para Drive
- isso aumentava risco de regressao e doc desatualizada

Correcao:

- `driveService.ts` foi convertido em wrapper de compatibilidade sobre `googleDrive.ts`

## Estado atual de seguranca

### Pontos bons

- token administrativo ainda e exigido pela API
- ownership do cliente agora e verificado
- o `sync_status` permite identificar falhas de sincronizacao de delete
- uploads orfaos passaram a ter rollback imediato quando o banco falha

### Limitacoes atuais

- a API ainda depende de `ADMIN_OPERATIONS_TOKEN`, nao de sessao autenticada de staff
- `userId` continua fazendo parte do contrato da API, embora agora seja validado
- quando o delete do Drive falha, o registro fica coerente no banco (`failed`), mas o arquivo externo exige tratamento operacional posterior

## Variaveis de ambiente atualmente suportadas

### Google Drive

- `GOOGLE_DRIVE_CREDENTIALS`
- `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS`
- `GOOGLE_SERVICE_ACCOUNT`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`

### Autenticacao da API

- `ADMIN_OPERATIONS_TOKEN`

### Banco

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Arquivos relevantes

- `app/api/google-drive/route.ts`
- `lib/server/googleDrive.ts`
- `lib/server/driveService.ts`
- `lib/server/supabaseAdmin.ts`
- `middleware.ts`
- `supabase/migrations/20260519242000_google_drive_files_table.sql`

## Validacao executada

- `npm run build` em `projeto-salao`
- Resultado: sucesso

## Recomendacoes de evolucao

1. Migrar a autenticacao da rota para o mesmo modelo de staff/session usado no restante do sistema, se o endpoint passar a ser consumido diretamente pela interface autenticada.
2. Criar uma rotina operacional para reprocessar registros de `google_drive_files` com `sync_status = 'failed'`.
3. Se houver UI dedicada para Drive, remover a necessidade de enviar `userId` do cliente e derivar isso do contexto autenticado.