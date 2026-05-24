const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { getDatabaseConnectionString } = require('./env');
const { runProtectedDatabaseChange } = require('./backup');

const connectionString = getDatabaseConnectionString();

async function applyMigration() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    console.log("Conectado com sucesso ao Iluminare Studio DB!");

    const sqlPath = path.join(__dirname, '../supabase/migrations/20260417_iluminare_operational.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Executando a Grande Refatoração Operacional...");
    await client.query(sql);
    console.log("--- SUCESSO! Banco de dados migrado para o novo fluxo Iluminare. ---");
  } finally {
    await client.end();
  }
}

runProtectedDatabaseChange(
  'apply_iluminare_final',
  applyMigration,
  {
    script: 'scripts/apply_iluminare_final.js',
    migrationFile: 'supabase/migrations/20260417_iluminare_operational.sql',
  }
).catch((error) => {
  console.error('✗ Execucao protegida falhou:', error.message);
  process.exit(1);
});
