import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/serverClient';
import { createClient } from '@supabase/supabase-js';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';
import { 
  CONTENT_GENERATION_PROMPT, 
  CONTENT_REFINEMENT_PROMPT, 
  MISTRAL_CONFIG,
  MISTRAL_CONFIG_FAST 
} from '@/lib/ai/system-prompts';

/**
 * POST /api/reports/generate
 * Genera contingut amb Mistral AI per a una generació específica
 */
export async function POST(request: NextRequest) {
  console.log("[API reports/generate] Rebuda petició POST");
  
  // Debug environment variables immediately
  const mistralKey = process.env.MISTRAL_API_KEY;
  console.log("[API reports/generate] MISTRAL_API_KEY check:", {
    exists: !!mistralKey,
    length: mistralKey?.length || 0,
    first_chars: mistralKey ? mistralKey.substring(0, 8) + '...' : 'NOT_FOUND',
    typeof: typeof mistralKey,
    all_mistral_keys: Object.keys(process.env).filter(k => k.includes('MISTRAL'))
  });
  
  try {
    const { generation_id, use_fast_model = false, specific_placeholders = null } = await request.json();
    
    // Validacions bàsiques
    if (!generation_id) {
      return NextResponse.json({ error: 'generation_id és obligatori.' }, { status: 400 });
    }
    
    // Verificar que tenim la clau de Mistral AI
    if (!process.env.MISTRAL_API_KEY) {
      console.error("[API reports/generate] MISTRAL_API_KEY no configurada");
      console.error("[API reports/generate] Environment debug:", {
        total_env_vars: Object.keys(process.env).length,
        node_env: process.env.NODE_ENV,
        has_supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        relevant_keys: Object.keys(process.env).filter(k => 
          k.includes('MISTRAL') || k.includes('NEXT_') || k.includes('SUPABASE')
        ).slice(0, 10)
      });
      return NextResponse.json({ error: 'Mistral AI no està configurat.' }, { status: 500 });
    }
    
    console.log("[API reports/generate] ✅ MISTRAL_API_KEY verified successfully");
    
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
      console.error("[API reports/generate] Error obtenint informació de l'usuari:", userError);
      return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 });
    }
    
    console.log("[API reports/generate] Usuari autenticat:", userId);
    
    // Client amb service role key
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    
    // Obtenir dades completes de la generació
    const { data: generation, error: generationError } = await serviceClient
      .from('generations')
      .select(`
        *,
        projects!inner(
          user_id,
          project_name,
          excel_data,
          template_id,
          plantilla_configs!inner(
            config_name,
            ai_instructions,
            paragraph_mappings
          )
        )
      `)
      .eq('id', generation_id)
      .single();
    
    if (generationError || !generation || (generation as any).projects.user_id !== userId) {
      console.error("[API reports/generate] Generació no trobada o sense permisos:", generationError);
      return NextResponse.json({ 
        error: 'Generació no trobada o sense permisos d\'accés.' 
      }, { status: 404 });
    }
    
    // Verificar que la generació està en estat pendent
    if (generation.status !== 'pending') {
      return NextResponse.json({ 
        error: `La generació ja està en estat: ${generation.status}` 
      }, { status: 400 });
    }
    
    console.log(`[API reports/generate] Processant generació ${generation_id} per fila Excel ${generation.excel_row_index}`);
    
    // Actualitzar estat a "processing"
    await serviceClient
      .from('generations')
      .update({ status: 'processing' })
      .eq('id', generation_id);
    
    // Obtenir les dades de la fila Excel específica
    const projectData = (generation as any).projects;
    const aiInstructions = projectData.plantilla_configs.ai_instructions || [];
    const paragraphMappings = projectData.plantilla_configs.paragraph_mappings || [];
    const rowData = generation.row_data || {};
    
    // Filtrar instruccions si s'especifiquen placeholders concrets
    let instructionsToProcess = aiInstructions;
    if (specific_placeholders && Array.isArray(specific_placeholders)) {
      instructionsToProcess = aiInstructions.filter((instruction: any) => 
        specific_placeholders.includes(instruction.paragraphId)
      );
    }
    
    console.log(`[API reports/generate] Processant ${instructionsToProcess.length} instruccions d'IA`);
    
    const results = [];
    let hasErrors = false;
    
    // Processar cada instrucció d'IA
    for (const instruction of instructionsToProcess) {
      try {
        console.log(`[API reports/generate] Processant placeholder: ${instruction.paragraphId}`);
        
        // Obtenir el mapping del paràgraf per accedir al text original
        const paragraphMapping = paragraphMappings.find((mapping: any) => 
          mapping.id === instruction.paragraphId
        );
        
        const originalText = paragraphMapping?.text || instruction.originalParagraphText || '';
        
        // Construir el prompt per Mistral AI
        const mistralPrompt = CONTENT_GENERATION_PROMPT(
          instruction.prompt,
          rowData,
          instruction.useExistingText ? originalText : undefined
        );
        
        // Configuració del model (ràpid o normal)
        const modelConfig = use_fast_model ? MISTRAL_CONFIG_FAST : MISTRAL_CONFIG;
        
        // Crida a Mistral AI
        const mistralResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
          },
          body: JSON.stringify({
            model: modelConfig.model,
            messages: [
              {
                role: 'user',
                content: mistralPrompt
              }
            ],
            temperature: modelConfig.temperature,
            max_tokens: modelConfig.max_tokens,
            top_p: modelConfig.top_p
          })
        });
        
        if (!mistralResponse.ok) {
          const errorText = await mistralResponse.text();
          console.error(`[API reports/generate] Error de Mistral AI per ${instruction.paragraphId}:`, errorText);
          hasErrors = true;
          results.push({
            placeholder_id: instruction.paragraphId,
            success: false,
            error: `Error de Mistral AI: ${mistralResponse.status} - ${errorText}`
          });
          continue;
        }
        
        const mistralData = await mistralResponse.json();
        const generatedContent = mistralData.choices?.[0]?.message?.content;
        
        if (!generatedContent) {
          console.error(`[API reports/generate] Contingut buit de Mistral AI per ${instruction.paragraphId}`);
          hasErrors = true;
          results.push({
            placeholder_id: instruction.paragraphId,
            success: false,
            error: 'Mistral AI ha retornat contingut buit'
          });
          continue;
        }
        
        // Guardar el contingut generat a la base de dades
        const { data: savedContent, error: saveError } = await serviceClient
          .from('generated_content')
          .upsert([{
            generation_id: generation_id,
            placeholder_id: instruction.paragraphId,
            final_content: generatedContent.trim(),
            is_refined: false
          }], {
            onConflict: 'generation_id,placeholder_id'
          })
          .select()
          .single();
        
        if (saveError) {
          console.error(`[API reports/generate] Error guardant contingut per ${instruction.paragraphId}:`, saveError);
          hasErrors = true;
          results.push({
            placeholder_id: instruction.paragraphId,
            success: false,
            error: `Error guardant: ${saveError.message}`
          });
          continue;
        }
        
        console.log(`[API reports/generate] ✅ Contingut generat i guardat per ${instruction.paragraphId}`);
        results.push({
          placeholder_id: instruction.paragraphId,
          success: true,
          content_id: savedContent.id,
          content_length: generatedContent.length
        });
        
      } catch (err) {
        console.error(`[API reports/generate] Error processant ${instruction.paragraphId}:`, err);
        hasErrors = true;
        results.push({
          placeholder_id: instruction.paragraphId,
          success: false,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
    
    // Actualitzar l'estat final de la generació
    const finalStatus = hasErrors ? 'error' : 'generated';
    const errorMessage = hasErrors ? 
      `Errors en ${results.filter(r => !r.success).length} de ${results.length} placeholders` : 
      null;
    
    await serviceClient
      .from('generations')
      .update({ 
        status: finalStatus,
        error_message: errorMessage
      })
      .eq('id', generation_id);
    
    const successCount = results.filter(r => r.success).length;
    console.log(`[API reports/generate] ✅ Generació completada: ${successCount}/${results.length} placeholders processats correctament`);
    
    return NextResponse.json({
      message: 'Generació completada!',
      generation_id: generation_id,
      status: finalStatus,
      results: results,
      summary: {
        total: results.length,
        success: successCount,
        errors: results.length - successCount
      }
    }, { status: 200 });
    
  } catch (err) {
    console.error("[API reports/generate] Error general:", err);
    
    // Intentar actualitzar l'estat a error si tenim generation_id
    if (request.body) {
      try {
        const body = await request.json();
        if (body.generation_id) {
          const serviceClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } }
          );
          
          await serviceClient
            .from('generations')
            .update({ 
              status: 'error',
              error_message: err instanceof Error ? err.message : String(err)
            })
            .eq('id', body.generation_id);
        }
      } catch (updateErr) {
        console.error("[API reports/generate] Error actualitzant estat d'error:", updateErr);
      }
    }
    
    return NextResponse.json(
      { error: 'Error intern del servidor.', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/reports/generate
 * Refina contingut existent amb Mistral AI
 */
export async function PUT(request: NextRequest) {
  console.log("[API reports/generate] Rebuda petició PUT per refinament");
  
  try {
    const { content_id, refinement_instruction, use_fast_model = false } = await request.json();
    
    // Validacions bàsiques
    if (!content_id || !refinement_instruction) {
      return NextResponse.json({ error: 'content_id i refinement_instruction són obligatoris.' }, { status: 400 });
    }
    
    // Verificar que tenim la clau de Mistral AI
    if (!process.env.MISTRAL_API_KEY) {
      console.error("[API reports/generate] MISTRAL_API_KEY no configurada");
      return NextResponse.json({ error: 'Mistral AI no està configurat.' }, { status: 500 });
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
      console.error("[API reports/generate] Error obtenint informació de l'usuari:", userError);
      return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 });
    }
    
    // Client amb service role key
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    
    // Obtenir el contingut existent i verificar permisos
    const { data: content, error: contentError } = await serviceClient
      .from('generated_content')
      .select(`
        *,
        generations!inner(
          excel_row_index,
          row_data,
          projects!inner(
            user_id,
            excel_data
          )
        )
      `)
      .eq('id', content_id)
      .single();
    
    if (contentError || !content || (content as any).generations.projects.user_id !== userId) {
      console.error("[API reports/generate] Contingut no trobat o sense permisos:", contentError);
      return NextResponse.json({ 
        error: 'Contingut no trobat o sense permisos d\'accés.' 
      }, { status: 404 });
    }
    
    console.log(`[API reports/generate] Refinant contingut ${content_id} per placeholder ${content.placeholder_id}`);
    
    // Obtenir dades de la fila Excel per al context
    const generationData = (content as any).generations;
    const excelRowData = generationData.row_data || {};
    
    // Construir el prompt de refinament
    const mistralPrompt = CONTENT_REFINEMENT_PROMPT(
      content.final_content || '',
      refinement_instruction,
      excelRowData
    );
    
    // Configuració del model
    const modelConfig = use_fast_model ? MISTRAL_CONFIG_FAST : MISTRAL_CONFIG;
    
    // Crida a Mistral AI
    const mistralResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: modelConfig.model,
        messages: [
          {
            role: 'user',
            content: mistralPrompt
          }
        ],
        temperature: modelConfig.temperature,
        max_tokens: modelConfig.max_tokens,
        top_p: modelConfig.top_p
      })
    });
    
    if (!mistralResponse.ok) {
      const errorText = await mistralResponse.text();
      console.error(`[API reports/generate] Error de Mistral AI en refinament:`, errorText);
      return NextResponse.json({ 
        error: `Error de Mistral AI: ${mistralResponse.status} - ${errorText}` 
      }, { status: 500 });
    }
    
    const mistralData = await mistralResponse.json();
    const refinedContent = mistralData.choices?.[0]?.message?.content;
    
    if (!refinedContent) {
      console.error(`[API reports/generate] Contingut refinat buit de Mistral AI`);
      return NextResponse.json({ 
        error: 'Mistral AI ha retornat contingut refinat buit' 
      }, { status: 500 });
    }
    
    // Actualitzar el contingut amb la versió refinada
    const { data: updatedContent, error: updateError } = await serviceClient
      .from('generated_content')
      .update({
        final_content: refinedContent.trim(),
        is_refined: true
      })
      .eq('id', content_id)
      .select()
      .single();
    
    if (updateError) {
      console.error(`[API reports/generate] Error actualitzant contingut refinat:`, updateError);
      return NextResponse.json({ 
        error: 'Error guardant contingut refinat.',
        details: updateError.message 
      }, { status: 500 });
    }
    
    console.log(`[API reports/generate] ✅ Contingut ${content_id} refinat correctament`);
    
    return NextResponse.json({
      message: 'Contingut refinat correctament!',
      content: updatedContent,
      changes: {
        original_length: content.final_content?.length || 0,
        refined_length: refinedContent.length,
        was_refined: !content.is_refined // indica si és el primer refinament
      }
    }, { status: 200 });
    
  } catch (err) {
    console.error("[API reports/generate] Error general en refinament:", err);
    return NextResponse.json(
      { error: 'Error intern del servidor.', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
