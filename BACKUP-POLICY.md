# Backup Policy

Toda alteracao de banco neste projeto deve gerar um backup local antes de executar SQL, migracao ou ajuste manual que possa mudar dados.

## Regras obrigatorias

1. Nenhum script que altere o banco pode rodar sem antes chamar `runProtectedDatabaseChange()` de `scripts/backup.js`.
2. Se o backup local falhar, a alteracao deve abortar imediatamente.
3. Todo backup local deve ser salvo em `backups/db/<YYYY-MM-DD>/<timestamp>--<motivo>.json`.
4. Mudancas manuais no Supabase Dashboard tambem exigem backup previo via `npm run backup:local -- <motivo>`.
5. Os artefatos de `backups/` ficam fora do Git para evitar versionar dados sensiveis, mas a pasta e a policy permanecem no repositório.

## Cobertura atual

- `scripts/apply_assinatura_migration.js`
- `scripts/apply_iluminare.js`
- `scripts/apply_iluminare_final.js`
- `scripts/final_migration.js` agora avisa explicitamente sobre o backup obrigatorio antes de SQL manual.
- O projeto continua com backup remoto operacional via `app/api/internal/backups/export/route.ts` e `lib/server/backup.ts`; o backup local adiciona uma camada imediata antes da mudanca.

## Comandos

```bash
npm run backup:local -- pre-deploy
npm run db:migrate:assinatura
npm run db:migrate:iluminare
npm run db:migrate:iluminare:final
```

## Quando criar novos scripts

Use este padrao:

```js
const { runProtectedDatabaseChange } = require('./backup');

async function applyChange() {
  // SQL ou operacao destrutiva
}

runProtectedDatabaseChange('nome-da-alteracao', applyChange, {
  script: 'scripts/nome-do-script.js',
}).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
```

## Recuperacao operacional

1. Localize o snapshot mais proximo em `backups/db/`.
2. Confirme `table_counts` e o motivo do backup no cabecalho do JSON.
3. Use o arquivo como fonte de restauracao seletiva ou como referencia para comparar o estado antes e depois.
4. Se o incidente afetar producao, preserve tambem o artefato remoto mais recente do bucket `ops-backups`.