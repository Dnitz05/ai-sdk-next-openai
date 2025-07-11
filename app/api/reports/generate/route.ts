import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * POST /api/reports/generate
 * Crea un job de generació individual per a una 'generation' específica.
 * Aquest endpoint utilitza SSR amb RLS per màxima seguretat.
 */
export async function POST(request: NextRequest) {
  console.log("[API reports/generate] Rebuda petició POST per crear un job individual amb SSR...");

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
      console.error("[API reports/generate] Error d'autenticació SSR:", authError);
      return NextResponse.json({ 
        error: 'Usuari no autenticat',
        details: authError?.message 
      }, { status: 401 });
    }
    
    const userId = user.id;
    console.log("[API reports/generate] Usuari autenticat via SSR:", userId);

    // 3. Obtenir i validar dades de la petició
    const { generation_id } = await request.json();

    if (!generation_id) {
      return NextResponse.json({ 
        error: 'generation_id és obligatori.' 
      }, { status: 400 });
    }

    console.log(`[API reports/generate] Processant generation_id: ${generation_id}`);

    // 4. Obtenir dades de la generació amb RLS automàtic
    // RLS assegurarà que només s'accedeix a generacions de l'usuari actual
    const { data: generation, error: generationError } = await supabase
      .from('generations')
      .select(`
        *,
        projects!inner(
          user_id,
          template:plantilla_configs!inner(
            id,
            ai_instructions,
            docx_storage_path
          )
        )
      `)
      .eq('id', generation_id)
      .single();

    if (generationError || !generation) {
      console.error("[API reports/generate] Error obtenint generació:", generationError);
      return NextResponse.json({ 
        error: 'Generació no trobada o no autoritzada',
        details: generationError?.message 
      }, { status: 404 });
    }

    console.log(`[API reports/generate] Generació trobada: ${generation.id}`);

    const project = generation.projects;
    const template = project.template;

    if (!template) {
      console.error("[API reports/generate] Plantilla no trobada per la generació");
      return NextResponse.json({ 
        error: 'La plantilla associada no s\'ha trobat.' 
      }, { status: 404 });
    }

    // 5. Validar configuració de la plantilla
    const totalPlaceholders = template.ai_instructions?.length || 0;
    if (totalPlaceholders === 0) {
      console.error("[API reports/generate] Plantilla sense prompts configurats");
      return NextResponse.json({ 
        error: 'La plantilla no conté cap prompt/placeholder configurat.' 
      }, { status: 400 });
    }

    console.log(`[API reports/generate] Plantilla vàlida amb ${totalPlaceholders} placeholders`);

    // 6. Preparar el job per a aquesta única generació
    const jobToCreate = {
      generation_id: generation.id,
      user_id: userId, // Utilitzem userId del context SSR
      status: 'pending' as const,
      progress: 0,
      total_placeholders: totalPlaceholders,
      completed_placeholders: 0,
      job_config: {
        project_id: generation.project_id,
        template_id: template.id,
        template_document_path: template.docx_storage_path,
        prompts: template.ai_instructions || [],
        excel_data: [generation.row_data] // Important: passem només la fila d'aquesta generació
      }
    };

    console.log(`[API reports/generate] Creant job per la generació ${generation.id}...`);

    // 7. Inserir el nou job amb RLS automàtic
    const { data: createdJob, error: jobError } = await supabase
      .from('generation_jobs')
      .insert(jobToCreate)
      .select()
      .single();

    if (jobError) {
      console.error('[API reports/generate] Error creant el job individual:', jobError);
      return NextResponse.json({ 
        error: 'Error creant el job de generació',
        details: jobError.message 
      }, { status: 500 });
    }

    console.log(`✅ [API reports/generate] Job individual ${createdJob.id} creat per a la generació ${generation.id}`);

    // 8. Actualitzar l'estat de la generació a 'processing' amb RLS automàtic
    const { error: updateError } = await supabase
      .from('generations')
      .update({ status: 'processing' })
      .eq('id', generation_id); // RLS assegura que només s'actualitza si pertany a l'usuari

    if (updateError) {
      console.error('[API reports/generate] Error actualitzant estat de generació:', updateError);
      // No fallem completament, el job ja està creat
      console.warn('[API reports/generate] Job creat però estat de generació no actualitzat');
    } else {
      console.log(`[API reports/generate] Estat de generació ${generation_id} actualitzat a 'processing'`);
    }

    return NextResponse.json({
      success: true,
      message: 'Job de generació individual creat correctament.',
      job: {
        id: createdJob.id,
        generation_id: createdJob.generation_id,
        status: createdJob.status,
        progress: createdJob.progress,
        total_placeholders: createdJob.total_placeholders
      }
    }, { status: 201 });

  } catch (error) {
    console.error("[API reports/generate] Error general:", error);
    return NextResponse.json({
      error: 'Error intern del servidor',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
