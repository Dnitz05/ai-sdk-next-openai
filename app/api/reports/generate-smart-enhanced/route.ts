/**
 * API Endpoint: /api/reports/generate-smart-enhanced
 * 
 * API Disparador Simplificat per a la Generació Individual
 * Aquest endpoint processa un sol document a la vegada, delegant
 * al frontend la gestió de la cua i el control del flux.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { SmartDocumentProcessor } from '@/lib/smart/SmartDocumentProcessor';
import supabaseServerClient from '@/lib/supabase/server';
 
export const runtime = 'nodejs';
export const maxDuration = 30; // Només 30 segons per al disparador

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log(`🚀 [API-Trigger] Nova petició de generació individual`);

    const body = await request.json();
    console.log('[API-Trigger] Body rebut:', { 
      projectId: body.projectId, 
      generationId: body.generationId,
      adminMode: body.adminMode
    });

    const { 
      projectId,
      generationId, // Un sol ID per processar
      adminMode = false // Mode administratiu per saltar autenticació
    } = body;

    // Validacions bàsiques
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId és obligatori' },
        { status: 400 }
      );
    }

    if (!generationId) {
      return NextResponse.json(
        { success: false, error: 'generationId és obligatori' },
        { status: 400 }
      );
    }

    let user: any;
    let supabase: any;

    if (!adminMode) {
      // Mode normal - validar autenticació
      supabase = createServerClient(
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
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        console.error(`❌ [API-Trigger] Error d'autenticació:`, authError);
        return NextResponse.json(
          { success: false, error: 'Usuari no autenticat' },
          { status: 401 }
        );
      }

      user = authData.user;
      console.log(`👤 [API-Trigger] Usuari autenticat: ${user.id}`);
    } else {
      // Mode administratiu - usar service role client
      supabase = supabaseServerClient;
      user = { id: 'admin-mode' }; // ID fictici per mode admin
      console.log(`🔧 [API-Trigger] Mode administratiu activat`);
    }

    // Validar accés al projecte (RLS filtra automàticament)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, template_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error(`❌ [API-Trigger] Projecte no trobat:`, projectError);
      return NextResponse.json(
        { success: false, error: 'Projecte no trobat o sense accés' },
        { status: 404 }
      );
    }

    // Validar que la generació existeix i pertany al projecte
    const { data: generation, error: generationError } = await supabase
      .from('generations')
      .select('id, status')
      .eq('id', generationId)
      .eq('project_id', projectId)
      .single();

    if (generationError || !generation) {
      console.error(`❌ [API-Trigger] Generació no trobada:`, generationError);
      return NextResponse.json(
        { success: false, error: 'Generació no trobada' },
        { status: 404 }
      );
    }

    // Comprovar que la generació no estigui ja en procés
    if (generation.status === 'processing') {
      return NextResponse.json(
        {
          success: false,
          error: 'La generació ja està en procés',
          generationId: generationId
        },
        { status: 409 } // Conflict
      );
    }

    // --- FASE 3: Validació d'Integritat de la Plantilla (versió robusta) ---
    const { data: templateData, error: templateError } = await supabase
      .from('plantilla_configs')
      .select('*')
      .eq('id', project.template_id)
      .single();

    if (templateError || !templateData) {
      const errorMsg = `Error recuperant la plantilla de configuració: ${templateError?.message || 'No trobada'}`;
      await supabase.from('generations').update({ status: 'error', error_message: errorMsg }).eq('id', generationId);
      return NextResponse.json({ success: false, error: errorMsg }, { status: 404 });
    }

    const hasContent = templateData.final_html || templateData.ai_instructions || templateData.template_content;
    const hasDocx = templateData.docx_storage_path || templateData.base_docx_storage_path || templateData.placeholder_docx_storage_path;

    if (!hasContent || !hasDocx) {
      let errorParts = [];
      if (!hasContent) errorParts.push("falta contingut (final_html, ai_instructions, etc.)");
      if (!hasDocx) errorParts.push("falta el fitxer DOCX base (docx_storage_path, etc.)");
      
      const errorMsg = `La plantilla de configuració està incompleta: ${errorParts.join(' i ')}.`;
      await supabase.from('generations').update({ status: 'error', error_message: errorMsg }).eq('id', generationId);
      return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
    }

    console.log(`🚀 [API-Trigger] Iniciant tasca per generació ${generationId}`);

    // Marcar generació com a 'processing'
    const { error: updateError } = await supabase
      .from('generations')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString(),
        error_message: null
      })
      .eq('id', generationId);

    if (updateError) {
      console.error(`❌ [API-Trigger] Error actualitzant estat:`, updateError);
      return NextResponse.json(
        { success: false, error: 'Error actualitzant estat de la generació' },
        { status: 500 }
      );
    }

    // Processar directament sense worker HTTP
    try {
      console.log(`🔧 [API-Trigger] Processant directament generació ${generationId}`);
      
      // Obtenir dades necessàries per processar
      const { data: generation, error: genError } = await supabase
        .from('generations')
        .select('*')
        .eq('id', generationId)
        .single();
        
      if (genError || !generation) {
        throw new Error(`No es pot trobar la generació: ${genError?.message}`);
      }
      
      // Obtenir la plantilla - CORRECCIÓ: usar template_id directament
      const { data: template, error: templateError } = await supabaseServerClient
        .from('plantilla_configs')
        .select('*')
        .eq('id', project.template_id)  // ✅ CORREGIT: template_id, no template.id
        .single();
        
      if (templateError || !template) {
        throw new Error(`No es pot trobar la plantilla: ${templateError?.message}`);
      }
      
      // SISTEMA SIMPLE: Usar directament el DOCX amb placeholders
      // Prioritzar placeholder_docx_storage_path (format simple) sobre altres
      const docxPath = template.placeholder_docx_storage_path || 
                      template.docx_storage_path || 
                      template.base_docx_storage_path ||
                      template.indexed_docx_storage_path ||
                      null;
      
      // Verificar que la plantilla té el DOCX necessari
      if (!docxPath) {
        console.error('[API-Trigger] Plantilla sense DOCX:', {
          paths: {
            placeholder: template.placeholder_docx_storage_path,
            docx_storage_path: template.docx_storage_path,
            base: template.base_docx_storage_path,
            indexed: template.indexed_docx_storage_path
          }
        });
        throw new Error('La plantilla no té fitxer DOCX configurat');
      }
      
      console.log(`📄 [API-Trigger] Usant DOCX: ${docxPath}`);
      
      // Crear processador i executar amb sistema simple
      const processor = new SmartDocumentProcessor();
      
      const result = await processor.processSingle(
        '', // templateContent no necessari per sistema simple
        docxPath,
        generation.row_data,
        project.template_id,
        user.id
      );
      
      if (!result.success) {
        throw new Error(result.errorMessage || 'Error en processament');
      }
      
      // Actualitzar la generació amb el resultat - VERSIÓ SIMPLIFICADA
      if (!result.documentBuffer) {
        throw new Error('No s\'ha generat cap document');
      }
      
      const { error: updateError } = await supabase
        .from('generations')
        .update({
          status: 'generated',
          updated_at: new Date().toISOString(),
          error_message: null
        })
        .eq('id', generationId);
        
      if (updateError) {
        throw new Error(`Error actualitzant resultat: ${updateError.message}`);
      }
      
      console.log(`✅ [API-Trigger] Generació ${generationId} completada amb èxit`);
      
      // Retornar document directament per descàrrega
      return new Response(result.documentBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="informe_${generationId}.docx"`,
        },
      });
      
    } catch (error) {
      console.error(`❌ [API-Trigger] Error processant:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Error desconegut';
      
      // Actualitzar estat d'error
      await supabase
        .from('generations')
        .update({
          status: 'error',
          error_message: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', generationId);
        
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      );
    }

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [API-Trigger] Error crític:`, error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error intern del disparador',
        details: error instanceof Error ? error.message : 'Error desconegut',
        dispatchTimeMs: totalTime,
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
      asyncMode: true,
      message: 'API configurada per a processament asíncron'
    });

  } catch (error) {
    console.error(`❌ [API-Trigger GET] Error:`, error);
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
