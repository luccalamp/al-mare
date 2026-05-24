#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { getDatabaseConnectionString, getSupabaseProjectRef } = require('./env');

const BACKUP_ROOT = path.resolve(__dirname, '..', 'backups', 'db');
const POLICY_PREFIX = '[backup-policy]';

function sanitizeReason(value) {
  const normalized = String(value || 'manual')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'manual';
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function normalizeWorkspacePath(value) {
  return value.replace(/\\/g, '/');
}

function safeGetProjectRef() {
  try {
    return getSupabaseProjectRef();
  } catch {
    return null;
  }
}

function getConnectionOptions() {
  return {
    connectionString: getDatabaseConnectionString(),
    ssl: { rejectUnauthorized: false },
  };
}

async function listTables(client) {
  const { rows } = await client.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
      AND table_schema IN ('public', 'supabase_migrations')
    ORDER BY table_schema, table_name
  `);

  return rows;
}

async function listColumns(client, tableSchema, tableName) {
  const { rows } = await client.query(
    `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `,
    [tableSchema, tableName]
  );

  return rows;
}

async function readTableRows(client, tableSchema, tableName) {
  const qualifiedName = `${quoteIdentifier(tableSchema)}.${quoteIdentifier(tableName)}`;
  const { rows } = await client.query(`SELECT * FROM ${qualifiedName}`);
  return rows;
}

async function buildBackupPayload(client, reason, metadata) {
  const exportedAt = new Date().toISOString();
  const payload = {
    exported_at: exportedAt,
    reason,
    source: {
      project_ref: safeGetProjectRef(),
      generated_by: 'scripts/backup.js',
    },
    table_counts: {},
    table_schemas: {},
    tables: {},
    metadata,
  };

  const tables = await listTables(client);
  for (const table of tables) {
    const tableKey = `${table.table_schema}.${table.table_name}`;
    const [columns, rows] = await Promise.all([
      listColumns(client, table.table_schema, table.table_name),
      readTableRows(client, table.table_schema, table.table_name),
    ]);

    payload.table_schemas[tableKey] = columns;
    payload.tables[tableKey] = rows;
    payload.table_counts[tableKey] = rows.length;
  }

  return payload;
}

function summarizeRowCount(tableCounts) {
  return Object.values(tableCounts).reduce((total, current) => total + Number(current || 0), 0);
}

async function createLocalDatabaseBackup(options = {}) {
  const reason = sanitizeReason(options.reason);
  const metadata = options.metadata || {};
  const client = new Client(getConnectionOptions());

  await client.connect();
  try {
    const payload = await buildBackupPayload(client, reason, metadata);
    const dayFolder = payload.exported_at.slice(0, 10);
    const timestamp = payload.exported_at.replace(/[:.]/g, '-');
    const backupDir = path.join(BACKUP_ROOT, dayFolder);
    const fileName = `${timestamp}--${reason}.json`;
    const absoluteFilePath = path.join(backupDir, fileName);
    const repoRelativePath = normalizeWorkspacePath(path.relative(path.resolve(__dirname, '..'), absoluteFilePath));

    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(absoluteFilePath, JSON.stringify(payload, null, 2), 'utf8');
    fs.writeFileSync(
      path.join(BACKUP_ROOT, 'latest.json'),
      JSON.stringify(
        {
          exported_at: payload.exported_at,
          reason,
          file: repoRelativePath,
          table_counts: payload.table_counts,
          metadata,
        },
        null,
        2
      ),
      'utf8'
    );

    return {
      exportedAt: payload.exported_at,
      filePath: absoluteFilePath,
      relativePath: repoRelativePath,
      tableCount: Object.keys(payload.table_counts).length,
      rowCount: summarizeRowCount(payload.table_counts),
    };
  } finally {
    await client.end();
  }
}

async function runProtectedDatabaseChange(reason, executeChange, metadata = {}) {
  console.log(`${POLICY_PREFIX} criando backup local obrigatorio antes da alteracao...`);
  const backup = await createLocalDatabaseBackup({
    reason,
    metadata: {
      ...metadata,
      policy: 'pre-change-local-backup',
    },
  });

  console.log(
    `${POLICY_PREFIX} backup salvo em ${backup.relativePath} (${backup.tableCount} tabelas, ${backup.rowCount} registros).`
  );

  const result = await executeChange({ backup });
  console.log(`${POLICY_PREFIX} alteracao concluida com backup local confirmado.`);
  return { backup, result };
}

function printHelp() {
  console.log('Uso: node ./scripts/backup.js [motivo]');
  console.log('Exemplo: npm run backup:local -- pre-deploy');
  console.log('Destino: backups/db/<YYYY-MM-DD>/<timestamp>--<motivo>.json');
}

async function runFromCli() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const reason = args.join('-') || 'manual';
  const backup = await createLocalDatabaseBackup({
    reason,
    metadata: {
      initiated_by: 'cli',
    },
  });

  console.log(`${POLICY_PREFIX} backup manual salvo em ${backup.relativePath}.`);
}

if (require.main === module) {
  runFromCli().catch((error) => {
    console.error(`${POLICY_PREFIX} falha ao gerar backup local:`, error.message);
    process.exit(1);
  });
}

module.exports = {
  BACKUP_ROOT,
  createLocalDatabaseBackup,
  runProtectedDatabaseChange,
};