import { NextRequest, NextResponse } from 'next/server';
import supabaseServerClient from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseServerClient;
    
    // Verificar autenticació
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
    }

    console.log('🔍 Testejant integració del sistema intel·ligent...');

    // 1. Buscar un projecte existent amb dades Excel
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select(`
        id,
        project_name,
        template_id,
        excel_data,
        total_rows,
        plantilla_configs!inner(
          id,
          config_name,
          base_docx_storage_path,
          placeholder_docx_storage_path,
          ai_instructions
        )
      `)
      .eq('user_id', user.id)
      .not('excel_data', 'is', null)
      .limit(1);

    if (projectsError) {
      throw new Error(`Error carregant projectes: ${projectsError.message}`);
    }

    if (!projects || projects.length === 0) {
      return NextResponse.json({
        error: 'No s\'han trobat projectes amb dades Excel per testejar',
        suggestion: 'Crea un projecte amb Excel primer'
      }, { status: 404 });
    }

    const project = projects[0];
    const template = project.plantilla_configs[0]; // Agafar el primer element de l'array

    console.log(`📊 Projecte trobat: ${project.project_name}`);
    console.log(`📄 Plantilla: ${template.config_name}`);
    console.log(`📈 Files Excel: ${project.total_rows}`);

    // 2. Verificar que el sistema intel·ligent està disponible
    const smartSystemCheck = await fetch(`${request.nextUrl.origin}/api/reports/generate-smart`, {
      method: 'POST',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        templateId: project.template_id,
        excelData: project.excel_data.slice(0, 1), // Només 1 fila per test
        userId: user.id,
        testMode: true // Flag per indicar que és un test
      })
    });

    const smartSystemAvailable = smartSystemCheck.status !== 404;

    // 3. Verificar estructura de dades
    const excelDataValid = Array.isArray(project.excel_data) && project.excel_data.length > 0;
    const templateValid = template.base_docx_storage_path && template.ai_instructions;

    // 4. Verificar taula smart_generations
    const { data: smartTable, error: smartTableError } = await supabase
      .from('smart_generations')
      .select('id')
      .limit(1);

    const smartTableExists = !smartTableError;

    const results = {
      projectFound: true,
      projectDetails: {
        id: project.id,
        name: project.project_name,
        templateName: template.config_name,
        excelRows: project.total_rows,
        hasExcelData: excelDataValid,
        excelDataSample: project.excel_data?.slice(0, 2) || []
      },
      systemChecks: {
        smartSystemAvailable,
        templateValid,
        excelDataValid,
        smartTableExists,
        hasBaseDocx: !!template.base_docx_storage_path,
        hasAiInstructions: !!template.ai_instructions,
        aiInstructionsCount: template.ai_instructions?.length || 0
      },
      readyForTesting: smartSystemAvailable && templateValid && excelDataValid && smartTableExists,
      testUrl: `${request.nextUrl.origin}/informes/${project.id}`,
      recommendations: [] as string[]
    };

    // Generar recomanacions
    if (!smartSystemAvailable) {
      results.recommendations.push('❌ Sistema intel·ligent no disponible - verificar /api/reports/generate-smart');
    }
    if (!templateValid) {
      results.recommendations.push('❌ Plantilla incompleta - verificar base_docx_storage_path i ai_instructions');
    }
    if (!excelDataValid) {
      results.recommendations.push('❌ Dades Excel no vàlides - verificar excel_data al projecte');
    }
    if (!smartTableExists) {
      results.recommendations.push('❌ Taula smart_generations no existeix - executar migració');
    }

    if (results.readyForTesting) {
      results.recommendations.push('✅ Tot llest per testejar! Ves a la URL del test i prova el botó morat');
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error('Error en test d\'integració:', error);
    return NextResponse.json({
      error: 'Error en test d\'integració',
      details: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 });
  }
}
