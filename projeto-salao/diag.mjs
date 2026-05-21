import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readEnvFromDotenv(name) {
  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '..', '.env.local'),
    path.resolve(__dirname, '..', '..', '.env.local'),
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const content = fs.readFileSync(p, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const match = line.match(/^\s*([^=]+)\s*=\s*(.*)$/);
        if (match && match[1].trim() === name) {
          let value = match[2].trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          return value;
        }
      }
    } catch (e) {}
  }
  return null;
}

function readEnv(name) {
  return process.env[name]?.trim() || readEnvFromDotenv(name)?.trim() || null;
}

async function run() {
  const GOOGLE_DRIVE_FOLDER_ID = readEnv('GOOGLE_DRIVE_FOLDER_ID');
  const CLIENT_EMAIL = readEnv('GOOGLE_DRIVE_CLIENT_EMAIL');
  const PRIVATE_KEY = readEnv('GOOGLE_DRIVE_PRIVATE_KEY');
  const JSON_CREDS = readEnv('GOOGLE_DRIVE_CREDENTIALS_JSON');
  const SUPABASE_URL = readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const SERVICE_ROLE_KEY = readEnv('SUPABASE_SERVICE_ROLE_KEY');

  console.log('--- ENV CLASSIFICATION ---');
  if (!GOOGLE_DRIVE_FOLDER_ID) console.log('GOOGLE_DRIVE_FOLDER_ID: unset');
  else if (GOOGLE_DRIVE_FOLDER_ID.startsWith('http')) console.log('GOOGLE_DRIVE_FOLDER_ID: looks like a URL');
  else if (GOOGLE_DRIVE_FOLDER_ID.includes('/')) console.log('GOOGLE_DRIVE_FOLDER_ID: looks like a path');
  else console.log('GOOGLE_DRIVE_FOLDER_ID: looks like a plain id');

  if (CLIENT_EMAIL && PRIVATE_KEY) console.log('Drive Credentials: configured via EMAIL + KEY');
  else if (JSON_CREDS) console.log('Drive Credentials: configured via JSON env');
  else console.log('Drive Credentials: missing');

  console.log('Supabase URL:', SUPABASE_URL ? 'present' : 'missing');
  console.log('Supabase Service Role Key:', SERVICE_ROLE_KEY ? 'present' : 'missing');

  if (SUPABASE_URL && SERVICE_ROLE_KEY) {
    console.log('\n--- SUPABASE PROBE ---');
    try {
      const isSecretKey = SERVICE_ROLE_KEY.startsWith('sb_secret_');
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: {
           headers: isSecretKey ? { Authorization: '' } : {},
           fetch: isSecretKey ? async (input, init) => {
             const h = new Headers(init?.headers);
             h.set('apikey', SERVICE_ROLE_KEY);
             return fetch(input, { ...init, headers: h });
           } : fetch
        }
      });

      const { error: err1 } = await supabase.from('google_drive_files').select('id').limit(1);
      console.log('google_drive_files probe:', err1 ? 'failure - ' + err1.message : 'success');

      const { error: err2 } = await supabase.from('client_photos').select('id').limit(1);
      console.log('client_photos probe:', err2 ? 'failure - ' + err2.message : 'success');
    } catch (e) {
      console.log('Supabase probe error:', e.message);
    }
  }

  if ((CLIENT_EMAIL && PRIVATE_KEY) || JSON_CREDS) {
    console.log('\n--- DRIVE PROBE ---');
    try {
      let auth;
      if (JSON_CREDS) {
        const creds = JSON.parse(JSON_CREDS);
        auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/drive.file'] });
      } else {
        auth = new google.auth.JWT(CLIENT_EMAIL, null, PRIVATE_KEY.replace(/\\n/g, '\n'), ['https://www.googleapis.com/auth/drive.file']);
      }
      const drive = google.drive({ version: 'v3', auth });
      
      try {
        await drive.files.list({ pageSize: 1 });
        console.log('Drive files.list probe: success');
      } catch (e) {
        console.log('Drive files.list probe: failure - ' + e.message);
      }

      if (GOOGLE_DRIVE_FOLDER_ID && !GOOGLE_DRIVE_FOLDER_ID.includes('/') && !GOOGLE_DRIVE_FOLDER_ID.startsWith('http')) {
        try {
          const res = await drive.files.get({ fileId: GOOGLE_DRIVE_FOLDER_ID, fields: 'id,name,mimeType,trashed' });
          console.log('Drive folder access probe: success (Name: ' + res.data.name + ')');
        } catch (e) {
          console.log('Drive folder access probe: failure - ' + e.message);
        }
      }
    } catch (e) {
      console.log('Drive probe error:', e.message);
    }
  }
}

run();
