import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/serverClient';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/reports/generate
 * Crea un job de generació individual per a una 'generation' específica.
 * Aquest endpoint ara utilitza el sistema de jobs asíncrons.
 */
export async function POST(request: NextRequest) {
  console.log("[API reports/generate] Rebuda petició POST per crear un job individual");

  try {
    const { generation_id } = await request.json();

    if (!generation_id) {
      return NextResponse.json({ error: 'generation_id és obligatori.' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 });
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Obtenir dades de la generació, projecte i plantilla
    const { data: generation, error: generationError } = await serviceClient
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
      return NextResponse.json({ error: 'Generació no trobada o error en la consulta.' }, { status: 404 });
    }

    // Verificació de permisos
    if (generation.projects.user_id !== user.id) {
      return NextResponse.json({ error: 'No tens permís per accedir a aquesta generació.' }, { status: 403 });
    }
    
    const project = generation.projects;
    const template = project.template;

    if (!template) {
        return NextResponse.json({ error: 'La plantilla associada no s\'ha trobat.' }, { status: 404 });
    }

    // 2. Preparar el job per a aquesta única generació
    const totalPlaceholders = template.ai_instructions?.length || 0;
    if (totalPlaceholders === 0) {
      throw new Error('La plantilla no conté cap prompt/placeholder configurat.');
    }

    const jobToCreate = {
      generation_id: generation.id,
      user_id: user.id,
      // project_id: generation.project_id, // ELIMINAT: Aquesta columna no existeix a la taula generation_jobs
      status: 'pending' as const,
      progress: 0,
      total_placeholders: totalPlaceholders,
      completed_placeholders: 0,
      job_config: {
        project_id: generation.project_id, // Correcte: project_id dins de job_config
        template_id: template.id,
        template_document_path: template.docx_storage_path,
        prompts: template.ai_instructions || [],
        excel_data: [generation.row_data] // Important: passem només la fila d'aquesta generació
      }
      // created_at i updated_at seran gestionats per la BD per defecte
    };

    // 3. Inserir el nou job a la base de dades
    const { data: createdJob, error: jobError } = await serviceClient
      .from('generation_jobs')
      .insert(jobToCreate)
      .select()
      .single();

    if (jobError) {
      console.error('Error creant el job individual:', jobError);
      throw new Error(`Error creant el job: ${jobError.message}`);
    }

    console.log(`✅ Job individual ${createdJob.id} creat per a la generació ${generation.id}`);

    // 4. Actualitzar l'estat de la generació a 'processing'
    await serviceClient
      .from('generations')
      .update({ status: 'processing' })
      .eq('id', generation_id);

    return NextResponse.json({
      success: true,
      message: 'Job de generació individual creat correctament.',
      job: createdJob
    }, { status: 201 });

  } catch (err) {
    console.error("[API reports/generate] Error general:", err);
    return NextResponse.json(
      { error: 'Error intern del servidor.', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
