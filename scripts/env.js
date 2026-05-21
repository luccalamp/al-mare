const fs = require('fs');
const path = require('path');

function readEnvFromDotenv(name) {
  const escapedName = name.replace(/[\\-\\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(__dirname, '..', '.env.local'),
  ];

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;

      const content = fs.readFileSync(candidate, 'utf8');
      const match = content.match(new RegExp(`^${escapedName}\\s*=\\s*(.*)$`, 'mi'));
      if (!match || !match[1]) continue;

      let value = match[1].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (value) {
        return value;
      }
    } catch {
      // Ignore unreadable dotenv candidates and continue with the next one.
    }
  }

  return null;
}

function getEnv(name) {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }

  const dotenvValue = readEnvFromDotenv(name);
  return dotenvValue?.trim() || null;
}

function requireEnv(name) {
  const value = getEnv(name);
  if (value) {
    return value;
  }

  throw new Error(`Missing required environment variable: ${name}`);
}

function getSupabaseProjectRef() {
  const projectRef = getEnv('SUPABASE_PROJECT_REF');
  if (projectRef) {
    return projectRef;
  }

  const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const match = supabaseUrl?.match(/^https:\/\/([^.]+)\.supabase\.co/i);
  if (match?.[1]) {
    return match[1];
  }

  throw new Error('Missing required environment variable: SUPABASE_PROJECT_REF');
}

function getDatabaseConnectionString() {
  const directConnectionString = getEnv('SUPABASE_DB_URL') || getEnv('DATABASE_URL');
  if (directConnectionString) {
    return directConnectionString;
  }

  const password = requireEnv('SUPABASE_DB_PASSWORD');
  const projectRef = getSupabaseProjectRef();
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;
}

module.exports = {
  getDatabaseConnectionString,
  getEnv,
  getSupabaseProjectRef,
  requireEnv,
};