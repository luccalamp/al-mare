const fetch = require('node-fetch');
const { getSupabaseProjectRef, requireEnv } = require('./env');

const PAT = requireEnv('SUPABASE_ACCESS_TOKEN');
const PROJECT_ID = getSupabaseProjectRef();
const NEW_PASSWORD = requireEnv('SUPABASE_DB_NEW_PASSWORD');

async function resetPassword() {
  console.log("Tentando resetar a senha do banco via API...");
  
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/password`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${PAT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        password: NEW_PASSWORD
    })
  });

  const data = await response.json();
  console.log("Resposta API:", JSON.stringify(data));
  return response.ok;
}

resetPassword();
