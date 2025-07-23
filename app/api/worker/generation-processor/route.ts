/**
 * Worker de Fons per al Processament de Generacions Individuals
 * 
 * Aquest endpoint executa la lògica de generació completa de manera asíncrona.
 * És invocat internament per l'API disparador i actualitza l'estat a la BD.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SmartDocumentProcessor } from '@/lib/smart/SmartDocumentProcessor';
import { BatchProcessingConfig, isValidExcelData } from '@/lib/smart/types';
import supabaseServerClient from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minuts per al worker

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 1. Verificació del Secret del Worker
    const authToken = request.headers.get('Authorization');
    if (authToken !== `Bearer ${process.env.WORKER_SECRET_TOKEN}`) {
      console.error('❌ [Worker] Secret del worker invàlid o no proporcionat');
      return NextResponse.json({ success: false, error: 'Accés no autoritzat' }, { status: 401 });
    }

    console.log(`🔧 [Worker] Processant nova tasca de generació`);

    const body = await request.json();
    console.log('[Worker DEBUG] Body rebut:', { 
      projectId: body.projectId, 
      generationId: body.generationId, 
      userId: body.userId 
    });

    const { 
      projectId,
      generationId,
      userId
    } = body;

    // Validacions bàsiques
    if (!projectId || !generationId || !userId) {
      console.error(`❌ [Worker] Paràmetres obligatoris faltants`);
      return NextResponse.json(
        { success: false, error: 'projectId, generationId i userId són obligatoris' },
        { status: 400 }
      );
    }

    console.log(`🔧 [Worker] Iniciant processament per usuari ${userId}, projecte ${projectId}, generació ${generationId}`);

    // 2. Comprovació d'Idempotència
    const { data: currentState, error: stateError } = await supabaseServerClient
      .from('generations')
      .select('status')
      .eq('id', generationId)
      .single();

    if (stateError) {
      throw new Error(`Error consultant estat inicial: ${stateError.message}`);
    }

    if (['generated', 'completed', 'error'].includes(currentState.status)) {
      console.log(`🟡 [Worker] La generació ${generationId} ja està en un estat final (${currentState.status}). S'omet el processament.`);
      return NextResponse.json({ success: true, message: 'Ja processat, s\'omet.', status: currentState.status });
    }

    // 3. Actualitzar estat inicial a 'processing' amb timestamp
    await supabaseServerClient
      .from('generations')
      .update({ 
        status: 'processing', 
        updated_at: new Date().toISOString(),
        error_message: null 
      })
      .eq('id', generationId);

    console.log(`🔧 [Worker] Estat actualitzat a 'processing'`);

    // Obtenir informació del projecte
    const { data: project, error: projectError } = await supabaseServerClient
      .from('projects')
      .select('template_id, excel_data, total_rows')
      .eq('id', projectId)
      .eq('user_id', userId) // Seguretat: només projectes de l'usuari
      .single();

    if (projectError || !project) {
      const errorMsg = `Projecte no trobat: ${projectError?.message}`;
      console.error(`❌ [Worker] ${errorMsg}`);
      
      // Actualitzar estat a error
      await supabaseServerClient
        .from('generations')
        .update({ 
          status: 'error', 
          error_message: errorMsg,
          updated_at: new Date().toISOString()
        })
        .eq('id', generationId);

      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 404 }
      );
    }

    const templateId = project.template_id;

    // 4. Obtenir dades de la generació específica
    const { data: generation, error: genError } = await supabaseServerClient
      .from('generations')
      .select('row_data, excel_row_index')
      .eq('id', generationId)
      .single();

    if (genError || !generation) {
      const errorMsg = `Generació no trobada: ${genError?.message}`;
      console.error(`❌ [Worker] ${errorMsg}`);
      await supabaseServerClient.from('generations').update({ status: 'error', error_message: errorMsg }).eq('id', generationId);
      return NextResponse.json({ success: false, error: errorMsg }, { status: 404 });
    }

    const excelData = [generation.row_data];
    console.log(`🔧 [Worker] Dades carregades per a la fila ${generation.excel_row_index}`);

    // Validar dades Excel
    if (!excelData || !isValidExcelData(excelData)) {
      const errorMsg = 'No hi ha dades Excel disponibles';
      console.error(`❌ [Worker] ${errorMsg}`);
      
      await supabaseServerClient
        .from('generations')
        .update({ 
          status: 'error', 
          error_message: errorMsg,
          updated_at: new Date().toISOString()
        })
        .eq('id', generationId);

      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 400 }
      );
    }

    // Obtenir plantilla
    console.log(`🔧 [Worker] Obtenint plantilla ${templateId}`);

    const { data: templateRaw, error: templateError } = await supabaseServerClient
      .from('plantilla_configs')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !templateRaw) {
      const errorMsg = `Plantilla no trobada: ${templateError?.message}`;
      console.error(`❌ [Worker] ${errorMsg}`);
      
      await supabaseServerClient
        .from('generations')
        .update({ 
          status: 'error', 
          error_message: errorMsg,
          updated_at: new Date().toISOString()
        })
        .eq('id', generationId);

      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 404 }
      );
    }

    // Mappejar plantilla
    const template = {
      id: templateRaw.id,
      user_id: templateRaw.user_id,
      config_name: templateRaw.config_name,
      template_content: templateRaw.final_html || templateRaw.ai_instructions || null,
      docx_storage_path: templateRaw.docx_storage_path || 
                        templateRaw.base_docx_storage_path || 
                        templateRaw.placeholder_docx_storage_path ||
                        templateRaw.indexed_docx_storage_path ||
                        null
    };

    // Validar plantilla
    if (!template.template_content || !template.docx_storage_path) {
      const errorMsg = 'Plantilla incompleta - falta contingut o document';
      console.error(`❌ [Worker] ${errorMsg}`);
      
      await supabaseServerClient
        .from('generations')
        .update({ 
          status: 'error', 
          error_message: errorMsg,
          updated_at: new Date().toISOString()
        })
        .eq('id', generationId);

      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 400 }
      );
    }

    // Configurar processament
    const config: BatchProcessingConfig = {
      templateId: templateId,
      templateContent: template.template_content,
      templateStoragePath: template.docx_storage_path,
      excelData: excelData,
      userId: userId,
    };

    console.log(`🔧 [Worker] Configuració preparada. Iniciant processament...`);

    // Executar generació
    const processor = new SmartDocumentProcessor();
    const result = await processor.processBatch(config);

    console.log(`🔧 [Worker] Processament completat:`, { 
      success: result.success, 
      documents: result.documentsGenerated 
    });

    if (!result.success) {
      const errorMsg = `Error en processament: ${result.errorMessage}`;
      console.error(`❌ [Worker] ${errorMsg}`);
      
      // Actualitzar estat a error
      await supabaseServerClient
        .from('generations')
        .update({ 
          status: 'error', 
          error_message: errorMsg,
          updated_at: new Date().toISOString()
        })
        .eq('id', generationId);

      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 500 }
      );
    }

    // Actualitzar estat a generat amb dades del resultat
    const docResult = result.documents[0]; // Primer (i únic) document
    const originalData = excelData[0];

    await supabaseServerClient
      .from('generations')
      .update({
        status: 'generated',
        row_data: {
          ...originalData,
          smart_content: docResult.placeholderValues,
          smart_generation_id: result.generationId,
          generated_at: new Date().toISOString()
        },
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', generationId);

    const totalTime = Date.now() - startTime;

    console.log(`✅ [Worker] Tasca completada amb èxit en ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      generationId: result.generationId,
      documentsGenerated: result.documentsGenerated,
      processingTimeMs: result.processingTimeMs,
      totalTimeMs: totalTime,
      details: `Document generat amb èxit per generació ${generationId}`
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Error desconegut';
    
    console.error(`❌ [Worker] Error crític:`, error);
    
    try {
      // Intentar actualitzar l'estat a error
      const { generationId } = await request.json();
      if (generationId) {
        await supabaseServerClient
          .from('generations')
          .update({ 
            status: 'error', 
            error_message: `Error intern: ${errorMsg}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', generationId);
      }
    } catch (updateError) {
      console.error(`❌ [Worker] Error actualitzant estat a BD:`, updateError);
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error intern del worker',
        details: errorMsg,
        processingTimeMs: totalTime,
      },
      { status: 500 }
    );
  }
}
