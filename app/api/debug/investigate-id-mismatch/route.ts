/**
 * API Endpoint: /api/debug/investigate-id-mismatch
 * 
 * Investiga si l'ID que s'està passant és d'un projecte en lloc d'una plantilla
 * i troba la plantilla correcta associada al projecte
 */

import { NextRequest, NextResponse } from 'next/server';
import supabaseServerClient from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { suspiciousId } = body;

    if (!suspiciousId) {
      return NextResponse.json(
        { success: false, error: 'suspiciousId és obligatori' },
        { status: 400 }
      );
    }

    console.log(`🔍 [IDInvestigation] Investigant ID: ${suspiciousId}`);

    const investigation = {
      suspiciousId,
      findings: {
        isProject: false,
        isTemplate: false,
        projectData: null as any,
        templateData: null as any,
        correctTemplateId: null as string | null
      }
    };

    // 1. Comprovar si és un projecte
    const { data: projectData, error: projectError } = await supabaseServerClient
      .from('projects')
      .select('*')
      .eq('id', suspiciousId)
      .single();

    if (!projectError && projectData) {
      investigation.findings.isProject = true;
      investigation.findings.projectData = {
        id: projectData.id,
        project_name: projectData.project_name,
        template_id: projectData.template_id,
        excel_filename: projectData.excel_filename,
        created_at: projectData.created_at
      };
      investigation.findings.correctTemplateId = projectData.template_id;
      
      console.log(`✅ [IDInvestigation] És un projecte! Template ID correcte: ${projectData.template_id}`);
    }

    // 2. Comprovar si és una plantilla
    const { data: templateData, error: templateError } = await supabaseServerClient
      .from('plantilla_configs')
      .select('*')
      .eq('id', suspiciousId);

    if (!templateError && templateData && templateData.length > 0) {
      investigation.findings.isTemplate = true;
      investigation.findings.templateData = templateData.map(t => ({
        id: t.id,
        template_name: t.template_name,
        docx_filename: t.docx_filename,
        has_template_content: !!t.template_content,
        has_docx_storage_path: !!t.docx_storage_path,
        created_at: t.created_at
      }));
      
      console.log(`✅ [IDInvestigation] També trobat com a plantilla(es): ${templateData.length} resultats`);
    }

    // 3. Si és un projecte, obtenir informació de la plantilla correcta
    if (investigation.findings.isProject && investigation.findings.correctTemplateId) {
      const { data: correctTemplate, error: correctTemplateError } = await supabaseServerClient
        .from('plantilla_configs')
        .select('*')
        .eq('id', investigation.findings.correctTemplateId)
        .single();

      if (!correctTemplateError && correctTemplate) {
        investigation.findings.templateData = [{
          id: correctTemplate.id,
          template_name: correctTemplate.template_name,
          docx_filename: correctTemplate.docx_filename,
          has_template_content: !!correctTemplate.template_content,
          has_docx_storage_path: !!correctTemplate.docx_storage_path,
          template_content_length: correctTemplate.template_content?.length || 0,
          docx_storage_path: correctTemplate.docx_storage_path,
          placeholder_docx_storage_path: correctTemplate.placeholder_docx_storage_path,
          created_at: correctTemplate.created_at
        }];
        
        console.log(`✅ [IDInvestigation] Plantilla correcta trobada:`, {
          templateId: correctTemplate.id,
          templateName: correctTemplate.template_name,
          hasRequiredFields: !!(correctTemplate.template_content && correctTemplate.docx_storage_path)
        });
      }
    }

    // 4. Generar recomanacions
    const recommendations = [];
    
    if (investigation.findings.isProject) {
      recommendations.push(`L'ID ${suspiciousId} és un PROJECT ID, no un TEMPLATE ID`);
      recommendations.push(`El template ID correcte és: ${investigation.findings.correctTemplateId}`);
      recommendations.push(`Canviar la crida a l'API per usar templateId: "${investigation.findings.correctTemplateId}"`);
    }
    
    if (investigation.findings.isTemplate && investigation.findings.templateData) {
      const template = investigation.findings.templateData[0];
      if (!template.has_template_content) {
        recommendations.push(`La plantilla no té template_content - necessita ser populat`);
      }
      if (!template.has_docx_storage_path) {
        recommendations.push(`La plantilla no té docx_storage_path - necessita ser populat`);
      }
    }

    return NextResponse.json({
      success: true,
      investigation,
      recommendations,
      summary: {
        problemIdentified: investigation.findings.isProject,
        correctTemplateId: investigation.findings.correctTemplateId,
        templateReady: investigation.findings.templateData?.[0]?.has_template_content && 
                      investigation.findings.templateData?.[0]?.has_docx_storage_path,
        actionRequired: recommendations.length > 0
      }
    });

  } catch (error) {
    console.error(`❌ [IDInvestigation] Error:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error intern de la investigació',
        details: error instanceof Error ? error.message : 'Error desconegut'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const suspiciousId = searchParams.get('id');

  if (!suspiciousId) {
    return NextResponse.json(
      { success: false, error: 'id és obligatori com a query parameter' },
      { status: 400 }
    );
  }

  return POST(new NextRequest(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suspiciousId })
  }));
}
