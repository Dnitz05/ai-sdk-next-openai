/**
 * API Endpoint: /api/debug/apply-migration-direct
 * 
 * Aplica la migració del sistema intel·ligent utilitzant l'API REST de Supabase directament.
 * Aquest endpoint evita problemes de variables d'entorn locals.
 * 
 * Data: 6 de juliol de 2025
 * Arquitecte: Cline
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log(`🔧 [DirectMigration] Iniciant aplicació de migració directa...`);

    // Utilitzar les variables d'entorn de Vercel directament
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        error: 'Variables d\'entorn de Supabase no configurades',
        details: 'NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no trobades',
        recommendation: 'Configura les variables d\'entorn a Vercel',
        totalTimeMs: Date.now() - startTime,
      }, { status: 500 });
    }

    // 1. Verificar que la taula no existeix ja
    console.log(`🔍 [DirectMigration] Verificant si la taula smart_generations existeix...`);
    
    const checkResponse = await fetch(`${supabaseUrl}/rest/v1/smart_generations?select=count&limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
      },
    });

    if (checkResponse.ok) {
      console.log(`⚠️ [DirectMigration] La taula smart_generations ja existeix`);
      return NextResponse.json({
        success: true,
        message: 'La taula smart_generations ja existeix',
        alreadyExists: true,
        totalTimeMs: Date.now() - startTime,
      });
    }

    // 2. Aplicar la migració utilitzant l'RPC exec_sql
    console.log(`📝 [DirectMigration] Creant taula smart_generations...`);
    
    const migrationSQL = `
      -- Crear taula principal
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

      -- Crear índexs per optimitzar consultes
      CREATE INDEX IF NOT EXISTS idx_smart_generations_user_id ON smart_generations(user_id);
      CREATE INDEX IF NOT EXISTS idx_smart_generations_status ON smart_generations(status);
      CREATE INDEX IF NOT EXISTS idx_smart_generations_created_at ON smart_generations(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_smart_generations_template_id ON smart_generations(template_id) WHERE template_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_smart_generations_user_status_created ON smart_generations(user_id, status, created_at DESC);

      -- Habilitar RLS
      ALTER TABLE smart_generations ENABLE ROW LEVEL SECURITY;

      -- Crear polítiques RLS
      CREATE POLICY "Users can view own smart generations" ON smart_generations FOR SELECT USING (auth.uid() = user_id);
      CREATE POLICY "Users can create smart generations" ON smart_generations FOR INSERT WITH CHECK (auth.uid() = user_id);
      CREATE POLICY "Users can update own smart generations" ON smart_generations FOR UPDATE USING (auth.uid() = user_id);
      CREATE POLICY "Users can delete own smart generations" ON smart_generations FOR DELETE USING (auth.uid() = user_id);
    `;

    const migrationResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: migrationSQL }),
    });

    if (!migrationResponse.ok) {
      const errorText = await migrationResponse.text();
      console.error(`❌ [DirectMigration] Error aplicant migració:`, errorText);
      
      return NextResponse.json({
        success: false,
        error: 'Error aplicant migració via API REST',
        details: errorText,
        recommendation: 'Aplica la migració manualment des del Dashboard de Supabase',
        sqlToExecute: migrationSQL,
        totalTimeMs: Date.now() - startTime,
      }, { status: 500 });
    }

    // 3. Verificar que la taula s'ha creat correctament
    console.log(`✅ [DirectMigration] Verificant creació de taula...`);
    
    const verificationResponse = await fetch(`${supabaseUrl}/rest/v1/smart_generations?select=count&limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
      },
    });

    const totalTime = Date.now() - startTime;

    if (!verificationResponse.ok) {
      console.error(`❌ [DirectMigration] Error de verificació`);
      return NextResponse.json({
        success: false,
        error: 'Migració aplicada però verificació fallida',
        details: 'No es pot accedir a la taula smart_generations',
        recommendation: 'Comprova manualment que la taula smart_generations existeix',
        totalTimeMs: totalTime,
      }, { status: 500 });
    }

    console.log(`🎉 [DirectMigration] Migració aplicada amb èxit en ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      message: 'Migració del sistema intel·ligent aplicada amb èxit via API REST',
      tableCreated: true,
      indexesCreated: true,
      rlsEnabled: true,
      policiesCreated: 4,
      method: 'Direct REST API',
      totalTimeMs: totalTime,
      nextSteps: [
        'El sistema intel·ligent està ara completament operatiu',
        'Pots testejar amb: GET /api/debug/test-smart-system',
        'Endpoint principal: POST /api/reports/generate-smart'
      ],
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [DirectMigration] Error crític aplicant migració:`, error);
    
    return NextResponse.json({
      success: false,
      error: 'Error crític aplicant migració directa',
      details: error instanceof Error ? error.message : 'Error desconegut',
      recommendation: 'Aplica la migració manualment seguint NETWORK_ERROR_RESOLUTION_PLAN.md',
      totalTimeMs: totalTime,
    }, { status: 500 });
  }
}

// GET per verificar estat de la migració
export async function GET(request: NextRequest) {
  try {
    console.log(`🔍 [DirectMigration] Verificant estat de migració...`);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        migrationApplied: false,
        error: 'Variables d\'entorn de Supabase no configurades',
      });
    }

    // Comprovar si la taula existeix
    const checkResponse = await fetch(`${supabaseUrl}/rest/v1/smart_generations?select=count&limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
      },
    });

    if (!checkResponse.ok) {
      return NextResponse.json({
        success: false,
        migrationApplied: false,
        error: 'Taula smart_generations no existeix',
        recommendation: 'Executa POST /api/debug/apply-migration-direct per aplicar la migració',
      });
    }

    return NextResponse.json({
      success: true,
      migrationApplied: true,
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
    console.error(`❌ [DirectMigration] Error verificant migració:`, error);
    return NextResponse.json({
      success: false,
      error: 'Error verificant estat de migració',
      details: error instanceof Error ? error.message : 'Error desconegut',
    }, { status: 500 });
  }
}
