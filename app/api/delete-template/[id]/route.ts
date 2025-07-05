// app/api/delete-template/[id]/route.ts
import { NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';

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
        indexed_docx_storage_path,
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

    // 4. Recopilar tots els paths d'arxius a eliminar
    const filesToDelete: string[] = [];
    
    if (template.base_docx_storage_path) {
      filesToDelete.push(template.base_docx_storage_path);
      console.log(`[DELETE Template] Arxiu a eliminar: ${template.base_docx_storage_path}`);
    }
    
    if (template.placeholder_docx_storage_path) {
      filesToDelete.push(template.placeholder_docx_storage_path);
      console.log(`[DELETE Template] Arxiu a eliminar: ${template.placeholder_docx_storage_path}`);
    }
    
    if (template.indexed_docx_storage_path) {
      filesToDelete.push(template.indexed_docx_storage_path);
      console.log(`[DELETE Template] Arxiu a eliminar: ${template.indexed_docx_storage_path}`);
    }
    
    if (template.excel_storage_path) {
      filesToDelete.push(template.excel_storage_path);
      console.log(`[DELETE Template] Arxiu a eliminar: ${template.excel_storage_path}`);
    }

    // 5. Eliminar arxius del Storage si n'hi ha
    if (filesToDelete.length > 0) {
      console.log(`[DELETE Template] Eliminant ${filesToDelete.length} arxius del Storage...`);
      
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove(filesToDelete);

      if (storageError) {
        console.error("Error eliminant arxius del Storage:", storageError);
        // No retornem error aquí per permetre continuar amb l'eliminació de la BD
        console.warn(`[DELETE Template] Continuant malgrat error del Storage: ${storageError.message}`);
      } else {
        console.log(`[DELETE Template] ✅ Arxius eliminats del Storage correctament`);
      }
    } else {
      console.log(`[DELETE Template] No hi ha arxius per eliminar del Storage`);
    }

    // 6. Finalment, eliminar el registre de la base de dades
    const { error: deleteError } = await supabase
      .from('plantilla_configs')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error("Error eliminant plantilla de la BD:", deleteError);
      return NextResponse.json({
        error: 'Error eliminant plantilla de la base de dades',
        details: deleteError.message
      }, { status: 500 });
    }

    console.log(`[DELETE Template] ✅ Plantilla "${template.config_name}" eliminada completament`);

    return NextResponse.json({ 
      success: true,
      deletedFiles: filesToDelete.length,
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
