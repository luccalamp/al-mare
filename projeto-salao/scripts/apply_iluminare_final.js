const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { getDatabaseConnectionString } = require('./env');

const connectionString = getDatabaseConnectionString();

async function runMigration() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Conectado com sucesso ao Iluminare Studio DB!");

    const sqlPath = path.join(__dirname, '../supabase/migrations/20260417_iluminare_operational.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Executando a Grande Refatoração Operacional...");
    await client.query(sql);
    console.log("--- SUCESSO! Banco de dados migrado para o novo fluxo Iluminare. ---");

  } catch (err) {
    console.error("Erro na migração:", err.message);
  } finally {
    await client.end();
  }
}

runMigration();
