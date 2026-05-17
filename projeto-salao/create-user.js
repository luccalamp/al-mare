const { getEnv, requireEnv } = require('./scripts/env');

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const bootstrapUserEmail = getEnv('BOOTSTRAP_USER_EMAIL') || requireEnv('SUPABASE_BOOTSTRAP_USER_EMAIL');
const bootstrapUserPassword = getEnv('BOOTSTRAP_USER_PASSWORD') || requireEnv('SUPABASE_BOOTSTRAP_USER_PASSWORD');

async function createUser() {
  const headers = {
    'apikey': serviceRoleKey,
    'Content-Type': 'application/json',
  };

  if (!serviceRoleKey.startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${serviceRoleKey}`;
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: bootstrapUserEmail,
      password: bootstrapUserPassword,
      email_confirm: true,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Error creating user:', data);
    process.exit(1);
  }

  console.log('User created successfully!');
  console.log('User ID:', data.id);
  console.log('Email:', data.email);
}

createUser();
