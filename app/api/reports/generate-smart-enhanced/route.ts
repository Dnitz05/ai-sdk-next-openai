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
 
export const runtime = 'nodejs';
export const maxDuration = 30; // Només 30 segons per al disparador

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log(`🚀 [API-Trigger] Nova petició de generació individual`);

    const body = await request.json();
    console.log('[API-Trigger] Body rebut:', { 
      projectId: body.projectId, 
      generationId: body.generationId
    });

    const { 
      projectId,
      generationId // Un sol ID per processar
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

    // Crear client SSR per autenticació
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
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      console.error(`❌ [API-Trigger] Error d'autenticació:`, authError);
      return NextResponse.json(
        { success: false, error: 'Usuari no autenticat' },
        { status: 401 }
      );
    }

    const user = authData.user;
    console.log(`👤 [API-Trigger] Usuari autenticat: ${user.id}`);

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

    // Obtenir URL base per al worker
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    const constructedUrl = `${baseUrl}/api/worker/generation-processor`;

    // TODO: ELIMINAR DESPRÉS DEL DEBUG - URL hardcodejada temporalment
    const FIXED_WORKER_URL = 'https://ai-sdk-next-openai-94c61ocle-dnitzs-projects.vercel.app/api/worker/generation-processor';
    const useFixedUrl = true; // Canviar a false per usar URL dinàmica
    const workerUrl = useFixedUrl ? FIXED_WORKER_URL : constructedUrl;

    console.log(`🔧 [API-Trigger] Invocant worker a: ${workerUrl}`);

    // Disparar worker (fire-and-forget)
    try {
      const workerToken = process.env.WORKER_SECRET_TOKEN;
      if (!workerToken) {
        throw new Error('WORKER_SECRET_TOKEN no està configurat al servidor trigger.');
      }

      // ========== DEBUG LOGGING DETALLAT ==========
      console.log('[DEBUG TRIGGER] ========== Inici Debug Worker ==========');
      console.log('[DEBUG TRIGGER] Worker URL construida:', constructedUrl);
      console.log('[DEBUG TRIGGER] Worker URL usada:', workerUrl);
      console.log('[DEBUG TRIGGER] Use fixed URL:', useFixedUrl);
      console.log('[DEBUG TRIGGER] Protocol:', protocol);
      console.log('[DEBUG TRIGGER] Host:', host);
      console.log('[DEBUG TRIGGER] Base URL:', baseUrl);
      console.log('[DEBUG TRIGGER] Token disponible:', !!workerToken);
      console.log('[DEBUG TRIGGER] Token length:', workerToken?.length);
      console.log('[DEBUG TRIGGER] Token prefix:', workerToken?.substring(0, 10));
      console.log('[DEBUG TRIGGER] User ID:', user.id);
      console.log('[DEBUG TRIGGER] Project ID:', projectId);
      console.log('[DEBUG TRIGGER] Generation ID:', generationId);
      console.log('[DEBUG TRIGGER] ================================================');
      
      // CANVI CLAU: Ara fem 'await' i gestionem la resposta del worker
      const workerResponse = await fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${workerToken}`, // Primer per visibilitat
          'Content-Type': 'application/json',
          'x-vercel-protection-bypass': process.env.VERCEL_PROTECTION_BYPASS || '',
          'User-Agent': 'Internal-Worker-Call',
          'x-internal-request': 'true'
        },
        body: JSON.stringify({
          projectId,
          generationId,
          userId: user.id
        })
      });

      const totalTime = Date.now() - startTime;

      // Comprovar si el worker ha respost correctament
      if (!workerResponse.ok) {
        let errorMessage;
        let errorText = '';
        const contentType = workerResponse.headers.get('content-type');
        
        // ========== DEBUG ERROR LOGGING DETALLAT ==========
        console.error('[DEBUG TRIGGER] ========== Worker Error Details ==========');
        console.error('[DEBUG TRIGGER] Worker response status:', workerResponse.status);
        console.error('[DEBUG TRIGGER] Worker response statusText:', workerResponse.statusText);
        console.error('[DEBUG TRIGGER] Worker response headers:', Object.fromEntries(workerResponse.headers.entries()));
        console.error('[DEBUG TRIGGER] Worker response content-type:', contentType);
        
        try {
          errorText = await workerResponse.text();
          console.error('[DEBUG TRIGGER] Worker response body:', errorText);
        } catch (textError) {
          console.error('[DEBUG TRIGGER] Error reading worker response body:', textError);
          errorText = 'Could not read response body';
        }
        
        // Si la resposta sembla JSON, la parsegem. Si no, agafem el text.
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorData.details || `El worker ha fallat amb estat ${workerResponse.status}`;
            console.error('[DEBUG TRIGGER] Parsed JSON error:', errorData);
          } catch (e) {
            errorMessage = `El worker ha retornat una resposta JSON invàlida amb estat ${workerResponse.status}`;
            console.error('[DEBUG TRIGGER] JSON parse error:', e);
          }
        } else {
          // La resposta no és JSON (probablement una pàgina d'error HTML de Vercel)
          errorMessage = `El worker ha retornat una resposta no esperada (possiblement un error d'infraestructura) amb estat ${workerResponse.status}`;
          console.error('[DEBUG TRIGGER] Non-JSON response detected');
        }
        
        console.error('[DEBUG TRIGGER] Final error message:', errorMessage);
        console.error('[DEBUG TRIGGER] ================================================');
        console.error(`❌ [API-Trigger] El worker ha fallat (Estat ${workerResponse.status}):`, errorMessage);

        // --- BLINDATGE FIABLE DE L'ESTAT D'ERROR ---
        // Assegurem que l'error es desa a la base de dades abans de respondre
        const { error: dbError } = await supabase
          .from('generations')
          .update({
            status: 'error',
            error_message: `Error del worker: ${errorMessage}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', generationId);

        if (dbError) {
            console.error(`❌ [API-Trigger] ERROR CRÍTIC: No s'ha pogut actualitzar l'estat d'error a la BD.`, dbError);
            // Responem igualment al client amb l'error original del worker
            return NextResponse.json(
              { success: false, error: errorMessage, notification: "No s'ha pogut actualitzar l'estat a la BD." },
              { status: 500 }
            );
        }

        return NextResponse.json(
          { success: false, error: errorMessage },
          { status: 500 } // Retornem un 500 genèric al client, ja que és un error del servidor
        );
      }
      
      const resultData = await workerResponse.json();
      console.log(`✅ [API-Trigger] El worker ha completat la tasca en ${totalTime}ms`);

      // El worker ja ha actualitzat l'estat a 'generated'.
      // Responem amb èxit indicant que tot el procés s'ha completat.
      return NextResponse.json({
        success: true,
        generationId: generationId,
        message: 'Generació completada amb èxit',
        data: resultData
      }, { status: 200 }); // 200 OK

    } catch (error) {
      console.error(`❌ [API-Trigger] Error crític durant la invocació del worker:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Error desconegut';

      // Revertir estat de la generació a 'error'
      await supabase
        .from('generations')
        .update({
          status: 'error',
          error_message: `Error crític del disparador: ${errorMessage}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', generationId);

      return NextResponse.json(
        { success: false, error: 'Error crític iniciant la tasca', details: errorMessage },
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
