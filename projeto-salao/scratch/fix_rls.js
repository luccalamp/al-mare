const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ccrorpxyvxzzsoafwbsj.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjcm9ycHh5dnh6enNvYWZ3YnNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM3NjMwNSwiZXhwIjoyMDkxOTUyMzA1fQ.CDjZ8AhbAZuVGmszeL5Dh0IZxfAfveQS3EnVgjfkwU0';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fixRLS() {
  console.log("Iniciando correção de RLS...");
  
  const tables = ['clients', 'hair_diagnostics', 'technical_sheets', 'appointments', 'services'];
  
  for (const table of tables) {
    console.log(`Atualizando políticas para a tabela: ${table}`);
    
    // Tentando resetar a política para permitir anon
    const { error } = await supabase.rpc('exec_sql', { 
      sql_query: `
        ALTER POLICY "allow_authenticated_all" ON ${table} TO anon, authenticated;
      ` 
    });

    if (error) {
       // Se o rpc falhar (provavelmente não existe a função exec_sql), tentamos criar uma função temporária ou apenas informar.
       // Mas espere, o Supabase não tem um 'rpc' para rodar SQL arbitrário por padrão sem criar a função antes.
       console.error(`Erro ao atualizar ${table}:`, error.message);
    } else {
       console.log(`Sucesso em ${table}`);
    }
  }
}

fixRLS();
