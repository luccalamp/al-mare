import { createClient } from '@supabase/supabase-js';

// Usando variáveis de ambiente (conforme Next.js .env.local)
// O prefixo NEXT_PUBLIC_ é necessário para que as variáveis fiquem acessíveis no lado do cliente (browser)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn("Credenciais de conexão ausentes. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
