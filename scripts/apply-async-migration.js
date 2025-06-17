import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Supabase URL i Service Role Key són necessaris')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyMigration() {
  console.log('🚀 Aplicant migració del sistema asíncron...')
  
  try {
    // PAS 1: Afegir constraint UNIQUE a generated_content
    console.log('📝 Pas 1: Afegint constraint UNIQUE...')
    const { error: constraintError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.generated_content
        ADD CONSTRAINT generated_content_unique_generation_placeholder
        UNIQUE (generation_id, placeholder_id);
      `
    })
    
    if (constraintError && !constraintError.message.includes('already exists')) {
      throw constraintError
    }
    console.log('✅ Constraint UNIQUE afegit correctament')

    // PAS 2: Crear taula generation_jobs
    console.log('📝 Pas 2: Creant taula generation_jobs...')
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.generation_jobs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          generation_id UUID NOT NULL REFERENCES public.generations(id) ON DELETE CASCADE,
          user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          progress NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
          total_placeholders INTEGER NOT NULL,
          completed_placeholders INTEGER NOT NULL DEFAULT 0,
          error_message TEXT,
          final_document_path TEXT,
          job_config JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          started_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ
        );
      `
    })
    
    if (tableError) throw tableError
    console.log('✅ Taula generation_jobs creada correctament')

    // PAS 3: Configurar RLS i permisos
    console.log('📝 Pas 3: Configurant RLS i permisos...')
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Allow authenticated users to manage their own jobs" ON public.generation_jobs 
        FOR ALL TO authenticated 
        USING (auth.uid() = user_id);
        
        GRANT ALL ON TABLE public.generation_jobs TO authenticated, service_role;
      `
    })
    
    if (rlsError) throw rlsError
    console.log('✅ RLS i permisos configurats correctament')

    // PAS 4: Crear índexs
    console.log('📝 Pas 4: Creant índexs...')
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_generation_jobs_status_created_at ON public.generation_jobs(status, created_at);
        CREATE INDEX IF NOT EXISTS idx_generation_jobs_generation_id ON public.generation_jobs(generation_id);
        CREATE INDEX IF NOT EXISTS idx_generation_jobs_user_id ON public.generation_jobs(user_id);
      `
    })
    
    if (indexError) throw indexError
    console.log('✅ Índexs creats correctament')

    // PAS 5: Crear trigger
    console.log('📝 Pas 5: Creant trigger...')
    const { error: triggerError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TRIGGER update_generation_jobs_updated_at BEFORE UPDATE ON public.generation_jobs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `
    })
    
    if (triggerError && !triggerError.message.includes('already exists')) {
      throw triggerError
    }
    console.log('✅ Trigger creat correctament')

    console.log('\n🎉 Migració aplicada amb èxit!')
    console.log('📊 Sistema asíncron de generació d\'informes operatiu')
    
  } catch (error) {
    console.error('❌ Error aplicant la migració:', error.message)
    process.exit(1)
  }
}

// Executar si és el fitxer principal
if (import.meta.url === `file://${process.argv[1]}`) {
  applyMigration()
}

export { applyMigration }
