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
        { status: 409 }
      );
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
    const workerUrl = `${baseUrl}/api/worker/generation-processor`;

    console.log(`🔧 [API-Trigger] Invocant worker a: ${workerUrl}`);

    // Disparar worker (fire-and-forget)
    try {
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
        console.error(`❌ [API-Trigger] Error disparant worker:`, error);
      });

      const totalTime = Date.now() - startTime;
      console.log(`✅ [API-Trigger] Tasca iniciada correctament en ${totalTime}ms`);

      // Resposta immediata
      return NextResponse.json({
        success: true,
        generationId: generationId,
        message: 'Tasca iniciada en segon pla',
        dispatchTimeMs: totalTime,
        pollingAdvice: 'Utilitza GET /api/reports/generations per consultar l\'estat'
      }, { status: 202 }); // 202 Accepted

    } catch (error) {
      console.error(`❌ [API-Trigger] Error preparant worker:`, error);
      
      // Revertir estat de la generació
      await supabase
        .from('generations')
        .update({ 
          status: 'error',
          error_message: 'Error iniciant el processament',
          updated_at: new Date().toISOString()
        })
        .eq('id', generationId);

      return NextResponse.json(
        { success: false, error: 'Error iniciant la tasca' },
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
