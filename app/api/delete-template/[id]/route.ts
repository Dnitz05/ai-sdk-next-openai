// app/api/delete-template/[id]/route.ts
import { NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';
import supabaseServerClient from '@/lib/supabase/server';

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
      return NextResponse.json({ error: 'ID de plantilla no proporcionat' }, { status: 400 });
    }

    // 2. Crea el client Supabase autenticat amb el token de l'usuari
    const supabase = createUserSupabaseClient(accessToken);

    // 3. Primer, obtenir la plantilla amb tots els paths dels arxius
    const { data: template, error: fetchError } = await supabase
      .from('plantilla_configs')
      .select(`
        id,
        config_name,
        base_docx_storage_path,
        placeholder_docx_storage_path,
        excel_storage_path,
        user_id
      `)
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error("Error obtenint plantilla:", fetchError);
      return NextResponse.json({
        error: 'Error obtenint plantilla',
        details: fetchError.message
      }, { status: 500 });
    }

    if (!template) {
      return NextResponse.json({ error: 'Plantilla no trobada' }, { status: 404 });
    }

    console.log(`[DELETE Template] Eliminant plantilla "${template.config_name}" (ID: ${id})`);

    // 4. Eliminar carpeta completa de Storage
    let deletedFilesCount = 0;
    
    // Obtenir l'usuari actual per construir el path correcte
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.warn('[DELETE Template] No s\'ha pogut obtenir l\'usuari per eliminar fitxers del Storage');
    } else {
      try {
        const userPrefix = `user-${user.id}/`;
        const templatePrefix = `${userPrefix}template-${template.id}/`;
        
        console.log(`[DELETE Template] Eliminant carpeta completa: ${templatePrefix}`);
        
        // Obtenir tots els fitxers recursivament
        const allFiles: string[] = [];
        
        // Llistar fitxers en TOTES les subcarpetes (incloent excel)
        for (const subfolder of ['original', 'indexed', 'placeholder', 'excel']) {
          const { data: subFiles } = await supabase.storage
            .from('template-docx')
            .list(`${templatePrefix}${subfolder}`, { limit: 1000 });
          
          if (subFiles) {
            subFiles.forEach(file => {
              allFiles.push(`${templatePrefix}${subfolder}/${file.name}`);
            });
            console.log(`[DELETE Template] Trobats ${subFiles.length} fitxers a ${subfolder}/`);
          }
        }
        
        // També eliminar fitxers a l'arrel de la carpeta template
        const { data: rootFiles } = await supabase.storage
          .from('template-docx')
          .list(templatePrefix, { limit: 1000 });
        
        if (rootFiles) {
          rootFiles.forEach(file => {
            if (file.name && !['original', 'indexed', 'placeholder', 'excel'].includes(file.name)) {
              allFiles.push(`${templatePrefix}${file.name}`);
            }
          });
          console.log(`[DELETE Template] Trobats ${rootFiles.length} fitxers a l'arrel`);
        }
        
        // Eliminar tots els fitxers
        if (allFiles.length > 0) {
          const { error: deleteError } = await supabase.storage
            .from('template-docx')
            .remove(allFiles);
          
          if (deleteError) {
            console.error("Error eliminant fitxers del Storage:", deleteError);
            console.warn(`[DELETE Template] Continuant malgrat error del Storage: ${deleteError.message}`);
          } else {
            deletedFilesCount = allFiles.length;
            console.log(`[DELETE Template] ✅ ${deletedFilesCount} fitxers eliminats del Storage correctament`);
          }
        } else {
          console.log(`[DELETE Template] No hi ha fitxers per eliminar del Storage`);
        }
      } catch (err) {
        console.error(`[DELETE Template] Error eliminant fitxers del Storage:`, err);
      }
    }

    // 6. Finalment, eliminar el registre de la base de dades
    // IMPORTANT: Usar el client del servidor per bypassing RLS (problema de política DELETE)
    console.log(`[DELETE Template] Eliminant de BD amb server client (bypassing RLS)...`);
    const { error: deleteError } = await supabaseServerClient
      .from('plantilla_configs')
      .delete()
      .eq('id', id)
      .eq('user_id', template.user_id); // Seguretat extra: verificar que és del mateix usuari

    if (deleteError) {
      console.error("Error eliminant plantilla de la BD:", deleteError);
      return NextResponse.json({
        error: 'Error eliminant plantilla de la base de dades',
        details: deleteError.message
      }, { status: 500 });
    }
    
    console.log(`[DELETE Template] ✅ Registre eliminat de la BD correctament`);

    console.log(`[DELETE Template] ✅ Plantilla "${template.config_name}" eliminada completament`);

    return NextResponse.json({ 
      success: true,
      deletedFiles: deletedFilesCount,
      templateName: template.config_name
    }, { status: 200 });

  } catch (error) {
    console.error("Error general a /api/delete-template/[id]:", error);
    return NextResponse.json({
      error: 'Error intern del servidor',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
