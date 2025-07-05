// app/api/delete-project/[id]/route.ts
import { NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(request: Request) {
  // Extraiem l'id de la URL manualment segons la nova API de Next.js 15
  let id: string | undefined;
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    id = pathParts[pathParts.length - 1];
  } catch {
    id = undefined;
  }

  // 1. Llegeix el token de l'Authorization header
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autenticat. Falten credencials.' }, { status: 401 });
  }
  const accessToken = authHeader.replace('Bearer ', '').trim();

  try {
    if (!id) {
      return NextResponse.json({ error: 'ID de projecte no proporcionat' }, { status: 400 });
    }

    // 2. Crea el client Supabase autenticat amb el token de l'usuari
    const supabase = createUserSupabaseClient(accessToken);

    // 3. Verificar que el projecte existeix i pertany a l'usuari
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (projectError || !project) {
      console.error("Error obtenint projecte:", projectError);
      return NextResponse.json({
        error: 'Projecte no trobat',
        details: projectError?.message
      }, { status: 404 });
    }

    // 4. Client amb service role key per eliminar en cascada (després de verificar l'usuari)
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    console.log(`[DELETE PROJECT] Eliminant projecte ${id} i dades relacionades...`);

    // 5. Eliminar en ordre per evitar conflictes de claus foranes
    
    // 5.1. Primer obtenir els arxius generats per eliminar del Storage
    const { data: generationJobs, error: jobsQueryError } = await serviceClient
      .from('generation_jobs')
      .select('final_document_path')
      .eq('project_id', id);

    if (jobsQueryError) {
      console.warn("Error obtenint generation_jobs per eliminar arxius:", jobsQueryError);
    }

    // Recopilar arxius a eliminar del Storage
    const filesToDelete: string[] = [];
    if (generationJobs && generationJobs.length > 0) {
      generationJobs.forEach(job => {
        if (job.final_document_path) {
          filesToDelete.push(job.final_document_path);
          console.log(`[DELETE PROJECT] Arxiu generat a eliminar: ${job.final_document_path}`);
        }
      });
    }

    // Eliminar arxius del Storage si n'hi ha
    if (filesToDelete.length > 0) {
      console.log(`[DELETE PROJECT] Eliminant ${filesToDelete.length} arxius generats del Storage...`);
      
      const { error: storageError } = await serviceClient.storage
        .from('documents')
        .remove(filesToDelete);

      if (storageError) {
        console.error("Error eliminant arxius generats del Storage:", storageError);
        // No retornem error aquí per permetre continuar amb l'eliminació de la BD
        console.warn(`[DELETE PROJECT] Continuant malgrat error del Storage: ${storageError.message}`);
      } else {
        console.log(`[DELETE PROJECT] ✅ Arxius generats eliminats del Storage correctament`);
      }
    } else {
      console.log(`[DELETE PROJECT] No hi ha arxius generats per eliminar del Storage`);
    }

    // 5.2. Eliminar generation_jobs relacionats
    const { error: jobsError } = await serviceClient
      .from('generation_jobs')
      .delete()
      .eq('project_id', id);

    if (jobsError) {
      console.warn("Error eliminant generation_jobs:", jobsError);
      // No fallem completament, continuem amb la resta
    }

    // 5.3. Primer obtenir els IDs de les generacions
    const { data: generationIds, error: generationIdsError } = await serviceClient
      .from('generations')
      .select('id')
      .eq('project_id', id);

    if (generationIdsError) {
      console.warn("Error obtenint generation IDs:", generationIdsError);
    } else if (generationIds && generationIds.length > 0) {
      // 5.4. Eliminar generated_content relacionat
      const ids = generationIds.map(g => g.id);
      const { error: contentError } = await serviceClient
        .from('generated_content')
        .delete()
        .in('generation_id', ids);

      if (contentError) {
        console.warn("Error eliminant generated_content:", contentError);
        // No fallem completament, continuem amb la resta
      }
    }

    // 5.5. Eliminar generations relacionades
    const { error: generationsError } = await serviceClient
      .from('generations')
      .delete()
      .eq('project_id', id);

    if (generationsError) {
      console.warn("Error eliminant generations:", generationsError);
      // No fallem completament, continuem amb la resta
    }

    // 5.6. Finalment, eliminar el projecte principal
    const { error: deleteError } = await serviceClient
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', project.user_id); // Doble verificació de seguretat

    if (deleteError) {
      console.error("Error eliminant projecte:", deleteError);
      return NextResponse.json({
        error: 'Error eliminant projecte',
        details: deleteError.message
      }, { status: 500 });
    }

    console.log(`[DELETE PROJECT] ✅ Projecte ${id} eliminat correctament`);

    return NextResponse.json({ 
      success: true,
      message: 'Projecte eliminat correctament',
      deletedFiles: filesToDelete.length
    }, { status: 200 });

  } catch (error) {
    console.error("Error general a /api/delete-project/[id]:", error);
    return NextResponse.json({
      error: 'Error intern del servidor',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
