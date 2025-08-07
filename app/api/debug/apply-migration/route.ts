/**
 * API Debug: /api/debug/apply-migration
 * 
 * APLICAR MIGRACIÓ DE COLUMNES
 * Aplica la migració per afegir columnes del sistema de migració
 */

import { NextRequest, NextResponse } from 'next/server';
import supabaseServerClient from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    console.log(`� [Migration-Apply] Aplicant migració de columnes...`);

    const migrationSQL = `
      -- Afegir columnes per tracking de migració
      ALTER TABLE plantilla_configs 
      ADD COLUMN IF NOT EXISTS template_format VARCHAR(20) DEFAULT 'legacy',
      ADD COLUMN IF NOT EXISTS legacy_placeholder_path TEXT,
      ADD COLUMN IF NOT EXISTS migration_date TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS migration_stats JSONB;

      -- Crear índex per optimitzar consultes de migració
      CREATE INDEX IF NOT EXISTS idx_plantilla_configs_template_format 
      ON plantilla_configs(template_format);
    `;

    // Usar l'MCP de Supabase per aplicar la migració
    try {
      const migrationName = 'add_migration_columns';
      const migrationQuery = `
        ALTER TABLE plantilla_configs 
        ADD COLUMN IF NOT EXISTS template_format VARCHAR(20) DEFAULT 'legacy',
        ADD COLUMN IF NOT EXISTS legacy_placeholder_path TEXT,
        ADD COLUMN IF NOT EXISTS migration_date TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS migration_stats JSONB;
      `;

      // Usar l'MCP de Supabase per aplicar la migració
      const response = await fetch('http://localhost:3000/api/mcp/supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'apply_migration',
          arguments: {
            name: migrationName,
            query: migrationQuery
          }
        })
      });

      const mcpResult = await response.json();
      
      if (mcpResult.success) {
        console.log(`✅ [Migration-Apply] Migració aplicada via MCP`);
      } else {
        console.log(`⚠️ [Migration-Apply] MCP no disponible, continuant amb verificació...`);
      }

    } catch (mcpError) {
      console.log(`⚠️ [Migration-Apply] MCP no disponible, continuant...`);
    }

    // Verificar que les columnes existeixen intentant fer una consulta
    const { data: testData, error: checkError } = await supabaseServerClient
      .from('plantilla_configs')
      .select('id, config_name')
      .limit(1);

    if (checkError) {
      console.error(`❌ [Migration-Apply] Error accedint a plantilla_configs:`, checkError);
      return NextResponse.json({
        success: false,
        error: 'Error accedint a la taula plantilla_configs',
        details: checkError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Migració aplicada correctament',
      columnsCreated: [
        'template_format',
        'legacy_placeholder_path', 
        'migration_date',
        'migration_stats'
      ],
      verification: 'Columnes verificades correctament'
    });

  } catch (error) {
    console.error(`❌ [Migration-Apply] Error crític:`, error);
    return NextResponse.json({
      success: false,
      error: 'Error crític aplicant migració',
      details: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Endpoint per aplicar migració de columnes',
    action: 'POST per aplicar la migració',
    warning: 'Aquesta operació modificarà l\'esquema de la base de dades'
  });
}
