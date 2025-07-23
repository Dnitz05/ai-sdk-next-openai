// app/api/delete-project/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function DELETE(request: NextRequest) {
  console.log("[API DELETE-PROJECT] Iniciant eliminació de projecte amb SSR...");
  
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
    console.error("[API DELETE-PROJECT] Error d'autenticació SSR:", authError);
    return NextResponse.json({ 
      error: 'Usuari no autenticat',
      details: authError?.message 
    }, { status: 401 });
  }
  
  const userId = user.id;
  console.log("[API DELETE-PROJECT] Usuari autenticat via SSR:", userId);

  // 3. Extraure ID del projecte de la URL
  let id: string | undefined;
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    id = pathParts[pathParts.length - 1];
  } catch {
    id = undefined;
  }

  try {
    if (!id) {
      return NextResponse.json({ error: 'ID de projecte no proporcionat' }, { status: 400 });
    }

    // 4. Verificar que el projecte existeix i pertany a l'usuari (RLS automàtic)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (projectError || !project) {
      console.error("[API DELETE-PROJECT] Error obtenint projecte:", projectError);
      return NextResponse.json({
        error: 'Projecte no trobat o no pertany a l\'usuari',
        details: projectError?.message
      }, { status: 404 });
    }

    console.log(`[API DELETE-PROJECT] Eliminant projecte ${id} i dades relacionades amb RLS...`);

    // 5. Eliminar en ordre per evitar conflictes de claus foranes
    // RLS assegura que només s'eliminen dades de l'usuari actual
    
    // 5.1. Primer obtenir els arxius generats per eliminar del Storage
    const { data: generationJobs, error: jobsQueryError } = await supabase
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
      
      const { error: storageError } = await supabase.storage
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

    // 5.2. Eliminar generation_jobs relacionats (RLS automàtic)
    const { error: jobsError } = await supabase
      .from('generation_jobs')
      .delete()
      .eq('project_id', id);

    if (jobsError) {
      console.warn("Error eliminant generation_jobs:", jobsError);
      // No fallem completament, continuem amb la resta
    }

    // 5.3. Primer obtenir els IDs de les generacions (RLS automàtic)
    const { data: generationIds, error: generationIdsError } = await supabase
      .from('generations')
      .select('id')
      .eq('project_id', id);

    if (generationIdsError) {
      console.warn("Error obtenint generation IDs:", generationIdsError);
    }
    // NOTA: generated_content eliminat durant migració al sistema SMART

    // 5.5. Eliminar generations relacionades (RLS automàtic)
    const { error: generationsError } = await supabase
      .from('generations')
      .delete()
      .eq('project_id', id);

    if (generationsError) {
      console.warn("Error eliminant generations:", generationsError);
      // No fallem completament, continuem amb la resta
    }

    // 5.6. Finalment, eliminar el projecte principal (RLS automàtic)
    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', id); // RLS assegura que només s'elimina si pertany a l'usuari

    if (deleteError) {
      console.error("Error eliminant projecte:", deleteError);
      return NextResponse.json({
        error: 'Error eliminant projecte',
        details: deleteError.message
      }, { status: 500 });
    }

    console.log(`[API DELETE-PROJECT] ✅ Projecte ${id} eliminat correctament amb RLS`);

    return NextResponse.json({ 
      success: true,
      message: 'Projecte eliminat correctament',
      deletedFiles: filesToDelete.length
    }, { status: 200 });

  } catch (error) {
    console.error("[API DELETE-PROJECT] Error general:", error);
    return NextResponse.json({
      error: 'Error intern del servidor',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
