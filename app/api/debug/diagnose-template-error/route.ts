/**
 * API Endpoint: /api/debug/diagnose-template-error
 * 
 * Diagnostica per què l'API generate-smart dona error "Plantilla no trobada"
 * Analitza l'estat de la plantilla i identifica camps faltants
 */

import { NextRequest, NextResponse } from 'next/server';
import supabaseServerClient from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId } = body;

    if (!templateId) {
      return NextResponse.json(
        { success: false, error: 'templateId és obligatori' },
        { status: 400 }
      );
    }

    console.log(`🔍 [TemplateDiagnostic] Analitzant plantilla: ${templateId}`);

    // 1. Obtenir TOTA la informació de la plantilla
    const { data: template, error: templateError } = await supabaseServerClient
      .from('plantilla_configs')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      return NextResponse.json({
        success: false,
        error: 'Plantilla no trobada a la base de dades',
        details: {
          templateId,
          supabaseError: templateError?.message,
          found: false
        }
      });
    }

    // 2. Analitzar tots els camps de la plantilla
    const analysis = {
      templateId: template.id,
      templateName: template.template_name,
      found: true,
      fields: {
        // Camps que busca generate-smart
        template_content: {
          exists: !!template.template_content,
          type: typeof template.template_content,
          length: template.template_content?.length || 0,
          preview: template.template_content?.substring(0, 100) || null
        },
        docx_storage_path: {
          exists: !!template.docx_storage_path,
          type: typeof template.docx_storage_path,
          value: template.docx_storage_path || null
        },
        // Altres camps rellevants
        docx_filename: {
          exists: !!template.docx_filename,
          value: template.docx_filename || null
        },
        placeholder_docx_storage_path: {
          exists: !!template.placeholder_docx_storage_path,
          value: template.placeholder_docx_storage_path || null
        },
        created_at: template.created_at,
        updated_at: template.updated_at
      },
      // Diagnòstic específic per generate-smart
      generateSmartCompatibility: {
        hasRequiredFields: !!(template.template_content && template.docx_storage_path),
        missingFields: [] as string[],
        recommendations: [] as string[]
      }
    };

    // 3. Identificar camps faltants
    if (!template.template_content) {
      analysis.generateSmartCompatibility.missingFields.push('template_content');
      analysis.generateSmartCompatibility.recommendations.push(
        'El camp template_content està buit. Necessita el contingut JSON de la plantilla.'
      );
    }

    if (!template.docx_storage_path) {
      analysis.generateSmartCompatibility.missingFields.push('docx_storage_path');
      analysis.generateSmartCompatibility.recommendations.push(
        'El camp docx_storage_path està buit. Necessita la ruta del fitxer DOCX a Supabase Storage.'
      );
    }

    // 4. Suggerir solucions alternatives
    if (!analysis.generateSmartCompatibility.hasRequiredFields) {
      if (template.placeholder_docx_storage_path) {
        analysis.generateSmartCompatibility.recommendations.push(
          `SOLUCIÓ ALTERNATIVA: Usar placeholder_docx_storage_path (${template.placeholder_docx_storage_path}) com a docx_storage_path`
        );
      }
      
      if (template.docx_filename) {
        analysis.generateSmartCompatibility.recommendations.push(
          `PISTA: La plantilla té docx_filename (${template.docx_filename}), potser el fitxer existeix però la ruta no està guardada`
        );
      }
    }

    console.log(`✅ [TemplateDiagnostic] Anàlisi completada:`, {
      templateId,
      hasRequiredFields: analysis.generateSmartCompatibility.hasRequiredFields,
      missingFields: analysis.generateSmartCompatibility.missingFields
    });

    return NextResponse.json({
      success: true,
      analysis,
      summary: {
        templateFound: true,
        generateSmartReady: analysis.generateSmartCompatibility.hasRequiredFields,
        missingFieldsCount: analysis.generateSmartCompatibility.missingFields.length,
        canBeFixed: analysis.generateSmartCompatibility.recommendations.length > 0
      }
    });

  } catch (error) {
    console.error(`❌ [TemplateDiagnostic] Error:`, error);
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
  const templateId = searchParams.get('templateId');

  if (!templateId) {
    return NextResponse.json(
      { success: false, error: 'templateId és obligatori com a query parameter' },
      { status: 400 }
    );
  }

  // Redirigir al POST amb el templateId
  return POST(new NextRequest(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId })
  }));
}
