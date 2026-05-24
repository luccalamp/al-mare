# Backups locais

Os snapshots JSON gerados por `scripts/backup.js` ficam nesta pasta.

- Caminho padrao: `backups/db/<YYYY-MM-DD>/<timestamp>--<motivo>.json`
- Ultima execucao: `backups/db/latest.json`
- Os arquivos gerados sao ignorados pelo Git; apenas este README permanece versionado.

Antes de qualquer alteracao manual de banco, gere um snapshot com:

```bash
npm run backup:local -- motivo-da-alteracao
```