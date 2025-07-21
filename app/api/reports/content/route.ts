import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { GeneratedContent } from '@/app/types';

/**
 * GET /api/reports/content?generation_id=[id]
 * Retorna tot el contingut generat per una generació específica
 * Aquest endpoint utilitza SSR amb RLS per màxima seguretat.
 * NOTA: Adaptat per funcionar només amb el sistema SMART (no més generated_content)
 */
export async function GET(request: NextRequest) {
  console.log("[API reports/content] Rebuda petició GET amb SSR (només SMART)...");
  
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
    
    // 5. Obtenir contingut (només per a generacions SMART)
    let content: GeneratedContent[] = [];

    const isSmartGeneration = generationCheck.row_data && (generationCheck.row_data as any).smart_generation_id;

    if (!isSmartGeneration) {
      console.warn(`[API reports/content] Aquesta generació (${generationId}) no és de tipus SMART. El sistema tradicional ha estat eliminat.`);
      // Retornar contingut buit per a generacions antigues no-smart
      return NextResponse.json({
        generation: {
          id: generationCheck.id,
          excel_row_index: generationCheck.excel_row_index,
          row_data: generationCheck.row_data,
          status: generationCheck.status,
          project_name: (generationCheck as any).projects.project_name,
          template_name: (generationCheck as any).projects.plantilla_configs.config_name
        },
        content: [],
        ai_instructions: (generationCheck as any).projects.plantilla_configs.ai_instructions || [],
        message: "Aquesta generació utilitzava el sistema tradicional que ha estat eliminat. Només les generacions SMART són suportades."
      }, { status: 200 });
    }

    console.log(`[API reports/content] És una generació SMART. Obtenint dades de 'smart_generations'...`);
    
    const smartGenerationId = (generationCheck.row_data as any).smart_generation_id;
    const documentIndex = generationCheck.excel_row_index;

    const { data: smartGeneration, error: smartError } = await supabase
      .from('smart_generations')
      .select('generated_documents, created_at, completed_at')
      .eq('id', smartGenerationId)
      .single();

    if (smartError || !smartGeneration) {
      console.error("[API reports/content] Error obtenint dades de smart_generations:", smartError);
      return NextResponse.json({ 
        error: 'Error obtenint dades de la generació intel·ligent.',
        details: smartError?.message 
      }, { status: 500 });
    }

    const smartDocument = (smartGeneration.generated_documents as any[])?.find(doc => doc.documentIndex === documentIndex);

    if (smartDocument && smartDocument.placeholderValues) {
      const placeholderValues = smartDocument.placeholderValues as Record<string, string>;
      const aiInstructions = (generationCheck as any).projects.plantilla_configs.ai_instructions || [];
      const aiInstructionsMap = new Map(aiInstructions.map((inst: any) => [inst.placeholder_id, inst.instruction]));

      content = Object.entries(placeholderValues).map(([key, value], i) => ({
        id: `${generationId}-${i}`, // ID sintètic
        generation_id: generationId,
        placeholder_id: key,
        original_text: null,
        generated_text: value,
        final_content: value,
        status: 'generated',
        is_refined: false,
        error_message: null,
        created_at: smartGeneration.created_at,
        updated_at: smartGeneration.completed_at || smartGeneration.created_at,
        ai_instructions: aiInstructionsMap.get(key) || null,
      }));
    } else {
      console.warn(`[API reports/content] No s'ha trobat el document amb index ${documentIndex} a la generació smart ${smartGenerationId}`);
    }
    
    console.log(`[API reports/content] ✅ Retornant ${content.length} elements de contingut per a la generació ${generationId}`);
    
    return NextResponse.json({
      generation: {
        id: generationCheck.id,
        excel_row_index: generationCheck.excel_row_index,
        row_data: generationCheck.row_data,
        status: generationCheck.status,
        project_name: (generationCheck as any).projects.project_name,
        template_name: (generationCheck as any).projects.plantilla_configs.config_name
      },
      content: content,
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
 * NOTA: Adaptat per funcionar amb el sistema SMART (actualitza smart_generations)
 */
export async function POST(request: NextRequest) {
  console.log("[API reports/content] Rebuda petició POST amb SSR (només SMART)...");
  
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

    console.log(`[API reports/content] Actualitzant contingut SMART per placeholder: ${placeholder_id}`);
    
    // 4. Verificar que la generació pertany a l'usuari i és SMART
    const { data: generationCheck, error: checkError } = await supabase
      .from('generations')
      .select(`
        id,
        excel_row_index,
        row_data,
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

    // 5. Verificar que és una generació SMART
    const isSmartGeneration = generationCheck.row_data && (generationCheck.row_data as any).smart_generation_id;
    if (!isSmartGeneration) {
      return NextResponse.json({ 
        error: 'Només es poden editar generacions del sistema SMART. El sistema tradicional ha estat eliminat.',
      }, { status: 400 });
    }

    const smartGenerationId = (generationCheck.row_data as any).smart_generation_id;
    const documentIndex = generationCheck.excel_row_index;

    console.log(`[API reports/content] Actualitzant generació SMART ${smartGenerationId}, document ${documentIndex}`);
    
    // 6. Obtenir dades actuals de smart_generations
    const { data: smartGeneration, error: smartError } = await supabase
      .from('smart_generations')
      .select('generated_documents')
      .eq('id', smartGenerationId)
      .single();

    if (smartError || !smartGeneration) {
      console.error("[API reports/content] Error obtenint smart_generation:", smartError);
      return NextResponse.json({ 
        error: 'Error obtenint dades de la generació intel·ligent.',
        details: smartError?.message 
      }, { status: 500 });
    }

    // 7. Actualitzar les dades del document
    const generatedDocuments = smartGeneration.generated_documents as any[] || [];
    const documentToUpdate = generatedDocuments.find(doc => doc.documentIndex === documentIndex);

    if (!documentToUpdate) {
      return NextResponse.json({ 
        error: `Document amb index ${documentIndex} no trobat a la generació SMART.`,
      }, { status: 404 });
    }

    // Actualitzar el placeholder específic
    if (!documentToUpdate.placeholderValues) {
      documentToUpdate.placeholderValues = {};
    }
    documentToUpdate.placeholderValues[placeholder_id] = final_content;
    
    // Marcar com refinat si s'especifica
    if (is_refined) {
      if (!documentToUpdate.refinedPlaceholders) {
        documentToUpdate.refinedPlaceholders = [];
      }
      if (!documentToUpdate.refinedPlaceholders.includes(placeholder_id)) {
        documentToUpdate.refinedPlaceholders.push(placeholder_id);
      }
    }

    // 8. Guardar les dades actualitzades
    const { data: updatedGeneration, error: updateError } = await supabase
      .from('smart_generations')
      .update({
        generated_documents: generatedDocuments
      })
      .eq('id', smartGenerationId)
      .select()
      .single();
    
    if (updateError) {
      console.error("[API reports/content] Error actualitzant smart_generation:", updateError);
      return NextResponse.json({ 
        error: 'Error actualitzant contingut de la generació intel·ligent.',
        details: updateError.message 
      }, { status: 500 });
    }
    
    console.log(`[API reports/content] ✅ Contingut SMART actualitzat per placeholder ${placeholder_id}`);
    
    // 9. Retornar resposta compatible
    const result = {
      id: `${generation_id}-${placeholder_id}`,
      generation_id: generation_id,
      placeholder_id: placeholder_id,
      final_content: final_content,
      is_refined: is_refined,
      updated_at: new Date().toISOString()
    };
    
    return NextResponse.json({
      message: 'Contingut SMART guardat correctament!',
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
 * NOTA: Adaptat per funcionar amb el sistema SMART
 */
export async function PUT(request: NextRequest) {
  console.log("[API reports/content] Rebuda petició PUT amb SSR (només SMART)...");
  
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

    // 4. Parsejar content_id sintètic (format: generation_id-placeholder_id o generation_id-index)
    const [generation_id, placeholderInfo] = content_id.split('-');
    
    if (!generation_id || !placeholderInfo) {
      return NextResponse.json({ 
        error: 'content_id té un format invàlid. Esperat: generation_id-placeholder_id' 
      }, { status: 400 });
    }

    console.log(`[API reports/content] Actualitzant contingut SMART per ID: ${content_id}`);
    
    // 5. Redirigir a POST amb els paràmetres correctes
    const postBody = {
      generation_id: generation_id,
      placeholder_id: placeholderInfo,
      final_content: final_content,
      is_refined: is_refined
    };

    console.log(`[API reports/content] Redirigint PUT a POST amb dades:`, postBody);
    
    // Crear una nova petició per POST
    const postRequest = new NextRequest(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(postBody)
    });

    // Copiar cookies
    request.cookies.getAll().forEach(cookie => {
      postRequest.cookies.set(cookie.name, cookie.value);
    });

    return await POST(postRequest);
    
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
