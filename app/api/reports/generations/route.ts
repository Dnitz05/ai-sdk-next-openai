import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/serverClient';
import { createClient } from '@supabase/supabase-js';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';
import { Generation, GeneratedContent } from '@/app/types';

/**
 * GET /api/reports/generations?project_id=[id]
 * Retorna l'estat de tots els informes (files Excel) per a un projecte específic
 */
export async function GET(request: NextRequest) {
  console.log("[API reports/generations] Rebuda petició GET");
  
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('project_id');
    
    if (!projectId) {
      return NextResponse.json({ error: 'project_id és obligatori.' }, { status: 400 });
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
    
    // Primer verificar que el projecte pertany a l'usuari
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
    
    // Obtenir generacions amb contingut relacionat
    const { data: generations, error: generationsError } = await serviceClient
      .from('generations')
      .select(`
        *,
        generated_content(
          id,
          placeholder_id,
          final_content,
          is_refined,
          created_at,
          updated_at
        )
      `)
      .eq('project_id', projectId)
      .order('excel_row_index', { ascending: true });
    
    if (generationsError) {
      console.error("[API reports/generations] Error obtenint generacions:", generationsError);
      return NextResponse.json({ 
        error: 'Error obtenint generacions.',
        details: generationsError.message 
      }, { status: 500 });
    }
    
    // Processar dades per estructurar millor la resposta
    const generationsWithDetails = generations.map((generation: any) => {
      const generatedContent: GeneratedContent[] = generation.generated_content || [];
      const totalPlaceholders = generatedContent.length;
      const completedPlaceholders = generatedContent.filter((content: GeneratedContent) => content.final_content && content.final_content.length > 0).length;
      const refinedPlaceholders = generatedContent.filter((content: GeneratedContent) => content.is_refined).length;
      
      return {
        id: generation.id,
        excel_row_index: generation.excel_row_index,
        row_data: generation.row_data,
        status: generation.status,
        error_message: generation.error_message,
        retry_count: generation.retry_count,
        created_at: generation.created_at,
        updated_at: generation.updated_at,
        generated_content: generatedContent,
        content_stats: {
          total_placeholders: totalPlaceholders,
          completed_placeholders: completedPlaceholders,
          refined_placeholders: refinedPlaceholders,
          completion_percentage: totalPlaceholders > 0 ? Math.round((completedPlaceholders / totalPlaceholders) * 100) : 0
        }
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
