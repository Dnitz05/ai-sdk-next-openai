/**
 * API Debug: /api/debug/test-migration-system
 * 
 * TESTING DEL SISTEMA DE MIGRACIÓ
 * Prova el sistema de migració amb plantilles específiques
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    console.log(`🧪 [Migration-Test] Iniciant tests del sistema de migració`);

    const body = await request.json();
    const { action = 'analyze' } = body;

    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    if (action === 'analyze') {
      // Test 1: Analitzar totes les plantilles
      console.log(`🔍 [Migration-Test] Analitzant plantilles...`);
      
      const analyzeResponse = await fetch(`${baseUrl}/api/templates/migrate-to-simple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'analyze', adminMode: true })
      });

      const analyzeData = await analyzeResponse.json();
      
      return NextResponse.json({
        success: true,
        test: 'analyze',
        results: analyzeData,
        message: 'Anàlisi completada'
      });

    } else if (action === 'dry_run') {
      // Test 2: Dry run de migració massiva
      console.log(`🏃 [Migration-Test] Dry run de migració massiva...`);
      
      const dryRunResponse = await fetch(`${baseUrl}/api/templates/migrate-to-simple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'all', dryRun: true, adminMode: true })
      });

      const dryRunData = await dryRunResponse.json();
      
      return NextResponse.json({
        success: true,
        test: 'dry_run',
        results: dryRunData,
        message: 'Dry run completat'
      });

    } else if (action === 'migrate_single' && body.templateId) {
      // Test 3: Migrar una plantilla específica
      console.log(`🎯 [Migration-Test] Migrant plantilla ${body.templateId}...`);
      
      const migrateResponse = await fetch(`${baseUrl}/api/templates/migrate-to-simple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mode: 'single', 
          templateId: body.templateId,
          dryRun: body.dryRun || false,
          adminMode: true
        })
      });

      const migrateData = await migrateResponse.json();
      
      return NextResponse.json({
        success: true,
        test: 'migrate_single',
        templateId: body.templateId,
        results: migrateData,
        message: 'Migració individual completada'
      });

    } else if (action === 'migrate_all') {
      // Test 4: Migració massiva REAL
      console.log(`🚀 [Migration-Test] MIGRACIÓ MASSIVA REAL - ATENCIÓ!`);
      
      const migrateAllResponse = await fetch(`${baseUrl}/api/templates/migrate-to-simple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'all', dryRun: false, adminMode: true })
      });

      const migrateAllData = await migrateAllResponse.json();
      
      return NextResponse.json({
        success: true,
        test: 'migrate_all',
        results: migrateAllData,
        message: 'Migració massiva REAL completada'
      });

    } else {
      return NextResponse.json({
        success: false,
        error: 'Acció no vàlida',
        availableActions: [
          'analyze - Analitzar plantilles',
          'dry_run - Simulació de migració',
          'migrate_single - Migrar una plantilla (requereix templateId)',
          'migrate_all - Migració massiva REAL'
        ]
      }, { status: 400 });
    }

  } catch (error) {
    console.error(`❌ [Migration-Test] Error:`, error);
    return NextResponse.json({
      success: false,
      error: 'Error en el test de migració',
      details: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Sistema de testing de migració operatiu',
    endpoints: {
      analyze: 'POST { action: "analyze" }',
      dry_run: 'POST { action: "dry_run" }',
      migrate_single: 'POST { action: "migrate_single", templateId: "xxx" }',
      migrate_all: 'POST { action: "migrate_all" } - ATENCIÓ: REAL!'
    },
    warning: 'migrate_all és una operació REAL que modificarà les plantilles!'
  });
}
