/**
 * API Endpoint: /api/debug/check-project-data
 * 
 * Comprova les dades d'un projecte específic per entendre
 * per què el template_id no és vàlid
 */

import { NextRequest, NextResponse } from 'next/server';
import supabaseServerClient from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId és obligatori' },
        { status: 400 }
      );
    }

    console.log(`🔍 [ProjectDataCheck] Analitzant projecte: ${projectId}`);

    // 1. Obtenir dades del projecte
    const { data: project, error: projectError } = await supabaseServerClient
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({
        success: false,
        error: 'Projecte no trobat',
        details: {
          projectId,
          supabaseError: projectError?.message,
        }
      });
    }

    // 2. Analitzar el template_id del projecte
    const templateId = project.template_id;
    console.log(`📋 Template ID del projecte: ${templateId}`);

    // 3. Comprovar si la plantilla existeix
    let templateExists = false;
    let templateData = null;
    
    if (templateId) {
      const { data: template, error: templateError } = await supabaseServerClient
        .from('plantilla_configs')
        .select('*')
        .eq('id', templateId)
        .single();

      if (!templateError && template) {
        templateExists = true;
        templateData = {
          id: template.id,
          template_name: template.template_name,
          docx_filename: template.docx_filename,
          has_template_content: !!template.template_content,
          has_docx_storage_path: !!template.docx_storage_path,
          template_content_length: template.template_content?.length || 0,
          docx_storage_path: template.docx_storage_path,
          placeholder_docx_storage_path: template.placeholder_docx_storage_path,
          created_at: template.created_at,
          updated_at: template.updated_at
        };
      }
    }

    // 4. Buscar plantilles alternatives si la principal no existeix
    let alternativeTemplates: any[] = [];
    if (!templateExists) {
      const { data: alternatives, error: altError } = await supabaseServerClient
        .from('plantilla_configs')
        .select('id, template_name, docx_filename, created_at')
        .limit(5);

      if (!altError && alternatives) {
        alternativeTemplates = alternatives;
      }
    }

    // 5. Analitzar dades Excel del projecte
    const excelAnalysis = {
      has_excel_data: !!project.excel_data,
      excel_data_type: typeof project.excel_data,
      excel_data_length: Array.isArray(project.excel_data) ? project.excel_data.length : 0,
      excel_filename: project.excel_filename,
      total_rows: project.total_rows
    };

    const analysis = {
      project: {
        id: project.id,
        project_name: project.project_name,
        template_id: project.template_id,
        excel_filename: project.excel_filename,
        total_rows: project.total_rows,
        created_at: project.created_at,
        updated_at: project.updated_at
      },
      template: {
        exists: templateExists,
        data: templateData
      },
      excel: excelAnalysis,
      alternatives: alternativeTemplates,
      recommendations: [] as string[]
    };

    // 6. Generar recomanacions
    if (!templateExists) {
      analysis.recommendations.push(`❌ La plantilla amb ID ${templateId} no existeix a la base de dades`);
      analysis.recommendations.push(`🔧 Necessites actualitzar el template_id del projecte`);
      
      if (alternativeTemplates.length > 0) {
        analysis.recommendations.push(`💡 Plantilles disponibles: ${alternativeTemplates.map(t => `${t.template_name} (${t.id})`).join(', ')}`);
      }
    } else if (templateData) {
      if (!templateData.has_template_content) {
        analysis.recommendations.push(`⚠️ La plantilla no té template_content`);
      }
      if (!templateData.has_docx_storage_path) {
        analysis.recommendations.push(`⚠️ La plantilla no té docx_storage_path`);
      }
      if (templateData.has_template_content && templateData.has_docx_storage_path) {
        analysis.recommendations.push(`✅ La plantilla està correctament configurada per generate-smart`);
      }
    }

    if (!excelAnalysis.has_excel_data) {
      analysis.recommendations.push(`⚠️ El projecte no té dades Excel`);
    } else if (excelAnalysis.excel_data_length === 0) {
      analysis.recommendations.push(`⚠️ Les dades Excel estan buides`);
    } else {
      analysis.recommendations.push(`✅ Dades Excel disponibles: ${excelAnalysis.excel_data_length} files`);
    }

    return NextResponse.json({
      success: true,
      analysis,
      summary: {
        projectFound: true,
        templateValid: templateExists,
        templateReady: templateExists && templateData?.has_template_content && templateData?.has_docx_storage_path,
        excelDataReady: excelAnalysis.has_excel_data && excelAnalysis.excel_data_length > 0,
        canUseGenerateSmart: templateExists && templateData?.has_template_content && templateData?.has_docx_storage_path && excelAnalysis.has_excel_data && excelAnalysis.excel_data_length > 0
      }
    });

  } catch (error) {
    console.error(`❌ [ProjectDataCheck] Error:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error intern del diagnòstic',
        details: error instanceof Error ? error.message : 'Error desconegut'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json(
      { success: false, error: 'projectId és obligatori com a query parameter' },
      { status: 400 }
    );
  }

  return POST(new NextRequest(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId })
  }));
}
