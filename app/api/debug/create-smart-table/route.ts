/**
 * API Endpoint: /api/debug/create-smart-table
 * 
 * Crea la taula smart_generations utilitzant el client de Supabase directament.
 * Utilitza la Service Role Key per tenir permisos d'escriptura.
 * 
 * Data: 6 de juliol de 2025
 * Arquitecte: Cline
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log(`🔧 [CreateSmartTable] Iniciant creació de taula smart_generations...`);

    // Utilitzar la Service Role Key per tenir permisos d'escriptura
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        success: false,
        error: 'Variables d\'entorn de Supabase no configurades',
        details: 'NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no trobades',
        totalTimeMs: Date.now() - startTime,
      }, { status: 500 });
    }

    // Crear client amb Service Role Key
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log(`🔍 [CreateSmartTable] Verificant si la taula ja existeix...`);

    // 1. Verificar si la taula ja existeix
    const { data: existingData, error: checkError } = await supabase
      .from('smart_generations')
      .select('count')
      .limit(1);

    if (!checkError) {
      console.log(`⚠️ [CreateSmartTable] La taula smart_generations ja existeix`);
      return NextResponse.json({
        success: true,
        message: 'La taula smart_generations ja existeix',
        alreadyExists: true,
        totalTimeMs: Date.now() - startTime,
      });
    }

    console.log(`📝 [CreateSmartTable] Creant taula smart_generations...`);

    // 2. Crear la taula principal
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS smart_generations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          template_id UUID REFERENCES plantilla_configs(id) ON DELETE SET NULL,
          template_content TEXT NOT NULL,
          excel_data JSONB NOT NULL,
          generated_documents JSONB,
          processing_time INTEGER,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
          error_message TEXT,
          num_documents INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          completed_at TIMESTAMP WITH TIME ZONE
      );
    `;

    const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL });

    if (createError) {
      console.error(`❌ [CreateSmartTable] Error creant taula:`, createError);
      
      // Si exec_sql no existeix, intentem amb una consulta SQL directa
      const { error: directError } = await supabase
        .from('_realtime_schema')
        .select('*')
        .limit(0);

      if (directError) {
        return NextResponse.json({
          success: false,
          error: 'No es pot executar SQL directament',
          details: 'La base de dades no permet execució de SQL arbitrari',
          recommendation: 'Aplica la migració manualment des del Dashboard de Supabase',
          sqlToExecute: createTableSQL,
          totalTimeMs: Date.now() - startTime,
        }, { status: 500 });
      }
    }

    console.log(`📊 [CreateSmartTable] Creant índexs...`);

    // 3. Crear índexs
    const createIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_smart_generations_user_id ON smart_generations(user_id);
      CREATE INDEX IF NOT EXISTS idx_smart_generations_status ON smart_generations(status);
      CREATE INDEX IF NOT EXISTS idx_smart_generations_created_at ON smart_generations(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_smart_generations_template_id ON smart_generations(template_id) WHERE template_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_smart_generations_user_status_created ON smart_generations(user_id, status, created_at DESC);
    `;

    const { error: indexError } = await supabase.rpc('exec_sql', { sql: createIndexesSQL });

    console.log(`🔒 [CreateSmartTable] Habilitant RLS...`);

    // 4. Habilitar RLS
    const enableRLSSQL = `
      ALTER TABLE smart_generations ENABLE ROW LEVEL SECURITY;
    `;

    const { error: rlsError } = await supabase.rpc('exec_sql', { sql: enableRLSSQL });

    console.log(`🛡️ [CreateSmartTable] Creant polítiques RLS...`);

    // 5. Crear polítiques RLS
    const createPoliciesSQL = `
      CREATE POLICY "Users can view own smart generations" ON smart_generations FOR SELECT USING (auth.uid() = user_id);
      CREATE POLICY "Users can create smart generations" ON smart_generations FOR INSERT WITH CHECK (auth.uid() = user_id);
      CREATE POLICY "Users can update own smart generations" ON smart_generations FOR UPDATE USING (auth.uid() = user_id);
      CREATE POLICY "Users can delete own smart generations" ON smart_generations FOR DELETE USING (auth.uid() = user_id);
    `;

    const { error: policiesError } = await supabase.rpc('exec_sql', { sql: createPoliciesSQL });

    // 6. Verificar que la taula s'ha creat correctament
    console.log(`✅ [CreateSmartTable] Verificant creació...`);
    
    const { data: verificationData, error: verificationError } = await supabase
      .from('smart_generations')
      .select('count')
      .limit(1);

    const totalTime = Date.now() - startTime;

    if (verificationError) {
      console.error(`❌ [CreateSmartTable] Error de verificació:`, verificationError);
      return NextResponse.json({
        success: false,
        error: 'Taula creada però verificació fallida',
        details: verificationError.message,
        recommendation: 'Comprova manualment que la taula smart_generations existeix',
        totalTimeMs: totalTime,
      }, { status: 500 });
    }

    console.log(`🎉 [CreateSmartTable] Taula creada amb èxit en ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      message: 'Taula smart_generations creada amb èxit',
      tableCreated: true,
      indexesCreated: !indexError,
      rlsEnabled: !rlsError,
      policiesCreated: !policiesError,
      method: 'Supabase Client with Service Role',
      totalTimeMs: totalTime,
      nextSteps: [
        'El sistema intel·ligent està ara operatiu',
        'Pots testejar amb: GET /api/debug/test-smart-system',
        'Endpoint principal: POST /api/reports/generate-smart'
      ],
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [CreateSmartTable] Error crític:`, error);
    
    return NextResponse.json({
      success: false,
      error: 'Error crític creant taula smart_generations',
      details: error instanceof Error ? error.message : 'Error desconegut',
      recommendation: 'Aplica la migració manualment seguint NETWORK_ERROR_RESOLUTION_PLAN.md',
      totalTimeMs: totalTime,
    }, { status: 500 });
  }
}

// GET per verificar estat de la taula
export async function GET(request: NextRequest) {
  try {
    console.log(`🔍 [CreateSmartTable] Verificant estat de taula...`);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        success: false,
        tableExists: false,
        error: 'Variables d\'entorn de Supabase no configurades',
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Comprovar si la taula existeix
    const { data, error } = await supabase
      .from('smart_generations')
      .select('count')
      .limit(1);

    if (error) {
      return NextResponse.json({
        success: false,
        tableExists: false,
        error: 'Taula smart_generations no existeix',
        recommendation: 'Executa POST /api/debug/create-smart-table per crear la taula',
      });
    }

    return NextResponse.json({
      success: true,
      tableExists: true,
      tableAccessible: true,
      message: 'Sistema intel·ligent completament operatiu',
      endpoints: {
        generate: 'POST /api/reports/generate-smart',
        status: 'GET /api/reports/generate-smart?generationId=uuid',
        download: 'GET /api/reports/download-smart/[generationId]/[documentIndex]',
        test: 'GET /api/debug/test-smart-system'
      },
    });

  } catch (error) {
    console.error(`❌ [CreateSmartTable] Error verificant taula:`, error);
    return NextResponse.json({
      success: false,
      error: 'Error verificant estat de taula',
      details: error instanceof Error ? error.message : 'Error desconegut',
    }, { status: 500 });
  }
}
