import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/serverClient';
import { createClient } from '@supabase/supabase-js';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';
import { Generation, GeneratedContent } from '@/app/types';

/**
 * GET /api/reports/generations?project_id=[id]&generationId=[id]
 * Retorna l'estat de tots els informes o d'una generació específica
 */
export async function GET(request: NextRequest) {
  console.log("[API reports/generations] Rebuda petició GET");
  
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('project_id');
    const generationId = url.searchParams.get('generationId'); // Per polling asíncron
    
    if (!projectId && !generationId) {
      return NextResponse.json({ error: 'project_id o generationId és obligatori.' }, { status: 400 });
    }
    
    // Autenticació de l'usuari: primer via header Authorization (Bearer), després cookies
    let userId: string | null = null;
    let userError: any = null;
    
    const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const accessToken = authHeader.slice(7).trim();
      try {
        const userClient = createUserSupabaseClient(accessToken);
        const { data: userDataAuth, error: authError } = await userClient.auth.getUser();
        if (!authError && userDataAuth.user) {
          userId = userDataAuth.user.id;
        } else {
          userError = authError;
        }
      } catch (e) {
        userError = e;
      }
    }
    
    if (!userId) {
      const supabaseServer = await createServerSupabaseClient();
      const { data: userDataAuth2, error: serverError } = await supabaseServer.auth.getUser();
      if (!serverError && userDataAuth2.user) {
        userId = userDataAuth2.user.id;
      } else {
        userError = serverError;
      }
    }
    
    if (!userId) {
      console.error("[API reports/generations] Error obtenint informació de l'usuari:", userError);
      return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 });
    }
    
    console.log("[API reports/generations] Usuari autenticat:", userId);
    
    // Client amb service role key per bypassejar RLS (només després de verificar l'usuari)
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    
    // Si es consulta una generació específica (polling asíncron)
    if (generationId) {
      console.log(`[API reports/generations] Consultant generació específica: ${generationId}`);
      
      const internalTestHeader = request.headers.get('X-Internal-Test-Auth');
      
      const { data: generation, error: generationError } = await serviceClient
        .from('generations')
        .select('*, projects(id, user_id, project_name, excel_filename)')
        .eq('id', generationId)
        .single();

      // Fora del mode de test, verifiquem la propietat
      if (process.env.NODE_ENV !== 'development' || internalTestHeader !== process.env.WORKER_SECRET_TOKEN) {
        if (generation && generation.projects.user_id !== userId) {
          return NextResponse.json({ error: 'Generació no trobada o sense permisos d\'accés.' }, { status: 404 });
        }
      }
      
      if (generationError || !generation) {
        console.error(`[API reports/generations] Generació ${generationId} no trobada o sense permisos:`, generationError);
        return NextResponse.json({ 
          error: 'Generació no trobada o sense permisos d\'accés.' 
        }, { status: 404 });
      }
      
      // Retornar només aquesta generació amb format consistent
      const generationWithDetails = {
        id: generation.id,
        excel_row_index: generation.excel_row_index,
        row_data: generation.row_data,
        status: generation.status,
        error_message: generation.error_message,
        retry_count: generation.retry_count || 0,
        created_at: generation.created_at,
        updated_at: generation.updated_at,
        generated_content: [],
        content_stats: {
          total_placeholders: 5,
          completed_placeholders: generation.status === 'generated' ? 5 : 0,
          refined_placeholders: generation.status === 'generated' ? 5 : 0,
          completion_percentage: generation.status === 'generated' ? 100 : 0
        }
      };
      
      console.log(`[API reports/generations] ✅ Retornant generació específica ${generationId} amb estat: ${generation.status}`);
      
      return NextResponse.json({
        project: {
          id: (generation as any).projects.id,
          name: (generation as any).projects.project_name,
          excel_filename: (generation as any).projects.excel_filename
        },
        generation: generationWithDetails,
        pollingMode: true
      }, { status: 200 });
    }
    
    // Consulta de totes les generacions d'un projecte (comportament original)
    if (!projectId) {
      return NextResponse.json({ error: 'project_id és obligatori per consultar totes les generacions.' }, { status: 400 });
    }
    
    // Verificar que el projecte pertany a l'usuari
    const { data: project, error: projectError } = await serviceClient
      .from('projects')
      .select('id, user_id, project_name, excel_filename')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();
    
    if (projectError || !project) {
      console.error("[API reports/generations] Projecte no trobat o sense permisos:", projectError);
      return NextResponse.json({ 
        error: 'Projecte no trobat o sense permisos d\'accés.' 
      }, { status: 404 });
    }
    
    // Primer intentar obtenir generacions del sistema tradicional
    let generations: any[] = [];
    let generationsError: any = null;
    
    const { data: traditionalGenerations, error: traditionalError } = await serviceClient
      .from('generations')
      .select('*')
      .eq('project_id', projectId)
      .order('excel_row_index', { ascending: true });
    
    if (!traditionalError && traditionalGenerations && traditionalGenerations.length > 0) {
      generations = traditionalGenerations;
      console.log(`[API reports/generations] Trobades ${generations.length} generacions del sistema tradicional`);
    } else {
      // Si no hi ha generacions tradicionals, intentar obtenir del sistema SMART
      const { data: smartGenerations, error: smartError } = await serviceClient
        .from('smart_generations')
        .select('*')
        .eq('template_id', project.id) // Assumim que template_id correspon al project_id
        .order('created_at', { ascending: true });
      
      if (!smartError && smartGenerations && smartGenerations.length > 0) {
        // Convertir format SMART a format tradicional per compatibilitat
        generations = smartGenerations.map((smartGen: any, index: number) => ({
          id: smartGen.id,
          excel_row_index: index,
          row_data: smartGen.excel_data?.[0] || {}, // Primer element de l'array
          status: smartGen.status,
          error_message: smartGen.error_message,
          retry_count: 0,
          created_at: smartGen.created_at,
          updated_at: smartGen.completed_at || smartGen.created_at,
          project_id: projectId
        }));
        console.log(`[API reports/generations] Convertides ${generations.length} generacions del sistema SMART`);
      } else {
        generationsError = traditionalError || smartError;
        console.log(`[API reports/generations] No s'han trobat generacions en cap sistema`);
      }
    }
    
    if (generationsError && generations.length === 0) {
      console.error("[API reports/generations] Error obtenint generacions:", generationsError);
      return NextResponse.json({ 
        error: 'Error obtenint generacions.',
        details: generationsError?.message || 'No s\'han trobat generacions'
      }, { status: 500 });
    }
    
    // Processar dades per estructurar millor la resposta (sense generated_content obsolet)
    const generationsWithDetails = generations.map((generation: any) => {
      // Per al sistema tradicional, simular estadístiques ja que generated_content ha estat eliminat
      const mockStats = {
        total_placeholders: 5, // Valor per defecte
        completed_placeholders: generation.status === 'completed' ? 5 : generation.status === 'generated' ? 3 : 0,
        refined_placeholders: generation.status === 'completed' ? 5 : 0,
        completion_percentage: generation.status === 'completed' ? 100 : generation.status === 'generated' ? 60 : 0
      };
      
      return {
        id: generation.id,
        excel_row_index: generation.excel_row_index,
        row_data: generation.row_data,
        status: generation.status,
        error_message: generation.error_message,
        retry_count: generation.retry_count || 0,
        created_at: generation.created_at,
        updated_at: generation.updated_at,
        generated_content: [], // Array buit ja que la taula ha estat eliminada
        content_stats: mockStats
      };
    });
    
    console.log(`[API reports/generations] ✅ Retornant ${generationsWithDetails.length} generacions per al projecte ${projectId}`);
    
    return NextResponse.json({
      project: {
        id: project.id,
        name: project.project_name,
        excel_filename: project.excel_filename
      },
      generations: generationsWithDetails
    }, { status: 200 });
    
  } catch (err) {
    console.error("[API reports/generations] Error general:", err);
    return NextResponse.json(
      { error: 'Error intern del servidor.', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/reports/generations
 * Actualitza l'estat d'una generació específica
 */
export async function PUT(request: NextRequest) {
  console.log("[API reports/generations] Rebuda petició PUT");
  
  try {
    const { generation_id, status, error_message } = await request.json();
    
    // Validacions bàsiques
    if (!generation_id || !status) {
      return NextResponse.json({ error: 'generation_id i status són obligatoris.' }, { status: 400 });
    }
    
    // Validar status vàlid
    const validStatuses = ['pending', 'generated', 'reviewed', 'completed', 'error'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Status no vàlid.' }, { status: 400 });
    }
    
    // Autenticació de l'usuari
    let userId: string | null = null;
    let userError: any = null;
    
    const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const accessToken = authHeader.slice(7).trim();
      try {
        const userClient = createUserSupabaseClient(accessToken);
        const { data: userDataAuth, error: authError } = await userClient.auth.getUser();
        if (!authError && userDataAuth.user) {
          userId = userDataAuth.user.id;
        } else {
          userError = authError;
        }
      } catch (e) {
        userError = e;
      }
    }
    
    if (!userId) {
      const supabaseServer = await createServerSupabaseClient();
      const { data: userDataAuth2, error: serverError } = await supabaseServer.auth.getUser();
      if (!serverError && userDataAuth2.user) {
        userId = userDataAuth2.user.id;
      } else {
        userError = serverError;
      }
    }
    
    if (!userId) {
      console.error("[API reports/generations] Error obtenint informació de l'usuari:", userError);
      return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 });
    }
    
    // Client amb service role key
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    
    // Verificar que la generació pertany a l'usuari
    const { data: generationCheck, error: checkError } = await serviceClient
      .from('generations')
      .select(`
        id,
        project_id,
        projects!inner(user_id)
      `)
      .eq('id', generation_id)
      .single();
    
    if (checkError || !generationCheck || (generationCheck as any).projects.user_id !== userId) {
      console.error("[API reports/generations] Generació no trobada o sense permisos:", checkError);
      return NextResponse.json({ 
        error: 'Generació no trobada o sense permisos d\'accés.' 
      }, { status: 404 });
    }
    
    // Actualitzar la generació
    const updateData: any = {
      status: status
    };
    
    if (error_message !== undefined) {
      updateData.error_message = error_message;
    }
    
    // Si és un error, primer obtenim el retry_count actual i l'incrementem
    if (status === 'error') {
      const { data: currentGeneration } = await serviceClient
        .from('generations')
        .select('retry_count')
        .eq('id', generation_id)
        .single();
      
      updateData.retry_count = (currentGeneration?.retry_count || 0) + 1;
    }
    
    const { data: updatedGeneration, error: updateError } = await serviceClient
      .from('generations')
      .update(updateData)
      .eq('id', generation_id)
      .select()
      .single();
    
    if (updateError) {
      console.error("[API reports/generations] Error actualitzant generació:", updateError);
      return NextResponse.json({ 
        error: 'Error actualitzant generació.',
        details: updateError.message 
      }, { status: 500 });
    }
    
    console.log(`[API reports/generations] ✅ Generació ${generation_id} actualitzada a status: ${status}`);
    
    return NextResponse.json({
      message: 'Generació actualitzada correctament!',
      generation: updatedGeneration
    }, { status: 200 });
    
  } catch (err) {
    console.error("[API reports/generations] Error general:", err);
    return NextResponse.json(
      { error: 'Error intern del servidor.', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
