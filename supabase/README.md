# Supabase CLI - Fluxo Operacional

## Comandos sempre partem da raiz do workspace
O `supabase/config.toml` está na raiz. Todos os comandos `supabase` devem ser executados
a partir do diretório do workspace (não de `projeto-salao/`).

Forma correta:
```powershell
cd "C:\Users\lucca\OneDrive\Desktop\projetos\sites\projeto salão"
npx supabase <comando>
```

Ou use `--workdir`:
```powershell
npx supabase <comando> --workdir "C:\Users\lucca\OneDrive\Desktop\projetos\sites\projeto salão"
```

## Login e link com projeto remoto

### 1. Fazer login no Supabase
```powershell
npx supabase login
```
Gera um token de acesso. Alternativamente, use um token existente:
```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."
```

### 2. Vincular ao projeto remoto
O projeto já está linkado (ref: `ccrorpxyvxzzsoafwbsj`).
Para verificar:
```powershell
npx supabase status
```

Se precisar revincular:
```powershell
npx supabase link --project-ref ccrorpxyvxzzsoafwbsj
```

## Variáveis de ambiente necessárias

No PowerShell, antes de rodar comandos que acessam o banco remoto:
```powershell
$env:SUPABASE_DB_PASSWORD = "sua-senha-do-banco"
$env:NEXT_PUBLIC_GOOGLE_CLIENT_ID = "seu-client-id"
$env:GOOGLE_CLIENT_SECRET = "seu-client-secret"
```

## Rotina de migrations

### Criar nova migration
```powershell
npx supabase migration new <nome-da-migration>
```

### Listar migrations locais
```powershell
npx supabase migration list --local
```

### Verificar o que será aplicado no remoto (dry-run)
```powershell
npx supabase db push --dry-run
```

### Aplicar migrations no remoto
```powershell
npx supabase db push
```

### Verificar estado do banco remoto
```powershell
npx supabase db remote commit
```

## Desenvolvimento local

### Pré-requisito: Docker Desktop precisa estar rodando

### Iniciar ambiente local
```powershell
npx supabase start
```

### Parar ambiente local
```powershell
npx supabase stop
```

### Resetar banco local (aplica migrations + seed)
```powershell
npx supabase db reset
```

## Estrutura do diretório supabase/

```
supabase/
  config.toml          # Configuração do projeto
  migrations/          # Migrations em ordem cronológica
  seed.sql             # Dados iniciais (roda após db reset)
  functions/           # Edge Functions (Deno)
  snippets/            # Snippets SQL reutilizáveis
```

## Edge Functions

Criar nova function:
```powershell
npx supabase functions new minha-function
```

Deploy:
```powershell
npx supabase functions deploy minha-function
```

## Troubleshooting

### "failed to connect to postgres" (local)
Docker Desktop não está rodando. Inicie o Docker Desktop.

### "Unauthorized" (remoto)
Token expirado ou não configurado. Rode `npx supabase login` novamente.

### "environment variable is unset"
Configure as variáveis de ambiente no PowerShell antes de rodar o comando:
```powershell
$env:NOME_VAR = "valor"
```

### Linter warnings
Rode o linter do Supabase para auditar segurança:
```powershell
npx supabase db lint
```

O migration `20260510163819_harden_security_and_data_protection.sql` consolida
todas as correções de segurança para eliminar os warnings atuais.