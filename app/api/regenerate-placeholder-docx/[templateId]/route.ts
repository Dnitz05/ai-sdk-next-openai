import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';
import { generatePlaceholderDocx } from '@util/generatePlaceholderDocx';
import { canRegeneratePlaceholder } from '@util/ensureStoragePathConsistency';

/**
 * API per regenerar el DOCX placeholder per a una plantilla específica.
 * Útil quan s'han detectat inconsistències entre la BD i Storage.
 * 
 * NOTA: Aquesta API hauria d'estar protegida a nivell administratiu
 * en un entorn de producció.
 */
export async function POST(
  request: NextRequest,
  context: { params: { templateId: string } }
) {
  console.log("[API regenerate-placeholder-docx] Petició rebuda");
  
  // 1. Verificar autenticació
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autenticat. Falten credencials.' }, { status: 401 });
  }
  const accessToken = authHeader.replace('Bearer ', '').trim();
  
  const userSupabaseClient = createUserSupabaseClient(accessToken);
  const { data: userData, error: userError } = await userSupabaseClient.auth.getUser();

  if (userError || !userData?.user) {
    console.error("[API regenerate-placeholder-docx] Error verificant usuari:", userError);
    return NextResponse.json({ error: 'Usuari no autenticat o token invàlid.', details: userError?.message }, { status: 401 });
  }
  const userId = userData.user.id;
  console.log("[API regenerate-placeholder-docx] Usuari autenticat:", userId);
  
  // 2. Crear client amb service role key per accedir a Storage i BD
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // 3. Obtenir templateId dels paràmetres
  const { templateId } = context.params;
  console.log(`[API regenerate-placeholder-docx] Regenerant placeholder per plantilla: ${templateId}`);

  if (!templateId) {
    return NextResponse.json({ error: 'Falta l\'id de la plantilla.' }, { status: 400 });
  }

  try {
    // 4. Verificar que es pot regenerar el placeholder
    const canRegenerate = await canRegeneratePlaceholder(templateId);
    if (!canRegenerate) {
      console.error(`[API regenerate-placeholder-docx] No es pot regenerar el placeholder per a ${templateId}`);
      return NextResponse.json({ 
        error: 'No es pot regenerar el placeholder per aquesta plantilla',
        details: 'No s\'ha trobat el document original o no hi ha mappings/instructions'
      }, { status: 400 });
    }

    // 5. Obtenir les dades de la plantilla
    const { data: template, error: templateError } = await serviceClient
      .from('plantilla_configs')
      .select('id, user_id, base_docx_storage_path, link_mappings, ai_instructions')
      .eq('id', templateId)
      .single();

    if (templateError) {
      console.error(`[API regenerate-placeholder-docx] Error obtenint plantilla: ${templateError.message}`);
      return NextResponse.json({ error: 'Error obtenint dades de la plantilla' }, { status: 404 });
    }

    // 6. Verificar que l'usuari té permís (és propietari o és admin)
    const isOwner = template.user_id === userId;
    const isAdmin = userData.user.email?.endsWith('@yourdomain.com') || false; // Exemple d'un criteri d'administrador
    
    if (!isOwner && !isAdmin) {
      console.error(`[API regenerate-placeholder-docx] Usuari ${userId} no té permís per regenerar placeholder per plantilla ${templateId}`);
      return NextResponse.json({ error: 'No tens permís per regenerar aquesta plantilla' }, { status: 403 });
    }

    // 7. Si base_docx_storage_path és null, intentar recuperar-lo
    let originalPathToUse = template.base_docx_storage_path;
    if (!originalPathToUse) {
      console.log(`[API regenerate-placeholder-docx] Intentant recuperar ruta del document original...`);
      
      // Construir ruta probable basat en convencions conegudes
      const searchPath = `user-${template.user_id}/template-${templateId}/original`;
      
      const { data: fileList, error: listError } = await serviceClient.storage
        .from('template-docx')
        .list(searchPath);
      
      if (listError) {
        console.error(`[API regenerate-placeholder-docx] Error llistant directori: ${listError.message}`);
        return NextResponse.json({ error: 'Error recuperant document original' }, { status: 500 });
      }
      
      if (!fileList || fileList.length === 0) {
        console.error(`[API regenerate-placeholder-docx] No s'han trobat fitxers a ${searchPath}`);
        return NextResponse.json({ error: 'No s\'han trobat documents originals' }, { status: 404 });
      }
      
      // Buscar si hi ha algun fitxer .docx
      const docxFile = fileList.find(f => f.name.toLowerCase().endsWith('.docx'));
      
      if (!docxFile) {
        console.error(`[API regenerate-placeholder-docx] No s'ha trobat cap fitxer .docx a ${searchPath}`);
        return NextResponse.json({ error: 'No s\'ha trobat cap document DOCX' }, { status: 404 });
      }
      
      originalPathToUse = `${searchPath}/${docxFile.name}`;
      console.log(`[API regenerate-placeholder-docx] ✅ Document recuperat: ${originalPathToUse}`);
      
      // Actualitzar la plantilla amb la ruta recuperada
      await serviceClient
        .from('plantilla_configs')
        .update({ base_docx_storage_path: originalPathToUse })
        .eq('id', templateId);
      
      console.log(`[API regenerate-placeholder-docx] ✅ BD actualitzada amb ruta recuperada`);
    }

    // 8. Descarregar el document original
    console.log(`[API regenerate-placeholder-docx] Descarregant document original de: ${originalPathToUse}`);
    const { data: fileData, error: downloadError } = await serviceClient.storage
      .from('template-docx')
      .download(originalPathToUse);
    
    if (downloadError) {
      console.error(`[API regenerate-placeholder-docx] Error descarregant document: ${downloadError.message}`);
      return NextResponse.json({ error: 'Error descarregant document original' }, { status: 500 });
    }
    
    if (!fileData || fileData.size === 0) {
      console.error(`[API regenerate-placeholder-docx] Document buit o no trobat`);
      return NextResponse.json({ error: 'Document original buit o no disponible' }, { status: 404 });
    }
    
    // 9. Preparar dades per generar placeholder
    const arrayBuffer = await fileData.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);
    
    // 10. Generar el nou placeholder DOCX
    const linkMappings = template.link_mappings || [];
    const aiInstructions = template.ai_instructions || [];
    
    console.log(`[API regenerate-placeholder-docx] Generant placeholder amb: ${linkMappings.length} mappings i ${aiInstructions.length} instruccions`);
    const placeholderBuffer = await generatePlaceholderDocx(
      originalBuffer,
      linkMappings,
      aiInstructions
    );
    
    // 11. Determinar la ruta on s'ha de desar el placeholder
    // Construir ruta del placeholder mantenint la mateixa estructura
    const originalPathParts = originalPathToUse.split('/');
    const originalDir = originalPathParts.slice(0, -2).join('/');
    const placeholderPath = `${originalDir}/placeholder/placeholder.docx`;
    
    console.log(`[API regenerate-placeholder-docx] Ruta original: ${originalPathToUse}`);
    console.log(`[API regenerate-placeholder-docx] Ruta placeholder: ${placeholderPath}`);
    
    // 12. Assegurar que el directori existeix
    const placeholderDir = placeholderPath.substring(0, placeholderPath.lastIndexOf('/'));
    try {
      console.log(`[API regenerate-placeholder-docx] Assegurant directori: ${placeholderDir}`);
      await serviceClient.storage
        .from('template-docx')
        .upload(`${placeholderDir}/.keep`, new Uint8Array(0), { upsert: true });
    } catch (dirError: any) {
      // Ignorem errors si ja existeix
      if (!dirError?.message?.includes('duplicate') && !dirError?.error?.includes('duplicate')) {
        console.warn(`[API regenerate-placeholder-docx] Avís creant directori: ${dirError?.message || dirError}`);
      }
    }
    
    // 13. Pujar el placeholder
    console.log(`[API regenerate-placeholder-docx] Pujant placeholder de ${placeholderBuffer.length} bytes`);
    const { data: uploadData, error: uploadError } = await serviceClient.storage
      .from('template-docx')
      .upload(placeholderPath, placeholderBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true
      });
    
    if (uploadError) {
      console.error(`[API regenerate-placeholder-docx] Error pujant placeholder: ${uploadError.message}`);
      return NextResponse.json({ error: 'Error pujant el placeholder regenerat' }, { status: 500 });
    }
    
    // 14. Actualitzar la BD amb la nova ruta
    console.log(`[API regenerate-placeholder-docx] Actualitzant BD amb nova ruta: ${uploadData.path}`);
    await serviceClient
      .from('plantilla_configs')
      .update({ placeholder_docx_storage_path: uploadData.path })
      .eq('id', templateId);
    
    // 15. Retornar èxit
    return NextResponse.json({
      message: 'Placeholder regenerat correctament',
      templateId,
      placeholderPath: uploadData.path
    }, { status: 200 });

  } catch (error) {
    console.error(`[API regenerate-placeholder-docx] Error general:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconegut';
    return NextResponse.json({ 
      error: 'Error regenerant placeholder', 
      details: errorMessage 
    }, { status: 500 });
  }
}
