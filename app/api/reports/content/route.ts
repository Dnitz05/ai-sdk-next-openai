import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { GeneratedContent } from '@/app/types';

/**
 * GET /api/reports/content?generation_id=[id]
 * Retorna tot el contingut generat per una generació específica
 * Aquest endpoint utilitza SSR amb RLS per màxima seguretat.
 */
export async function GET(request: NextRequest) {
  console.log("[API reports/content] Rebuda petició GET amb SSR...");
  
  try {
    // 1. Crear client SSR per autenticació automàtica amb RLS
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

    // 2. Verificar autenticació SSR
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[API reports/content] Error d'autenticació SSR:", authError);
      return NextResponse.json({ 
        error: 'Usuari no autenticat',
        details: authError?.message 
      }, { status: 401 });
    }
    
    const userId = user.id;
    console.log("[API reports/content] Usuari autenticat via SSR:", userId);

    // 3. Obtenir paràmetres
    const url = new URL(request.url);
    const generationId = url.searchParams.get('generation_id');
    
    if (!generationId) {
      return NextResponse.json({ 
        error: 'generation_id és obligatori.' 
      }, { status: 400 });
    }

    console.log(`[API reports/content] Obtenint contingut per generació: ${generationId}`);
    
    // 4. Verificar que la generació pertany a l'usuari i obtenir dades amb RLS automàtic
    const { data: generationCheck, error: checkError } = await supabase
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
    
    if (checkError || !generationCheck) {
      console.error("[API reports/content] Generació no trobada o sense permisos:", checkError);
      return NextResponse.json({ 
        error: 'Generació no trobada o sense permisos d\'accés.',
        details: checkError?.message 
      }, { status: 404 });
    }

    console.log(`[API reports/content] Generació verificada: ${generationCheck.id}`);
    
    // 5. Obtenir tot el contingut generat amb RLS automàtic
    // RLS assegurarà que només s'obtenen continguts de generacions de l'usuari
    const { data: content, error: contentError } = await supabase
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

    // 6. Mapejar contingut per compatibilitat
    const mappedContent = content.map((c: any) => ({
      ...c,
      generated_text: c.final_content, // Mapejar final_content a generated_text per compatibilitat
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
      content: mappedContent,
      ai_instructions: (generationCheck as any).projects.plantilla_configs.ai_instructions || []
    }, { status: 200 });
    
  } catch (err) {
    console.error("[API reports/content] Error general:", err);
    return NextResponse.json(
      { 
        error: 'Error intern del servidor.', 
        details: err instanceof Error ? err.message : String(err) 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reports/content
 * Guarda contingut generat per la IA per a un placeholder específic
 * Aquest endpoint utilitza SSR amb RLS per màxima seguretat.
 */
export async function POST(request: NextRequest) {
  console.log("[API reports/content] Rebuda petició POST amb SSR...");
  
  try {
    // 1. Crear client SSR per autenticació automàtica amb RLS
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

    // 2. Verificar autenticació SSR
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[API reports/content] Error d'autenticació SSR:", authError);
      return NextResponse.json({ 
        error: 'Usuari no autenticat',
        details: authError?.message 
      }, { status: 401 });
    }
    
    const userId = user.id;
    console.log("[API reports/content] Usuari autenticat via SSR:", userId);

    // 3. Obtenir i validar dades de la petició
    const { generation_id, placeholder_id, final_content, is_refined = false } = await request.json();
    
    if (!generation_id || !placeholder_id || !final_content) {
      return NextResponse.json({ 
        error: 'generation_id, placeholder_id i final_content són obligatoris.' 
      }, { status: 400 });
    }

    console.log(`[API reports/content] Guardant contingut per placeholder: ${placeholder_id}`);
    
    // 4. Verificar que la generació pertany a l'usuari amb RLS automàtic
    const { data: generationCheck, error: checkError } = await supabase
      .from('generations')
      .select(`
        id,
        projects!inner(user_id)
      `)
      .eq('id', generation_id)
      .single();
    
    if (checkError || !generationCheck) {
      console.error("[API reports/content] Generació no trobada o sense permisos:", checkError);
      return NextResponse.json({ 
        error: 'Generació no trobada o sense permisos d\'accés.',
        details: checkError?.message 
      }, { status: 404 });
    }

    console.log(`[API reports/content] Generació verificada per POST: ${generationCheck.id}`);
    
    // 5. Comprovar si ja existeix contingut per aquest placeholder amb RLS automàtic
    const { data: existingContent, error: existingError } = await supabase
      .from('generated_content')
      .select('id')
      .eq('generation_id', generation_id)
      .eq('placeholder_id', placeholder_id)
      .single();
    
    let result;
    
    if (existingContent) {
      // 6a. Actualitzar contingut existent amb RLS automàtic
      const { data: updatedContent, error: updateError } = await supabase
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
      // 6b. Crear nou contingut amb RLS automàtic
      const { data: newContent, error: insertError } = await supabase
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
    console.error("[API reports/content] Error general en POST:", err);
    return NextResponse.json(
      { 
        error: 'Error intern del servidor.', 
        details: err instanceof Error ? err.message : String(err) 
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/reports/content
 * Actualitza contingut existent (per exemple, per refinament)
 * Aquest endpoint utilitza SSR amb RLS per màxima seguretat.
 */
export async function PUT(request: NextRequest) {
  console.log("[API reports/content] Rebuda petició PUT amb SSR...");
  
  try {
    // 1. Crear client SSR per autenticació automàtica amb RLS
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

    // 2. Verificar autenticació SSR
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[API reports/content] Error d'autenticació SSR:", authError);
      return NextResponse.json({ 
        error: 'Usuari no autenticat',
        details: authError?.message 
      }, { status: 401 });
    }
    
    const userId = user.id;
    console.log("[API reports/content] Usuari autenticat via SSR:", userId);

    // 3. Obtenir i validar dades de la petició
    const { content_id, final_content, is_refined } = await request.json();
    
    if (!content_id || !final_content) {
      return NextResponse.json({ 
        error: 'content_id i final_content són obligatoris.' 
      }, { status: 400 });
    }

    console.log(`[API reports/content] Actualitzant contingut: ${content_id}`);
    
    // 4. Verificar que el contingut pertany a l'usuari amb RLS automàtic
    const { data: contentCheck, error: checkError } = await supabase
      .from('generated_content')
      .select(`
        id,
        generations!inner(
          projects!inner(user_id)
        )
      `)
      .eq('id', content_id)
      .single();
    
    if (checkError || !contentCheck) {
      console.error("[API reports/content] Contingut no trobat o sense permisos:", checkError);
      return NextResponse.json({ 
        error: 'Contingut no trobat o sense permisos d\'accés.',
        details: checkError?.message 
      }, { status: 404 });
    }

    console.log(`[API reports/content] Contingut verificat per PUT: ${contentCheck.id}`);
    
    // 5. Preparar dades d'actualització
    const updateData: any = {
      final_content
    };
    
    if (is_refined !== undefined) {
      updateData.is_refined = is_refined;
    }
    
    // 6. Actualitzar el contingut amb RLS automàtic
    const { data: updatedContent, error: updateError } = await supabase
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
    
    console.log(`[API reports/content] ✅ Contingut ${content_id} actualitzat correctament`);
    
    return NextResponse.json({
      message: 'Contingut actualitzat correctament!',
      content: updatedContent
    }, { status: 200 });
    
  } catch (err) {
    console.error("[API reports/content] Error general en PUT:", err);
    return NextResponse.json(
      { 
        error: 'Error intern del servidor.', 
        details: err instanceof Error ? err.message : String(err) 
      },
      { status: 500 }
    );
  }
}
