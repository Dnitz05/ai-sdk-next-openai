/**
 * Worker de Fons per al Processament de Generacions Individuals
 * 
 * Aquest endpoint executa la lògica de generació completa de manera asíncrona.
 * És invocat internament per l'API disparador i actualitza l'estat a la BD.
 * 
 * Versió Millorada: Inclou logging estructurat i gestió d'errors robusta
 */

import { NextRequest, NextResponse } from 'next/server';
import { SmartDocumentProcessor } from '@/lib/smart/SmartDocumentProcessor';
import { BatchProcessingConfig, isValidExcelData } from '@/lib/smart/types';
import { logger, createContextLogger } from '@/lib/utils/logger';
import { createClient } from '@supabase/supabase-js';

// Utilitzar el client admin per a operacions de backend sense dependre de la sessió d'usuari
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minuts per al worker

// Timeout intern per evitar que Vercel mata el procés abruptament
const INTERNAL_TIMEOUT_MS = 4 * 60 * 1000 + 30 * 1000; // 4 minuts 30 segons

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let generationId: string | null = null; // Variable accessible per al finally
  let isProcessingCompleted = false; // Flag per controlar l'estat final
  
  // Context logging per aquesta petició del worker
  const logContext = {
    component: 'GenerationWorker',
    function: 'POST',
    timestamp: new Date().toISOString(),
  };

  try {
    // 1. Verificació del Secret del Worker
    // Llegim la capçalera personalitzada 'X-Worker-Token'
    const authToken = request.headers.get('X-Worker-Token');
    const expectedToken = process.env.WORKER_SECRET_TOKEN;

    if (authToken !== expectedToken) {
      const debugErrorMessage = `Accés no autoritzat. El worker esperava un token que comença per '${expectedToken?.substring(0, 5)}...' però ha rebut un token que comença per '${authToken?.substring(0, 5)}...'. Assegura't que la variable d'entorn WORKER_SECRET_TOKEN estigui configurada i desplegada correctament.`;
      logger.error('Secret del worker invàlid o no proporcionat sota X-Worker-Token', {
        expectedPrefix: expectedToken?.substring(0, 5),
        receivedPrefix: authToken?.substring(0, 5)
      }, logContext);
      return NextResponse.json({ success: false, error: debugErrorMessage }, { status: 401 });
    }

    logger.info('Processant nova tasca de generació amb sistema millorat', logContext);

    const body = await request.json();
    logger.info('Body rebut pel worker', {
      ...logContext,
      requestData: {
        projectId: body.projectId, 
        generationId: body.generationId, 
        userId: body.userId 
      }
    });

    const { 
      projectId,
      generationId: bodyGenerationId,
      userId
    } = body;

    // Assignar generationId a la variable accessible i actualitzar context
    generationId = bodyGenerationId;
    const enrichedContext = {
      ...logContext,
      generationId: generationId || undefined, // Convertir null a undefined
      projectId,
      userId,
    };

    // Validacions bàsiques
    if (!projectId || !generationId || !userId) {
      logger.error('Paràmetres obligatoris faltants', null, enrichedContext);
      return NextResponse.json(
        { success: false, error: 'projectId, generationId i userId són obligatoris' },
        { status: 400 }
      );
    }

    logger.info('Iniciant processament amb paràmetres vàlids', {
      ...enrichedContext,
      validatedParams: {
        userId,
        projectId, 
        generationId
      }
    });

    // 2. Comprovació d'Idempotència
    const { data: currentState, error: stateError } = await supabaseAdmin
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
    await supabaseAdmin
      .from('generations')
      .update({
        status: 'processing', 
        updated_at: new Date().toISOString(),
        error_message: null 
      })
      .eq('id', generationId);

    console.log(`🔧 [Worker] Estat actualitzat a 'processing'`);

    // Obtenir informació del projecte
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('template_id, excel_data, total_rows')
      .eq('id', projectId)
      .eq('user_id', userId) // Seguretat: només projectes de l'usuari
      .single();

    if (projectError || !project) {
      const errorMsg = `Projecte no trobat: ${projectError?.message}`;
      console.error(`❌ [Worker] ${errorMsg}`);
      
      // Actualitzar estat a error
      await supabaseAdmin
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
    const { data: generation, error: genError } = await supabaseAdmin
      .from('generations')
      .select('row_data, excel_row_index')
      .eq('id', generationId)
      .single();

    if (genError || !generation) {
      const errorMsg = `Generació no trobada: ${genError?.message}`;
      console.error(`❌ [Worker] ${errorMsg}`);
      await supabaseAdmin.from('generations').update({ status: 'error', error_message: errorMsg }).eq('id', generationId);
      return NextResponse.json({ success: false, error: errorMsg }, { status: 404 });
    }

    const excelData = [generation.row_data];
    console.log(`🔧 [Worker] Dades carregades per a la fila ${generation.excel_row_index}`);

    // Validar dades Excel
    if (!excelData || !isValidExcelData(excelData)) {
      const errorMsg = 'No hi ha dades Excel disponibles';
      console.error(`❌ [Worker] ${errorMsg}`);
      
      await supabaseAdmin
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

    const { data: templateRaw, error: templateError } = await supabaseAdmin
      .from('plantilla_configs')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !templateRaw) {
      const errorMsg = `Plantilla no trobada: ${templateError?.message}`;
      console.error(`❌ [Worker] ${errorMsg}`);
      
      await supabaseAdmin
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
      
      await supabaseAdmin
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

    console.log(`🔧 [Worker] Configuració preparada. Iniciant processament individual optimitzat...`);

    // Crear una promesa de timeout intern per evitar terminació abrupta de Vercel
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout intern del worker després de ${INTERNAL_TIMEOUT_MS/1000} segons`));
      }, INTERNAL_TIMEOUT_MS);
    });

    // Crear una promesa per al processament optimitzat individual
    const processingPromise = (async () => {
      const processor = new SmartDocumentProcessor();
      
      // Utilitzar processSingle optimitzat per a generacions individuals
      const result = await processor.processSingle(
        template.template_content,
        template.docx_storage_path,
        generation.row_data,
        templateId,
        userId
      );
      
      return result;
    })();

    // Executar amb timeout controat (race entre processament i timeout)
    console.log(`⏱️ [Worker] Iniciant processament amb timeout de ${INTERNAL_TIMEOUT_MS/1000} segons...`);
    const result = await Promise.race([processingPromise, timeoutPromise]);

    console.log(`🔧 [Worker] Processament completat:`, { 
      success: result.success, 
      documents: result.documentsGenerated 
    });

    if (!result.success) {
      const errorMsg = `Error en processament individual: ${result.errorMessage}`;
      console.error(`❌ [Worker] ${errorMsg}`);
      
      // Actualitzar estat a error
      await supabaseAdmin
        .from('generations')
        .update({
          status: 'error', 
          error_message: errorMsg,
          updated_at: new Date().toISOString()
        })
        .eq('id', generationId);

      isProcessingCompleted = true; // Marcar com completat per evitar doble actualització
      
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 500 }
      );
    }

    // Actualitzar estat a generat amb dades del resultat
    const docResult = result.documents[0]; // Primer (i únic) document
    const originalData = excelData[0];

    await supabaseAdmin
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

    isProcessingCompleted = true; // Marcar com completat per evitar doble actualització
    const totalTime = Date.now() - startTime;

    console.log(`✅ [Worker] Tasca individual completada amb èxit en ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      generationId: result.generationId,
      documentsGenerated: result.documentsGenerated,
      processingTimeMs: result.processingTimeMs,
      totalTimeMs: totalTime,
      details: `Document generat amb èxit per generació ${generationId}`,
      optimizedMode: 'processSingle'
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Error desconegut';
    
    // Detectar si ha estat un timeout intern
    const isTimeoutError = errorMsg.includes('Timeout intern del worker');
    
    console.error(`❌ [Worker] Error crític${isTimeoutError ? ' (TIMEOUT)' : ''}:`, error);
    
    // Intentar actualitzar l'estat a error utilitzant la variable accessible
    if (generationId && !isProcessingCompleted) {
      try {
        const finalErrorMsg = isTimeoutError 
          ? 'Timeout: El processament ha trigat més del temps permès'
          : `Error intern: ${errorMsg}`;
          
        await supabaseAdmin
          .from('generations')
          .update({
            status: 'error', 
            error_message: finalErrorMsg,
            updated_at: new Date().toISOString()
          })
          .eq('id', generationId);
          
        console.log(`🔧 [Worker] Estat actualitzat a 'error' per la generació ${generationId}${isTimeoutError ? ' (TIMEOUT)' : ''}`);
        isProcessingCompleted = true;
      } catch (updateError) {
        console.error(`❌ [Worker] Error actualitzant estat a BD:`, updateError);
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: isTimeoutError ? 'Timeout del processament' : 'Error intern del worker',
        details: errorMsg,
        processingTimeMs: totalTime,
        timeoutError: isTimeoutError,
      },
      { status: isTimeoutError ? 408 : 500 }
    );
  } finally {
    // Bloc FINALLY MILLORAT: Garanteix que cap generació es quedi en estat "processing"
    if (generationId && !isProcessingCompleted) {
      try {
        console.log(`🔧 [Worker] Finally: Verificant estat final de la generació ${generationId}`);
        
        // Comprovar l'estat actual només si no hem marcat com completat
        const { data: finalState, error: finalStateError } = await supabaseAdmin
          .from('generations')
          .select('status')
          .eq('id', generationId)
          .single();

        if (!finalStateError && finalState && finalState.status === 'processing') {
          // Si encara està en "processing", quelcom ha anat malament. Forçar a "error"
          console.log(`⚠️ [Worker] Finally: Generació ${generationId} encara en 'processing'. Forçant a 'error'.`);
          
          await supabaseAdmin
            .from('generations')
            .update({
              status: 'error', 
              error_message: 'Worker interromput inesperadament - processament incomplet',
              updated_at: new Date().toISOString()
            })
            .eq('id', generationId);
            
          console.log(`🔧 [Worker] Finally: Estat forçat a 'error' per evitar "processing" infinit`);
        } else {
          console.log(`✅ [Worker] Finally: Generació ${generationId} en estat final correcte: ${finalState?.status}`);
        }
      } catch (finallyError) {
        console.error(`❌ [Worker] Error en bloc finally:`, finallyError);
        
        // Últim intent deseseperat per evitar estat "processing" penjat
        try {
          await supabaseAdmin
            .from('generations')
            .update({
              status: 'error', 
              error_message: 'Error crític: no s\'ha pogut determinar l\'estat final',
              updated_at: new Date().toISOString()
            })
            .eq('id', generationId);
          console.log(`🆘 [Worker] Finally: Últim intent per evitar estat penjat completat`);
        } catch (lastResortError) {
          console.error(`💀 [Worker] Finally: Últim intent fallit:`, lastResortError);
        }
      }
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`🏁 [Worker] Processament finalitzat en ${totalTime}ms (completed: ${isProcessingCompleted})`);
  }
}
