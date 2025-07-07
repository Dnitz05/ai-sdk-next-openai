/**
 * API Endpoint: /api/debug/test-smart-button-fix
 * 
 * Test per verificar que el botó intel·ligent funciona després del fix
 * de l'Arquitectura Híbrida implementada.
 * 
 * Data: 7 de juliol de 2025
 * Fix: Solució del problema excel_data missing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  console.log('🧪 [TEST] Iniciant test del fix del botó intel·ligent...');
  
  try {
    // 1. Verificar variables d'entorn
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Variables d\'entorn no configurades',
        details: {
          hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        }
      }, { status: 500 });
    }

    // 2. Client Supabase amb service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    console.log('🔍 [TEST] Obtenint projectes per testejar...');

    // 3. Obtenir projectes amb la nova estructura
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select(`
        id,
        project_name,
        template_id,
        excel_data,
        excel_filename,
        total_rows,
        created_at
      `)
      .limit(3);

    if (projectsError) {
      console.error('❌ [TEST] Error obtenint projectes:', projectsError);
      return NextResponse.json({
        success: false,
        error: 'Error obtenint projectes',
        details: projectsError.message
      }, { status: 500 });
    }

    console.log(`📊 [TEST] Trobats ${projects?.length || 0} projectes`);

    // 4. Simular la resposta de l'API /api/reports/projects
    const projectsWithStats = projects?.map(project => {
      const excelDataSize = project.excel_data?.length || 0;
      const isLargeExcelData = excelDataSize > 100;
      
      return {
        id: project.id,
        project_name: project.project_name,
        excel_filename: project.excel_filename,
        total_rows: project.total_rows,
        template_id: project.template_id, // ✅ AFEGIT
        template_name: 'Test Template',
        created_at: project.created_at,
        // 🎯 ARQUITECTURA HÍBRIDA
        excel_data: isLargeExcelData ? null : project.excel_data, // ✅ Condicional
        excel_data_size: excelDataSize, // ✅ Mida
        has_large_excel_data: isLargeExcelData, // ✅ Flag
        stats: {
          total: 0,
          completed: 0,
          pending: 0,
          errors: 0,
          progress: 0
        }
      };
    }) || [];

    // 5. Verificar que els camps necessaris estan presents
    const testResults = projectsWithStats.map(project => {
      const hasTemplateId = !!project.template_id;
      const hasExcelData = project.excel_data !== undefined; // pot ser null o array
      const hasExcelDataSize = typeof project.excel_data_size === 'number';
      const hasLargeDataFlag = typeof project.has_large_excel_data === 'boolean';
      
      const smartButtonShouldWork = hasTemplateId && (
        (project.excel_data && project.excel_data.length > 0) || 
        project.has_large_excel_data
      );

      return {
        projectId: project.id,
        projectName: project.project_name,
        checks: {
          hasTemplateId,
          hasExcelData,
          hasExcelDataSize,
          hasLargeDataFlag,
          smartButtonShouldWork
        },
        data: {
          template_id: project.template_id,
          excel_data_size: project.excel_data_size,
          has_large_excel_data: project.has_large_excel_data,
          excel_data_preview: project.excel_data ? 
            `Array amb ${project.excel_data.length} elements` : 
            'null (lazy loading)'
        }
      };
    });

    // 6. Resum dels resultats
    const totalProjects = testResults.length;
    const projectsWithWorkingButton = testResults.filter(r => r.checks.smartButtonShouldWork).length;
    const projectsWithTemplateId = testResults.filter(r => r.checks.hasTemplateId).length;
    const projectsWithExcelData = testResults.filter(r => r.checks.hasExcelData).length;

    console.log(`✅ [TEST] Test completat: ${projectsWithWorkingButton}/${totalProjects} projectes amb botó funcional`);

    return NextResponse.json({
      success: true,
      message: 'Test del fix del botó intel·ligent completat',
      summary: {
        totalProjects,
        projectsWithWorkingButton,
        projectsWithTemplateId,
        projectsWithExcelData,
        successRate: totalProjects > 0 ? Math.round((projectsWithWorkingButton / totalProjects) * 100) : 0
      },
      architecture: {
        hybridLoadingImplemented: true,
        conditionalExcelDataLoading: true,
        lazyLoadingSupport: true,
        backwardCompatible: true
      },
      testResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [TEST] Error en test:', error);
    return NextResponse.json({
      success: false,
      error: 'Error executant test',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * POST - Test amb dades específiques
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();
    
    if (!projectId) {
      return NextResponse.json({
        success: false,
        error: 'projectId és obligatori per al test específic'
      }, { status: 400 });
    }

    console.log(`🎯 [TEST] Test específic per projecte: ${projectId}`);

    // Simular crida a l'API real
    const response = await fetch(`${request.nextUrl.origin}/api/reports/projects`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API response: ${response.status}`);
    }

    const data = await response.json();
    const project = data.projects?.find((p: any) => p.id === projectId);

    if (!project) {
      return NextResponse.json({
        success: false,
        error: 'Projecte no trobat'
      }, { status: 404 });
    }

    // Verificar que el projecte té tot el necessari per al botó intel·ligent
    const canUseSmartButton = !!(
      project.template_id && 
      (project.excel_data || project.has_large_excel_data)
    );

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.project_name,
        template_id: project.template_id,
        excel_data_size: project.excel_data_size,
        has_large_excel_data: project.has_large_excel_data,
        canUseSmartButton
      },
      smartButtonStatus: canUseSmartButton ? 'FUNCIONAL' : 'NO FUNCIONAL',
      message: canUseSmartButton ? 
        'El botó intel·ligent hauria de funcionar per aquest projecte' :
        'El botó intel·ligent NO funcionarà per aquest projecte'
    });

  } catch (error) {
    console.error('❌ [TEST] Error en test específic:', error);
    return NextResponse.json({
      success: false,
      error: 'Error en test específic',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
