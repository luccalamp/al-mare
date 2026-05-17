#!/usr/bin/env node
import process from 'process';
import { createClient } from '@supabase/supabase-js';

function usage() {
  console.log('Usage: node scripts/investigate-missing-clients.mjs [--id <client-uuid>] [--tx <transaction-id>] [--limit <n>]');
  process.exit(1);
}

const argv = process.argv.slice(2);
let id = null;
let tx = null;
let limit = 200;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--id') {
    id = argv[++i];
  } else if (a === '--tx') {
    tx = Number(argv[++i]);
  } else if (a === '--limit') {
    limit = Number(argv[++i]);
  } else if (a === '--help' || a === '-h') {
    usage();
  } else {
    usage();
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing environment variables. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function run() {
  try {
    const params = {
      p_table_name: 'clientes',
      p_limit: limit,
    };
    if (id) params.p_record_identity = { id };
    if (tx) params.p_transaction_id = tx;

    const { data, error } = await supabase.rpc('admin_list_row_change_audit', params);
    if (error) {
      console.error('RPC error:', error.message || error);
      process.exit(3);
    }

    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) {
      console.log('No audit entries found for clientes with the given filters.');
      return;
    }

    console.log(`Found ${rows.length} audit rows (showing up to ${limit}).`);
    for (const r of rows) {
      const recordId = r.record_identity?.id ?? (r.old_record?.id ?? r.new_record?.id ?? null);
      const oldDeletedAt = r.old_record?.deleted_at ?? null;
      const newDeletedAt = r.new_record?.deleted_at ?? null;
      console.log('------------------------------------------------------------');
      console.log(`audit_id: ${r.audit_id}  table: ${r.table_name}  op: ${r.operation}  changed_at: ${r.changed_at}`);
      console.log(`transaction_id: ${r.transaction_id}  jwt_subject: ${r.jwt_subject}  jwt_role: ${r.jwt_role}`);
      console.log(`record_id: ${recordId}  old.deleted_at: ${oldDeletedAt}  new.deleted_at: ${newDeletedAt}`);
      console.log('old_record:', JSON.stringify(r.old_record ?? null));
      console.log('new_record:', JSON.stringify(r.new_record ?? null));
    }
  } catch (err) {
    console.error('Unexpected error:', err instanceof Error ? err.message : err);
    process.exit(4);
  }
}

run();
