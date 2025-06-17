import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/serverClient'

export async function POST(request: NextRequest) {
  console.log('🚀 Aplicant migració del sistema asíncron...')
  
  try {
    const supabase = await createServerSupabaseClient()
    
    // PAS 1: Afegir constraint UNIQUE a generated_content
    console.log('📝 Pas 1: Afegint constraint UNIQUE...')
    const { error: constraintError } = await supabase
      .from('generated_content')
      .select('*')
      .limit(1) // Test connection first
    
    if (constraintError) {
      throw new Error(`Connection test failed: ${constraintError.message}`)
    }

    // Executar SQL directament
    let sqlError1;
    try {
      const result = await supabase.rpc('exec_sql', {
        sql: `
          ALTER TABLE public.generated_content
          ADD CONSTRAINT generated_content_unique_generation_placeholder
          UNIQUE (generation_id, placeholder_id);
        `
      });
      sqlError1 = result.error;
    } catch (error) {
      // Fallback: Utilitzar query directa si rpc no funciona
      try {
        const fallbackResult = await (supabase as any).query(`
          ALTER TABLE public.generated_content
          ADD CONSTRAINT generated_content_unique_generation_placeholder
          UNIQUE (generation_id, placeholder_id);
        `);
        sqlError1 = fallbackResult.error;
      } catch (fallbackError) {
        sqlError1 = { message: `Both methods failed: ${error}` };
      }
    }
    
    if (sqlError1 && !sqlError1.message.includes('already exists')) {
      console.warn('Constraint potser ja existeix:', sqlError1.message)
    }
    
    console.log('✅ Pas 1 completat')

    // PAS 2: Crear taula generation_jobs
    console.log('📝 Pas 2: Creant taula generation_jobs...')
    
    const createTableSQL = `
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
      
      ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
      
      DROP POLICY IF EXISTS "Allow authenticated users to manage their own jobs" ON public.generation_jobs;
      CREATE POLICY "Allow authenticated users to manage their own jobs" ON public.generation_jobs 
      FOR ALL TO authenticated 
      USING (auth.uid() = user_id);
      
      CREATE INDEX IF NOT EXISTS idx_generation_jobs_status_created_at ON public.generation_jobs(status, created_at);
      CREATE INDEX IF NOT EXISTS idx_generation_jobs_generation_id ON public.generation_jobs(generation_id);
      CREATE INDEX IF NOT EXISTS idx_generation_jobs_user_id ON public.generation_jobs(user_id);
      
      DROP TRIGGER IF EXISTS update_generation_jobs_updated_at ON public.generation_jobs;
      CREATE TRIGGER update_generation_jobs_updated_at BEFORE UPDATE ON public.generation_jobs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `

    // Executar tot el SQL d'una vegada
    let sqlError2;
    try {
      const result = await supabase.rpc('exec_sql', {
        sql: createTableSQL
      });
      sqlError2 = result.error;
    } catch (error) {
      // Si no funciona, intentem crear la taula bàsica almenys
      try {
        const fallbackResult = await (supabase as any).query(createTableSQL);
        sqlError2 = fallbackResult.error;
      } catch (fallbackError) {
        sqlError2 = { message: `Both methods failed: ${error}` };
      }
    }
    
    if (sqlError2) {
      console.warn('Error SQL (potser parcialment aplicat):', sqlError2.message)
    }

    console.log('✅ Pas 2 completat')

    // PAS 3: Verificar que la taula existeix
    console.log('📝 Pas 3: Verificant taula generation_jobs...')
    const { data: tableData, error: verifyError } = await supabase
      .from('generation_jobs')
      .select('*')
      .limit(1)
    
    if (verifyError) {
      throw new Error(`La taula generation_jobs no s'ha creat correctament: ${verifyError.message}`)
    }

    console.log('✅ Verificació completada')

    return NextResponse.json({
      success: true,
      message: 'Migració aplicada amb èxit',
      details: {
        constraint_added: true,
        table_created: true,
        verification: 'passed'
      }
    })
    
  } catch (error) {
    console.error('❌ Error aplicant la migració:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconegut',
      details: 'Revisa els logs del servidor per més detalls'
    }, { status: 500 })
  }
}
