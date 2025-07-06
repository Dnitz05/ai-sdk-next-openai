// API d'eliminació de plantilles usant MCP de Supabase (bypassa RLS)
import { NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';

export async function DELETE(request: Request) {
  // Extraiem l'id de la URL manualment
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

    // 3. Obtenir user_id del token JWT per seguretat
    let userId;
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      userId = payload.sub;
    } catch (err) {
      return NextResponse.json({ 
        error: 'Token JWT invàlid',
        details: 'No s\'ha pogut decodificar el token'
      }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID no trobat al token' }, { status: 401 });
    }

    // 4. Primer, obtenir la plantilla per verificar que existeix i és de l'usuari
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

    // 5. Verificar que la plantilla és de l'usuari autenticat
    if (template.user_id !== userId) {
      return NextResponse.json({ error: 'No tens permisos per eliminar aquesta plantilla' }, { status: 403 });
    }

    console.log(`[DELETE Template MCP] Eliminant plantilla "${template.config_name}" (ID: ${id})`);

    // 6. Eliminar fitxers del Storage
    let deletedFilesCount = 0;
    
    try {
      const userPrefix = `user-${userId}/`;
      const templatePrefix = `${userPrefix}template-${template.id}/`;
      
      console.log(`[DELETE Template MCP] Eliminant carpeta completa: ${templatePrefix}`);
      
      // Obtenir tots els fitxers recursivament
      const allFiles: string[] = [];
      
      // Llistar fitxers en subcarpetes
      for (const subfolder of ['original', 'indexed', 'placeholder']) {
        const { data: subFiles } = await supabase.storage
          .from('template-docx')
          .list(`${templatePrefix}${subfolder}`, { limit: 1000 });
        
        if (subFiles) {
          subFiles.forEach(file => {
            allFiles.push(`${templatePrefix}${subfolder}/${file.name}`);
          });
        }
      }
      
      // Eliminar tots els fitxers
      if (allFiles.length > 0) {
        const { error: deleteError } = await supabase.storage
          .from('template-docx')
          .remove(allFiles);
        
        if (deleteError) {
          console.error("Error eliminant fitxers del Storage:", deleteError);
          console.warn(`[DELETE Template MCP] Continuant malgrat error del Storage: ${deleteError.message}`);
        } else {
          deletedFilesCount = allFiles.length;
          console.log(`[DELETE Template MCP] ✅ ${deletedFilesCount} fitxers eliminats del Storage correctament`);
        }
      } else {
        console.log(`[DELETE Template MCP] No hi ha fitxers per eliminar del Storage`);
      }
    } catch (err) {
      console.error(`[DELETE Template MCP] Error eliminant fitxers del Storage:`, err);
    }

    // 7. Eliminar registre de la base de dades usant una crida a l'API interna
    try {
      console.log(`[DELETE Template MCP] Eliminant registre de la BD...`);
      
      // Fer una crida interna a l'endpoint de MCP cleanup
      const deleteResponse = await fetch(`${request.url.split('/api/')[0]}/api/internal/delete-template-record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: id,
          userId: userId
        })
      });

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json();
        throw new Error(errorData.error || 'Error eliminant registre de la BD');
      }

      console.log(`[DELETE Template MCP] ✅ Registre eliminat de la BD correctament`);
    } catch (err) {
      console.error("Error eliminant plantilla de la BD:", err);
      return NextResponse.json({
        error: 'Error eliminant plantilla de la base de dades',
        details: err instanceof Error ? err.message : String(err)
      }, { status: 500 });
    }

    console.log(`[DELETE Template MCP] ✅ Plantilla "${template.config_name}" eliminada completament`);

    return NextResponse.json({ 
      success: true,
      deletedFiles: deletedFilesCount,
      templateName: template.config_name
    }, { status: 200 });

  } catch (error) {
    console.error("Error general a /api/delete-template-mcp/[id]:", error);
    return NextResponse.json({
      error: 'Error intern del servidor',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
