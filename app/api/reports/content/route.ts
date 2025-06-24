import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/serverClient';
import { createClient } from '@supabase/supabase-js';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';
import { GeneratedContent } from '@/app/types';

/**
 * GET /api/reports/content?generation_id=[id]
 * Retorna tot el contingut generat per una generació específica
 */
export async function GET(request: NextRequest) {
  console.log("[API reports/content] Rebuda petició GET");
  
  try {
    const url = new URL(request.url);
    const generationId = url.searchParams.get('generation_id');
    
    if (!generationId) {
      return NextResponse.json({ error: 'generation_id és obligatori.' }, { status: 400 });
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
      console.error("[API reports/content] Error obtenint informació de l'usuari:", userError);
      return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 });
    }
    
    console.log("[API reports/content] Usuari autenticat:", userId);
    
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
        excel_row_index,
        row_data,
        status,
        projects!inner(
          user_id,
          project_name,
          template_id,
          plantilla_configs!inner(
            config_name,
            ai_instructions
          )
        )
      `)
      .eq('id', generationId)
      .single();
    
    if (checkError || !generationCheck || (generationCheck as any).projects.user_id !== userId) {
      console.error("[API reports/content] Generació no trobada o sense permisos:", checkError);
      return NextResponse.json({ 
        error: 'Generació no trobada o sense permisos d\'accés.' 
      }, { status: 404 });
    }
    
    // Obtenir tot el contingut generat
    const { data: content, error: contentError } = await serviceClient
      .from('generated_content')
      .select('*')
      .eq('generation_id', generationId)
      .order('created_at', { ascending: true });
    
    if (contentError) {
      console.error("[API reports/content] Error obtenint contingut:", contentError);
      return NextResponse.json({ 
        error: 'Error obtenint contingut.',
        details: contentError.message 
      }, { status: 500 });
    }
    
    console.log(`[API reports/content] ✅ Retornant ${content.length} elements de contingut per a la generació ${generationId}`);

    const mappedContent = content.map((c: any) => ({
      ...c,
      generated_text: c.final_content, // Mapejar final_content a generated_text
      // Opcional: eliminar final_content si no es vol duplicar i estalviar bytes
      // final_content: undefined, 
    }));
    
    return NextResponse.json({
      generation: {
        id: generationCheck.id,
        excel_row_index: generationCheck.excel_row_index,
        row_data: generationCheck.row_data,
        status: generationCheck.status,
        project_name: (generationCheck as any).projects.project_name,
        template_name: (generationCheck as any).projects.plantilla_configs.config_name
      },
      content: mappedContent, // Retornar el contingut mapejat
      ai_instructions: (generationCheck as any).projects.plantilla_configs.ai_instructions || []
    }, { status: 200 });
    
  } catch (err) {
    console.error("[API reports/content] Error general:", err);
    return NextResponse.json(
      { error: 'Error intern del servidor.', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reports/content
 * Guarda contingut generat per la IA per a un placeholder específic
 */
export async function POST(request: NextRequest) {
  console.log("[API reports/content] Rebuda petició POST");
  
  try {
    const { generation_id, placeholder_id, final_content, is_refined = false } = await request.json();
    
    // Validacions bàsiques
    if (!generation_id || !placeholder_id || !final_content) {
      return NextResponse.json({ error: 'generation_id, placeholder_id i final_content són obligatoris.' }, { status: 400 });
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
      console.error("[API reports/content] Error obtenint informació de l'usuari:", userError);
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
        projects!inner(user_id)
      `)
      .eq('id', generation_id)
      .single();
    
    if (checkError || !generationCheck || (generationCheck as any).projects.user_id !== userId) {
      console.error("[API reports/content] Generació no trobada o sense permisos:", checkError);
      return NextResponse.json({ 
        error: 'Generació no trobada o sense permisos d\'accés.' 
      }, { status: 404 });
    }
    
    // Comprovar si ja existeix contingut per aquest placeholder
    const { data: existingContent, error: existingError } = await serviceClient
      .from('generated_content')
      .select('id')
      .eq('generation_id', generation_id)
      .eq('placeholder_id', placeholder_id)
      .single();
    
    let result;
    if (existingContent) {
      // Actualitzar contingut existent
      const { data: updatedContent, error: updateError } = await serviceClient
        .from('generated_content')
        .update({
          final_content,
          is_refined
        })
        .eq('id', existingContent.id)
        .select()
        .single();
      
      if (updateError) {
        console.error("[API reports/content] Error actualitzant contingut:", updateError);
        return NextResponse.json({ 
          error: 'Error actualitzant contingut.',
          details: updateError.message 
        }, { status: 500 });
      }
      
      result = updatedContent;
      console.log(`[API reports/content] ✅ Contingut actualitzat per placeholder ${placeholder_id}`);
      
    } else {
      // Crear nou contingut
      const { data: newContent, error: insertError } = await serviceClient
        .from('generated_content')
        .insert([{
          generation_id,
          placeholder_id,
          final_content,
          is_refined
        }])
        .select()
        .single();
      
      if (insertError) {
        console.error("[API reports/content] Error creant contingut:", insertError);
        return NextResponse.json({ 
          error: 'Error creant contingut.',
          details: insertError.message 
        }, { status: 500 });
      }
      
      result = newContent;
      console.log(`[API reports/content] ✅ Nou contingut creat per placeholder ${placeholder_id}`);
    }
    
    return NextResponse.json({
      message: 'Contingut guardat correctament!',
      content: result
    }, { status: 200 });
    
  } catch (err) {
    console.error("[API reports/content] Error general:", err);
    return NextResponse.json(
      { error: 'Error intern del servidor.', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/reports/content
 * Actualitza contingut existent (per exemple, per refinament)
 */
export async function PUT(request: NextRequest) {
  console.log("[API reports/content] Rebuda petició PUT");
  
  try {
    const { content_id, final_content, is_refined } = await request.json();
    
    // Validacions bàsiques
    if (!content_id || !final_content) {
      return NextResponse.json({ error: 'content_id i final_content són obligatoris.' }, { status: 400 });
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
      console.error("[API reports/content] Error obtenint informació de l'usuari:", userError);
      return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 });
    }
    
    // Client amb service role key
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    
    // Verificar que el contingut pertany a l'usuari
    const { data: contentCheck, error: checkError } = await serviceClient
      .from('generated_content')
      .select(`
        id,
        generations!inner(
          projects!inner(user_id)
        )
      `)
      .eq('id', content_id)
      .single();
    
    if (checkError || !contentCheck || (contentCheck as any).generations.projects.user_id !== userId) {
      console.error("[API reports/content] Contingut no trobat o sense permisos:", checkError);
      return NextResponse.json({ 
        error: 'Contingut no trobat o sense permisos d\'accés.' 
      }, { status: 404 });
    }
    
    // Actualitzar el contingut
    const updateData: any = {
      final_content
    };
    
    if (is_refined !== undefined) {
      updateData.is_refined = is_refined;
    }
    
    const { data: updatedContent, error: updateError } = await serviceClient
      .from('generated_content')
      .update(updateData)
      .eq('id', content_id)
      .select()
      .single();
    
    if (updateError) {
      console.error("[API reports/content] Error actualitzant contingut:", updateError);
      return NextResponse.json({ 
        error: 'Error actualitzant contingut.',
        details: updateError.message 
      }, { status: 500 });
    }
    
    console.log(`[API reports/content] ✅ Contingut ${content_id} actualitzat`);
    
    return NextResponse.json({
      message: 'Contingut actualitzat correctament!',
      content: updatedContent
    }, { status: 200 });
    
  } catch (err) {
    console.error("[API reports/content] Error general:", err);
    return NextResponse.json(
      { error: 'Error intern del servidor.', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
