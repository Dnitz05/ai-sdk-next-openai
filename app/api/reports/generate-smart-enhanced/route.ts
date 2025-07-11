/**
 * API Endpoint: /api/reports/generate-smart-enhanced
 * 
 * Versió millorada que soluciona el problema de excel_data null
 * i permet generació individual intel·ligent
 */

import { NextRequest, NextResponse } from 'next/server';
import { SmartDocumentProcessor } from '@/lib/smart/SmartDocumentProcessor';
import { BatchProcessingConfig, isValidExcelData } from '@/lib/smart/types';
import { createServerClient } from '@supabase/ssr';
import supabaseServerClient from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log(`🚀 [SmartAPI-Enhanced] Nova petició de generació intel·ligent`);

    const body = await request.json();
    const { 
      templateId, 
      projectId,
      generationIds, // Opcional: array d'IDs específics per generar
      mode = 'batch' // 'batch' o 'individual'
    } = body;

    // Validacions bàsiques
    if (!templateId && !projectId) {
      return NextResponse.json(
        { success: false, error: 'templateId o projectId són obligatoris' },
        { status: 400 }
      );
    }

    // Crear client SSR per llegir cookies de la sessió
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => {
            return request.cookies.getAll().map(cookie => ({
              name: cookie.name,
              value: cookie.value,
            }))
          },
          setAll: () => {
            // No necessitem setAll en aquest context
          }
        }
      }
    );

    // Obtenir userId de la sessió
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error(`❌ [SmartAPI-Enhanced] Error d'autenticació:`, authError);
      return NextResponse.json(
        { success: false, error: 'Usuari no autenticat' },
        { status: 401 }
      );
    }

    console.log(`👤 [SmartAPI-Enhanced] Usuari autenticat: ${user.id}`);

    // Si tenim projectId, obtenir templateId i excel_data
    let finalTemplateId = templateId;
    let excelData = body.excelData;

    if (projectId) {
      console.log(`📋 [SmartAPI-Enhanced] Carregant dades del projecte: ${projectId}`);
      
      // Obtenir informació del projecte (RLS filtra automàticament per user_id)
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('template_id, excel_data, total_rows')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        console.error(`❌ [SmartAPI-Enhanced] Error obtenint projecte:`, projectError);
        return NextResponse.json(
          { success: false, error: 'Projecte no trobat' },
          { status: 404 }
        );
      }

      finalTemplateId = project.template_id;

      // Si excel_data és null (projectes grans), carregar només les files necessàries
      if (!project.excel_data && generationIds && generationIds.length > 0) {
        console.log(`🔍 [SmartAPI-Enhanced] Carregant dades específiques per ${generationIds.length} generacions`);
        
        // RLS filtra automàticament per user_id via project_id
        const { data: generations, error: genError } = await supabase
          .from('generations')
          .select('row_data, excel_row_index')
          .in('id', generationIds)
          .eq('project_id', projectId);

        if (genError || !generations) {
          console.error(`❌ [SmartAPI-Enhanced] Error obtenint generacions:`, genError);
          return NextResponse.json(
            { success: false, error: 'Generacions no trobades' },
            { status: 404 }
          );
        }

        excelData = generations.map(g => g.row_data);
      } else {
        excelData = project.excel_data;
      }
    }

    // Validar que tenim dades Excel
    if (!excelData || !isValidExcelData(excelData)) {
      console.error(`❌ [SmartAPI-Enhanced] Dades Excel invàlides o buides`);
      return NextResponse.json(
        { success: false, error: 'No hi ha dades Excel disponibles' },
        { status: 400 }
      );
    }

    // Validar que l'usuari té accés a la plantilla via projecte
    // Primer, comprovar que el projecte existeix i pertany a l'usuari (amb client de cookies)
    if (projectId) {
      const { data: projectValidation, error: projectValidationError } = await supabase
        .from('projects')
        .select('template_id')
        .eq('id', projectId)
        .eq('template_id', finalTemplateId)
        .single();

      if (projectValidationError || !projectValidation) {
        console.error(`❌ [SmartAPI-Enhanced] Accés no autoritzat al projecte/plantilla:`, projectValidationError);
        return NextResponse.json(
          { success: false, error: 'Accés no autoritzat al projecte o plantilla' },
          { status: 403 }
        );
      }
    }

    // Un cop validat l'accés, obtenir la plantilla amb el client de servidor
    // Utilitzant les columnes correctes segons l'esquema real
    console.log(`🔍 [SmartAPI-Enhanced] Obtenint plantilla ${finalTemplateId} amb permisos de servidor`);
    const { data: templateRaw, error: templateError } = await supabaseServerClient
      .from('plantilla_configs')
      .select('*')
      .eq('id', finalTemplateId)
      .single();

    if (templateError || !templateRaw) {
      console.error(`❌ [SmartAPI-Enhanced] Plantilla no trobada: ${finalTemplateId}`, templateError);
      return NextResponse.json(
        { success: false, error: 'Plantilla no trobada' },
        { status: 404 }
      );
    }

    // Mappejar columnes reals a les esperadas pel sistema
    const template = {
      id: templateRaw.id,
      user_id: templateRaw.user_id,
      config_name: templateRaw.config_name,
      // Utilitzar final_html com a contingut de la plantilla (és el que conté la configuració)
      template_content: templateRaw.final_html || templateRaw.ai_instructions || null,
      // Prioritzar els diferents paths de document disponibles
      docx_storage_path: templateRaw.docx_storage_path || 
                        templateRaw.base_docx_storage_path || 
                        templateRaw.placeholder_docx_storage_path ||
                        templateRaw.indexed_docx_storage_path ||
                        null
    };

    console.log(`📋 [SmartAPI-Enhanced] Plantilla mappejada:`, {
      id: template.id,
      name: template.config_name,
      hasContent: !!template.template_content,
      hasDocxPath: !!template.docx_storage_path,
      userId: template.user_id
    });

    // Validació addicional de seguretat: verificar que la plantilla pertany a l'usuari
    // o és accessible via el projecte validat anteriorment
    if (template.user_id !== user.id && !projectId) {
      console.error(`❌ [SmartAPI-Enhanced] Accés no autoritzat a plantilla per usuari ${user.id}`);
      return NextResponse.json(
        { success: false, error: 'Accés no autoritzat a aquesta plantilla' },
        { status: 403 }
      );
    }

    // Validar que la plantilla té el contingut necessari
    if (!template.template_content || !template.docx_storage_path) {
      console.error(`❌ [SmartAPI-Enhanced] Plantilla incompleta:`, {
        hasContent: !!template.template_content,
        hasDocxPath: !!template.docx_storage_path,
        availableColumns: Object.keys(templateRaw)
      });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Plantilla incompleta - falta contingut o document',
          details: {
            hasContent: !!template.template_content,
            hasDocxPath: !!template.docx_storage_path,
            availableContent: templateRaw.final_html ? 'final_html' : templateRaw.ai_instructions ? 'ai_instructions' : 'none',
            availableDocxPaths: [
              templateRaw.docx_storage_path && 'docx_storage_path',
              templateRaw.base_docx_storage_path && 'base_docx_storage_path',
              templateRaw.placeholder_docx_storage_path && 'placeholder_docx_storage_path',
              templateRaw.indexed_docx_storage_path && 'indexed_docx_storage_path'
            ].filter(Boolean)
          }
        },
        { status: 400 }
      );
    }

    // Construir configuració per al processament
    const config: BatchProcessingConfig = {
      templateId: finalTemplateId,
      templateContent: template.template_content,
      templateStoragePath: template.docx_storage_path,
      excelData: excelData,
      userId: user.id,
    };

    console.log(`📋 [SmartAPI-Enhanced] Configuració preparada:`, {
      templateId: config.templateId,
      documentsToGenerate: config.excelData.length,
      mode: mode,
      hasGenerationIds: !!generationIds,
    });

    // Processar segons el mode
    const processor = new SmartDocumentProcessor();
    let result;

    if (mode === 'individual' && generationIds && generationIds.length === 1) {
      // Mode individual - TODO: Implementar processSingle al SmartDocumentProcessor
      console.log(`🎯 [SmartAPI-Enhanced] Mode individual per generació: ${generationIds[0]}`);
      
      // Per ara, utilitzem el processBatch amb un sol element
      const singleConfig = {
        ...config,
        excelData: [excelData[0]]
      };
      
      result = await processor.processBatch(singleConfig);
      
      // Actualitzar la generació específica (RLS filtra automàticament per user_id)
      if (result.success && result.documents.length > 0) {
        await supabase
          .from('generations')
          .update({
            status: 'generated',
            // Guardar el contingut generat per revisió
            row_data: {
              ...excelData[0],
              smart_content: result.documents[0].placeholderValues,
              smart_generation_id: result.generationId,
              generated_at: new Date().toISOString()
            }
          })
          .eq('id', generationIds[0]);
      }
    } else {
      // Mode batch normal
      result = await processor.processBatch(config);
    }

    // Gestionar resultat
    if (!result.success) {
      console.error(`❌ [SmartAPI-Enhanced] Error en processament:`, result.errorMessage);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Error en processament de documents',
          details: result.errorMessage 
        },
        { status: 500 }
      );
    }

    // Obtenir mètriques
    const metrics = processor.getPerformanceMetrics();
    const totalTime = Date.now() - startTime;

    console.log(`✅ [SmartAPI-Enhanced] Processament completat:`, {
      mode: mode,
      generationId: result.generationId,
      documentsGenerated: result.documentsGenerated,
      totalApiTimeMs: totalTime,
    });

    // Resposta adaptada segons el mode
    const response: any = {
      success: true,
      mode: mode,
      generationId: result.generationId,
      documentsGenerated: result.documentsGenerated,
      processingTimeMs: result.processingTimeMs,
      totalApiTimeMs: totalTime,
      metrics: {
        aiCallTimeMs: metrics.aiCallTime,
        docxGenerationTimeMs: metrics.docxGenerationTime,
        storageUploadTimeMs: metrics.storageUploadTime,
        documentsPerSecond: metrics.documentsPerSecond,
      },
      documents: result.documents.map(doc => ({
        documentIndex: doc.documentIndex,
        storagePath: doc.storagePath,
        placeholderValues: doc.placeholderValues,
      })),
      message: mode === 'individual' 
        ? `Document generat amb èxit en ${(result.processingTimeMs / 1000).toFixed(2)} segons`
        : `${result.documentsGenerated} documents generats amb èxit en ${(result.processingTimeMs / 1000).toFixed(2)} segons`,
    };

    // Si és mode individual, afegir informació per revisió
    if (mode === 'individual' && generationIds) {
      response.generationId = generationIds[0];
      response.reviewUrl = `/informes/${projectId}/generacions/${generationIds[0]}/review`;
    }

    return NextResponse.json(response);

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [SmartAPI-Enhanced] Error crític:`, error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error intern del servidor',
        details: error instanceof Error ? error.message : 'Error desconegut',
        processingTimeMs: totalTime,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reports/generate-smart-enhanced?projectId=xxx
 * Obté informació sobre les dades disponibles per generació intel·ligent
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId és obligatori' },
        { status: 400 }
      );
    }

    // Crear client SSR per llegir cookies de la sessió
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => {
            return request.cookies.getAll().map(cookie => ({
              name: cookie.name,
              value: cookie.value,
            }))
          },
          setAll: () => {
            // No necessitem setAll en aquest context
          }
        }
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Usuari no autenticat' },
        { status: 401 }
      );
    }

    // Obtenir informació del projecte (RLS filtra automàticament per user_id)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        id,
        template_id,
        project_name,
        excel_filename,
        total_rows,
        plantilla_configs(
          id,
          config_name,
          template_content,
          docx_storage_path
        )
      `)
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: 'Projecte no trobat' },
        { status: 404 }
      );
    }

    // Comprovar si les dades Excel estan disponibles (RLS filtra automàticament)
    const { data: excelCheck } = await supabase
      .from('projects')
      .select('excel_data')
      .eq('id', projectId)
      .single();

    const hasExcelData = !!(excelCheck?.excel_data && excelCheck.excel_data.length > 0);
    const requiresLazyLoad = !hasExcelData && project.total_rows > 100;

    // Type assertion per gestionar el tipus de plantilla_configs
    const plantillaConfig = project.plantilla_configs as any;
    
    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.project_name,
        templateId: project.template_id,
        templateName: plantillaConfig?.config_name || 'Desconegut',
        totalRows: project.total_rows,
        hasExcelData: hasExcelData,
        requiresLazyLoad: requiresLazyLoad,
        canGenerateSmart: !!(
          plantillaConfig?.template_content && 
          plantillaConfig?.docx_storage_path
        ),
      },
      recommendation: requiresLazyLoad 
        ? 'Utilitza mode individual per millor rendiment'
        : 'Pots utilitzar mode batch o individual',
    });

  } catch (error) {
    console.error(`❌ [SmartAPI-Enhanced GET] Error:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error consultant informació del projecte',
        details: error instanceof Error ? error.message : 'Error desconegut',
      },
      { status: 500 }
    );
  }
}
