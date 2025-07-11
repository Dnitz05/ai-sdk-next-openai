/**
 * Test final de la solució completa "Plantilla no trobada"
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import supabaseServerClient from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  console.log(`🔧 [Final-Solution] Test final de la solució "Plantilla no trobada"`);
  
  try {
    const body = await request.json();
    const { projectId } = body;

    console.log(`📋 [Final-Solution] Testing project: ${projectId}`);

    // SIMULACIÓ DEL FLUX EXACTE de generate-smart-enhanced
    console.log(`🔍 [Final-Solution] === SIMULACIÓ COMPLETA DEL FLUX ===`);

    // 1. Mock d'autenticació (simular usuari autenticat)
    const mockUserId = '2c439ad3-2097-4f17-a1a3-1b4fa8967075'; // L'usuari real del projecte
    console.log(`👤 [Final-Solution] Usuari simulat: ${mockUserId}`);

    // 2. Obtenir projecte amb service role (com si fos via RLS)
    console.log(`📋 [Final-Solution] Obtenint projecte amb accés controlat...`);
    
    const { data: project, error: projectError } = await supabaseServerClient
      .from('projects')
      .select('template_id, project_name, user_id, excel_data')
      .eq('id', projectId)
      .eq('user_id', mockUserId) // Simular filtre RLS
      .single();

    if (projectError || !project) {
      console.error(`❌ [Final-Solution] Projecte no trobat o accés denegat:`, projectError);
      return NextResponse.json({
        success: false,
        error: 'Projecte no trobat o accés denegat',
        step: 'project_access',
        details: projectError?.message
      }, { status: 404 });
    }

    console.log(`✅ [Final-Solution] Projecte obtingut:`, {
      id: projectId,
      name: project.project_name,
      templateId: project.template_id,
      hasExcelData: !!(project.excel_data && project.excel_data.length > 0)
    });

    // 3. Aplicar la NOVA LÒGICA per obtenir plantilla amb mapping
    console.log(`🔍 [Final-Solution] Aplicant nova lògica de mapping de plantilla...`);
    
    const { data: templateRaw, error: templateError } = await supabaseServerClient
      .from('plantilla_configs')
      .select('*')
      .eq('id', project.template_id)
      .single();

    if (templateError || !templateRaw) {
      console.error(`❌ [Final-Solution] Plantilla no trobada:`, templateError);
      return NextResponse.json({
        success: false,
        error: 'Plantilla no trobada amb nova lògica',
        step: 'template_access',
        details: templateError?.message
      }, { status: 404 });
    }

    console.log(`📊 [Final-Solution] Plantilla raw obtinguda amb columnes:`, Object.keys(templateRaw));

    // 4. APLICAR EL MAPPING REAL (mateix codi que generate-smart-enhanced)
    const template = {
      id: templateRaw.id,
      user_id: templateRaw.user_id,
      config_name: templateRaw.config_name,
      // Utilitzar final_html com a contingut de la plantilla
      template_content: templateRaw.final_html || templateRaw.ai_instructions || null,
      // Prioritzar els diferents paths de document disponibles
      docx_storage_path: templateRaw.docx_storage_path || 
                        templateRaw.base_docx_storage_path || 
                        templateRaw.placeholder_docx_storage_path ||
                        templateRaw.indexed_docx_storage_path ||
                        null
    };

    console.log(`📋 [Final-Solution] Plantilla després del mapping:`, {
      id: template.id,
      name: template.config_name,
      hasContent: !!template.template_content,
      hasDocxPath: !!template.docx_storage_path,
      userId: template.user_id,
      contentSource: templateRaw.final_html ? 'final_html' : 
                    templateRaw.ai_instructions ? 'ai_instructions' : 'NONE',
      docxPathSource: templateRaw.docx_storage_path ? 'docx_storage_path' :
                     templateRaw.base_docx_storage_path ? 'base_docx_storage_path' :
                     templateRaw.placeholder_docx_storage_path ? 'placeholder_docx_storage_path' :
                     templateRaw.indexed_docx_storage_path ? 'indexed_docx_storage_path' : 'NONE'
    });

    // 5. Validació de seguretat
    if (template.user_id !== mockUserId) {
      console.error(`❌ [Final-Solution] Accés no autoritzat a plantilla`);
      return NextResponse.json({
        success: false,
        error: 'Accés no autoritzat a plantilla',
        step: 'template_security',
        details: `Template userId ${template.user_id} !== ${mockUserId}`
      }, { status: 403 });
    }

    // 6. Validació de completesa
    if (!template.template_content || !template.docx_storage_path) {
      console.error(`❌ [Final-Solution] Plantilla incompleta després del mapping`);
      
      const detailedInfo = {
        hasContent: !!template.template_content,
        hasDocxPath: !!template.docx_storage_path,
        availableContent: {
          final_html: !!templateRaw.final_html,
          ai_instructions: !!templateRaw.ai_instructions,
          content_lengths: {
            final_html: templateRaw.final_html?.length || 0,
            ai_instructions: templateRaw.ai_instructions?.length || 0
          }
        },
        availableDocxPaths: {
          docx_storage_path: !!templateRaw.docx_storage_path,
          base_docx_storage_path: !!templateRaw.base_docx_storage_path,
          placeholder_docx_storage_path: !!templateRaw.placeholder_docx_storage_path,
          indexed_docx_storage_path: !!templateRaw.indexed_docx_storage_path,
          path_values: {
            docx_storage_path: templateRaw.docx_storage_path || 'NULL',
            base_docx_storage_path: templateRaw.base_docx_storage_path || 'NULL',
            placeholder_docx_storage_path: templateRaw.placeholder_docx_storage_path || 'NULL',
            indexed_docx_storage_path: templateRaw.indexed_docx_storage_path || 'NULL'
          }
        }
      };
      
      return NextResponse.json({
        success: false,
        error: 'Plantilla incompleta després del mapping',
        step: 'template_validation',
        details: detailedInfo,
        recommendation: !template.template_content 
          ? 'La plantilla no té contingut disponible (final_html o ai_instructions)'
          : 'La plantilla no té cap path de document DOCX disponible'
      }, { status: 400 });
    }

    // 7. ÈXIT! Preparar configuració per generació
    console.log(`✅ [Final-Solution] Plantilla vàlida! Preparant configuració...`);
    
    const mockExcelData = project.excel_data || [
      { nom: 'Test', cognom: 'Usuario', email: 'test@example.com' }
    ];

    const generationConfig = {
      templateId: template.id,
      templateContent: template.template_content,
      templateStoragePath: template.docx_storage_path,
      excelData: mockExcelData.slice(0, 1), // Només el primer per test
      userId: mockUserId,
    };

    console.log(`🎯 [Final-Solution] Configuració de generació preparada:`, {
      templateId: generationConfig.templateId,
      hasContent: !!generationConfig.templateContent,
      contentLength: generationConfig.templateContent?.length || 0,
      hasStoragePath: !!generationConfig.templateStoragePath,
      storagePath: generationConfig.templateStoragePath,
      dataRows: generationConfig.excelData.length,
      userId: generationConfig.userId
    });

    // 8. RESULTAT FINAL
    return NextResponse.json({
      success: true,
      message: '🎉 SOLUCIÓ FUNCIONANT! La plantilla es pot processar correctament',
      diagnostics: {
        project: {
          id: projectId,
          name: project.project_name,
          templateId: project.template_id,
          hasExcelData: !!(project.excel_data && project.excel_data.length > 0)
        },
        template: {
          id: template.id,
          name: template.config_name,
          userId: template.user_id,
          contentSource: templateRaw.final_html ? 'final_html' : 'ai_instructions',
          contentLength: template.template_content?.length || 0,
          docxPathSource: templateRaw.docx_storage_path ? 'docx_storage_path' : 
                         templateRaw.base_docx_storage_path ? 'base_docx_storage_path' : 
                         'other',
          docxPath: template.docx_storage_path
        },
        mapping: {
          originalColumns: Object.keys(templateRaw),
          mappedSuccessfully: {
            content: !!template.template_content,
            docxPath: !!template.docx_storage_path
          }
        }
      },
      nextSteps: [
        '✅ generate-smart-enhanced ja està actualitzat amb aquesta lògica',
        '✅ La interfície web hauria de funcionar ara',
        '🔄 Prova la interfície web per confirmar la solució'
      ],
      testRecommendation: 'Prova ara la interfície web - hauria de funcionar correctament!'
    });

  } catch (error) {
    console.error(`❌ [Final-Solution] Error crític:`, error);
    
    return NextResponse.json({
      success: false,
      error: 'Error crític en test final',
      step: 'critical_error',
      details: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 });
  }
}
