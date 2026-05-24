#!/usr/bin/env node
const { Client } = require('pg');
const { getDatabaseConnectionString } = require('./env');
const { runProtectedDatabaseChange } = require('./backup');

const connectionString = getDatabaseConnectionString();

async function applyMigration() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  
  await client.connect();
  try {
    console.log('✓ Conectado ao Supabase');
    
    // Adicionar coluna de assinatura
    await client.query(`
      ALTER TABLE ficha_anamnese_capilar
        ADD COLUMN IF NOT EXISTS assinatura_base64 TEXT,
        ADD COLUMN IF NOT EXISTS data_assinatura TIMESTAMPTZ;
    `);
    console.log('✓ Colunas de assinatura adicionadas');
    
    // Criar índice
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ficha_assinatura_exists ON ficha_anamnese_capilar (cliente_id) 
        WHERE assinatura_base64 IS NOT NULL;
    `);
    console.log('✓ Índice de assinatura criado');
    
    // Registrar a migração
    await client.query(`
      INSERT INTO supabase_migrations.schema_migrations (version, name)
      VALUES ('20260418150000', 'add_assinatura_to_ficha')
      ON CONFLICT DO NOTHING;
    `);
    console.log('✓ Migração registrada no histórico');
    
    console.log('\n✓ Migração de assinatura aplicada com sucesso!');
  } finally {
    await client.end();
  }
}

runProtectedDatabaseChange(
  'apply_assinatura_migration',
  applyMigration,
  {
    script: 'scripts/apply_assinatura_migration.js',
  }
).catch((error) => {
  console.error('✗ Execucao protegida falhou:', error.message);
  process.exit(1);
});
