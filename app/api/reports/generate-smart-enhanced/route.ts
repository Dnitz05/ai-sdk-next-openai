/**
 * API Endpoint: /api/reports/generate-smart-enhanced
 * 
 * API Disparador Asíncron per a la Generació Intel·ligent
 * Aquest endpoint inicia la tasca i retorna immediatament, delegant
 * la feina pesada al worker de fons.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
 
export const runtime = 'nodejs';
export const maxDuration = 30; // Només 30 segons per al disparador

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log(`🚀 [API-Trigger] Nova petició de generació asíncrona`);

    const body = await request.json();
    console.log('[API-Trigger] Body rebut:', { 
      projectId: body.projectId, 
      mode: body.mode, 
      generationIdsLength: body.generationIds?.length 
    });

    const { 
      projectId,
      generationIds, // Array d'IDs per mode individual
      mode = 'individual' // Només mode individual per ara
    } = body;

    // Validacions bàsiques
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId és obligatori' },
        { status: 400 }
      );
    }

    if (mode === 'individual' && (!generationIds || !Array.isArray(generationIds) || generationIds.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'generationIds és obligatori per al mode individual' },
        { status: 400 }
      );
    }

    if (mode === 'batch') {
      return NextResponse.json(
        { success: false, error: 'Mode batch encara no suportat en la versió asíncrona' },
        { status: 501 }
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

    // Obtenir userId de la sessió o del mode de test
    let user: { id: string } | null = null;
    const internalTestHeader = request.headers.get('X-Internal-Test-Auth');

    if (process.env.NODE_ENV === 'development' && internalTestHeader === process.env.WORKER_SECRET_TOKEN && body.testUserId) {
      console.log(`[API-Trigger] Mode de test intern activat. Simulant usuari: ${body.testUserId}`);
      user = { id: body.testUserId };
    } else {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        console.error(`❌ [API-Trigger] Error d'autenticació:`, authError);
        return NextResponse.json(
          { success: false, error: 'Usuari no autenticat' },
          { status: 401 }
        );
      }
      user = authData.user;
    }

    console.log(`👤 [API-Trigger] Usuari autenticat: ${user.id}`);

    // Validar accés al projecte
    let project: { id: string; template_id: any; } | null = null;
    let projectError: any = null;

    if (process.env.NODE_ENV === 'development' && internalTestHeader === process.env.WORKER_SECRET_TOKEN) {
      const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data, error } = await serviceClient.from('projects').select('id, template_id, user_id').eq('id', projectId).single();
      if (error || !data || data.user_id !== user.id) {
        projectError = error || new Error('Test: User ID mismatch');
      } else {
        project = data;
      }
    } else {
      const { data, error } = await supabase.from('projects').select('id, template_id').eq('id', projectId).single();
      if (error || !data) {
        projectError = error;
      } else {
        project = data;
      }
    }

    if (projectError || !project) {
      console.error(`❌ [API-Trigger] Projecte no trobat:`, projectError);
      return NextResponse.json(
        { success: false, error: 'Projecte no trobat o sense accés' },
        { status: 404 }
      );
    }

    // Per al mode individual, validar que les generacions existeixen i pertanyen al projecte
    let generations: { id: string; status: string; }[] | null = null;
    let generationsError: any = null;

    if (process.env.NODE_ENV === 'development' && internalTestHeader === process.env.WORKER_SECRET_TOKEN) {
      const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data, error } = await serviceClient.from('generations').select('id, status').in('id', generationIds).eq('project_id', projectId);
      generations = data;
      generationsError = error;
    } else {
      const { data, error } = await supabase.from('generations').select('id, status').in('id', generationIds).eq('project_id', projectId);
      generations = data;
      generationsError = error;
    }

    if (generationsError || !generations || generations.length !== generationIds.length) {
      console.error(`❌ [API-Trigger] Generacions no trobades:`, generationsError);
      return NextResponse.json(
        { success: false, error: 'Una o més generacions no trobades' },
        { status: 404 }
      );
    }

    // Comprovar que les generacions no estiguin ja en procés
    const processingGenerations = generations.filter(g => g.status === 'processing');
    if (processingGenerations.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `${processingGenerations.length} generacions ja estan en procés`,
          processingIds: processingGenerations.map(g => g.id)
        },
        { status: 409 }
      );
    }

    console.log(`🚀 [API-Trigger] Iniciant ${generationIds.length} tasques asíncrones`);

    // Marcar generacions com a 'processing' inicialment
    const { error: updateError } = await supabase
      .from('generations')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString(),
        error_message: null
      })
      .in('id', generationIds);

    if (updateError) {
      console.error(`❌ [API-Trigger] Error actualitzant estat:`, updateError);
      return NextResponse.json(
        { success: false, error: 'Error actualitzant estat de les generacions' },
        { status: 500 }
      );
    }

    // Obtenir URL base per al worker
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    const workerUrl = `${baseUrl}/api/worker/generation-processor`;

    console.log(`🔧 [API-Trigger] Invocant worker a: ${workerUrl}`);

    // Disparar workers per a cada generació (sense esperar)
    const workerPromises = generationIds.map(async (generationId: string) => {
      try {
        console.log(`🔧 [API-Trigger] Disparant worker per generació ${generationId}`);
        
        // Crida asíncrona al worker (fire-and-forget)
        fetch(workerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.WORKER_SECRET_TOKEN}`
          },
          body: JSON.stringify({
            projectId,
            generationId,
            userId: user.id
          })
        }).catch(error => {
          console.error(`❌ [API-Trigger] Error disparant worker per ${generationId}:`, error);
        });

        return { generationId, dispatched: true };
      } catch (error) {
        console.error(`❌ [API-Trigger] Error preparant worker per ${generationId}:`, error);
        return { generationId, dispatched: false, error: error instanceof Error ? error.message : 'Error desconegut' };
      }
    });

    // Esperar que es disparin tots els workers (però no que completin)
    const dispatchResults = await Promise.all(workerPromises);
    const successfulDispatches = dispatchResults.filter(r => r.dispatched);
    const failedDispatches = dispatchResults.filter(r => !r.dispatched);

    if (failedDispatches.length > 0) {
      console.error(`❌ [API-Trigger] ${failedDispatches.length} workers no s'han pogut disparar`);
      
      // Revertir estat de les generacions que han fallat
      const failedIds = failedDispatches.map(f => f.generationId);
      await supabase
        .from('generations')
        .update({ 
          status: 'error',
          error_message: 'Error iniciant el processament',
          updated_at: new Date().toISOString()
        })
        .in('id', failedIds);
    }

    const totalTime = Date.now() - startTime;

    console.log(`✅ [API-Trigger] ${successfulDispatches.length} tasques iniciades correctament en ${totalTime}ms`);

    // Resposta immediata
    return NextResponse.json({
      success: true,
      mode: 'individual',
      tasksStarted: successfulDispatches.length,
      tasksFailed: failedDispatches.length,
      generationIds: successfulDispatches.map(r => r.generationId),
      failedGenerationIds: failedDispatches.map(r => r.generationId),
      dispatchTimeMs: totalTime,
      message: `${successfulDispatches.length} tasques iniciades en segon pla`,
      pollingAdvice: 'Utilitza GET /api/reports/generations per consultar l\'estat'
    }, { status: 202 }); // 202 Accepted

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
