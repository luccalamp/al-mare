const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { getDatabaseConnectionString } = require('./env');
const { runProtectedDatabaseChange } = require('./backup');

const connectionString = getDatabaseConnectionString();
const migrationFile = 'supabase/migrations/20260617153547_operational_restructure_foundation.sql';

async function applyMigration() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const sqlPath = path.join(__dirname, '..', migrationFile);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executando reestruturacao operacional do banco...');
    await client.query(sql);
    console.log('--- REESTRUTURACAO CONCLUIDA COM SUCESSO. ---');
  } finally {
    await client.end();
  }
}

runProtectedDatabaseChange(
  'apply-operational-restructure',
  applyMigration,
  {
    script: 'scripts/apply_operational_restructure.js',
    migrationFile,
  }
).catch((error) => {
  console.error('Execucao protegida falhou:', error.message);
  process.exit(1);
});
