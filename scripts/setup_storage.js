const { createClient } = require('@supabase/supabase-js');
const { requireEnv } = require('./env');

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

function createSecretKeySafeFetch(apiKey) {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    const authorizationHeader = headers.get('Authorization');

    if (authorizationHeader === `Bearer ${apiKey}` || authorizationHeader === '') {
      headers.delete('Authorization');
    }

    if (!headers.has('apikey')) {
      headers.set('apikey', apiKey);
    }

    return fetch(input, { ...init, headers });
  };
}

const supabase = createClient(supabaseUrl, serviceRoleKey, serviceRoleKey.startsWith('sb_secret_')
  ? {
      global: {
        fetch: createSecretKeySafeFetch(serviceRoleKey),
        headers: {
          Authorization: '',
        },
      },
    }
  : undefined);

async function setup() {
  console.log("--- Iniciando Configuração de Armazenamento Profissional ---");

  // 1. Criar o Bucket no Storage
  console.log("Configurando Bucket 'anamnese-fotos'...");
  const { data: bucket, error: bucketError } = await supabase.storage.createBucket('anamnese-fotos', {
    public: false,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp']
  });

  if (bucketError) {
    if (bucketError.message.includes('already exists')) {
      console.log("Bucket já existe. Pulando.");
    } else {
      console.error("Erro ao criar bucket:", bucketError.message);
    }
  } else {
    console.log("Bucket criado com sucesso!");
  }

  console.log("--- Setup Concluído ---");
}

setup();
