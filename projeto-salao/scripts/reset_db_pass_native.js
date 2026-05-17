const https = require('https');
const { getSupabaseProjectRef, requireEnv } = require('./env');

const PAT = requireEnv('SUPABASE_ACCESS_TOKEN');
const PROJECT_ID = getSupabaseProjectRef();
const NEW_PASSWORD = requireEnv('SUPABASE_DB_NEW_PASSWORD');

function resetPassword() {
  console.log("Tentando resetar a senha do banco via API...");
  
  const options = {
    hostname: 'api.supabase.com',
    port: 443,
    path: `/v1/projects/${PROJECT_ID}/database/password`,
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${PAT}`,
      'Content-Type': 'application/json'
    }
  };

  const req = https.request(options, (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
      try {
        const parsedData = JSON.parse(rawData);
        console.log("Resposta API:", JSON.stringify(parsedData));
      } catch (e) {
        console.log("Resposta Raw:", rawData);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Erro na requisição: ${e.message}`);
  });

  req.write(JSON.stringify({ password: NEW_PASSWORD }));
  req.end();
}

resetPassword();
