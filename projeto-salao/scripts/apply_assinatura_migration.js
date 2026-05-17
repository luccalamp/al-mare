#!/usr/bin/env node
const { Client } = require('pg');
const { getDatabaseConnectionString } = require('./env');

const connectionString = getDatabaseConnectionString();

async function runMigration() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  
  try {
    await client.connect();
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
  } catch (error) {
    console.error('✗ Erro ao aplicar migração:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
