import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId requerit' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });

    // Verificar autenticació
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'No autenticat' }, { status: 401 });
    }

    // Obtenir dades del projecte
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        *,
        plantilla_configs (
          id,
          name,
          docx_filename
        )
      `)
      .eq('id', projectId)
      .eq('user_id', session.user.id)
      .single();

    if (projectError) {
      return NextResponse.json({ 
        error: 'Error obtenint projecte', 
        details: projectError 
      }, { status: 500 });
    }

    if (!project) {
      return NextResponse.json({ error: 'Projecte no trobat' }, { status: 404 });
    }

    // Analitzar les dades Excel
    const excelDataAnalysis = {
      exists: !!project.excel_data,
      isArray: Array.isArray(project.excel_data),
      length: project.excel_data ? project.excel_data.length : 0,
      type: typeof project.excel_data,
      sample: project.excel_data ? project.excel_data.slice(0, 2) : null
    };

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        project_name: project.project_name,
        excel_filename: project.excel_filename,
        total_rows: project.total_rows,
        template_id: project.template_id,
        template_name: project.plantilla_configs?.name,
        template_docx_name: project.plantilla_configs?.docx_filename
      },
      excelDataAnalysis,
      buttonConditions: {
        hasExcelData: !!project.excel_data,
        isExcelDataArray: Array.isArray(project.excel_data),
        hasExcelDataLength: project.excel_data && project.excel_data.length > 0,
        shouldBeEnabled: !!(
          project.excel_data && 
          Array.isArray(project.excel_data) && 
          project.excel_data.length > 0
        )
      }
    });

  } catch (error) {
    console.error('Error en debug check-project-data:', error);
    return NextResponse.json({ 
      error: 'Error intern del servidor',
      details: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 });
  }
}
