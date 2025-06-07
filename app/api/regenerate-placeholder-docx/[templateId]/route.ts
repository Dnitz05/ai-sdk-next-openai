import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';
import { createServerSupabaseClient } from '@/lib/supabase/serverClient';
import { ExcelLinkMapping, AIInstruction } from '@/app/types';
import { indexDocxWithSdts, isDocxIndexed } from '@/util/docx/indexDocxWithSdts';
import { generatePlaceholderDocxWithIds } from '@/util/docx/generatePlaceholderDocxWithIds';

/**
 * API per regenerar el placeholder DOCX d'una plantilla específica
 * 
 * Aquesta ruta permet regenerar el documento placeholder per a una plantilla existent,
 * utilitzant els linkMappings i aiInstructions de la configuració actual,
 * però aplicant-los sobre una versió indexada del document original (amb SDTs)
 * per garantir la precisió en la generació de placeholders.
 */
/**
 * Handler POST per regenerar el placeholder DOCX d'una plantilla específica
 * Utilitza l'arquitectura actual amb plantilla_configs i rutes Storage actualitzades
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ templateId: string }> }
) {
  const params = await context.params;
  console.log(`[API regenerate-placeholder-docx POST] Inici amb ID: ${params.templateId}`);
  
  try {
    // Autenticació de l'usuari: primer via header Authorization (Bearer), després cookies
    let userId: string | null = null;
    let userError: any = null;
    const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
    console.log('[API regenerate-placeholder-docx] HEADER Authorization:', authHeader ? 'present' : 'missing');
    
    if (authHeader?.startsWith('Bearer ')) {
      const accessToken = authHeader.slice(7).trim();
      console.log('[API regenerate-placeholder-docx] accessToken present:', accessToken ? 'yes' : 'no');
      try {
        const userClient = createUserSupabaseClient(accessToken);
        const { data: userDataAuth, error: authError } = await userClient.auth.getUser();
        if (!authError && userDataAuth.user) {
          userId = userDataAuth.user.id;
          console.log("[API regenerate-placeholder-docx] Usuari autenticat via Bearer token:", userId);
        } else {
          userError = authError;
          console.log("[API regenerate-placeholder-docx] Bearer token invalid, trying fallback...");
        }
      } catch (e) {
        userError = e;
        console.log("[API regenerate-placeholder-docx] Bearer token error, trying fallback...");
      }
    }
    
    if (!userId) {
      console.log("[API regenerate-placeholder-docx] Trying authentication via cookies...");
      try {
        const supabaseServer = await createServerSupabaseClient();
        const { data: userDataAuth2, error: serverError } = await supabaseServer.auth.getUser();
        if (!serverError && userDataAuth2.user) {
          userId = userDataAuth2.user.id;
          console.log("[API regenerate-placeholder-docx] Usuari autenticat via cookies:", userId);
        } else {
          userError = serverError;
        }
      } catch (e) {
        userError = e;
      }
    }
    
    if (!userId) {
      console.error("[API regenerate-placeholder-docx] Error obtenint informació de l'usuari:", userError);
      return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 });
    }
    
    console.log("[API regenerate-placeholder-docx] Usuari autenticat amb èxit:", userId);

    // Client amb service role key per bypassejar RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    
    // 1. Obtenir les dades de la plantilla de la taula correcta
    console.log(`[API regenerate-placeholder-docx] Obtenint plantilla des de plantilla_configs...`);
    const { data: template, error: templateError } = await supabase
      .from('plantilla_configs')
      .select('*')
      .eq('id', params.templateId)
      .eq('user_id', userId)
      .single();
    
    if (templateError || !template) {
      console.error(`[API regenerate-placeholder-docx] Error obtenint plantilla:`, templateError);
      return NextResponse.json({ error: 'No s\'ha trobat la plantilla' }, { status: 404 });
    }

    console.log(`[API regenerate-placeholder-docx] Plantilla trobada:`, {
      id: template.id,
      config_name: template.config_name,
      base_docx_storage_path: template.base_docx_storage_path,
      linkMappingsCount: template.link_mappings?.length || 0,
      aiInstructionsCount: template.ai_instructions?.length || 0
    });
    
    // 2. Sistema robustos de verificació i recuperació del document original
    let originalDocxPath = template.base_docx_storage_path;
    
    if (!originalDocxPath) {
      console.log(`[API regenerate-placeholder-docx] Ruta del document original no trobada a BD. Intentant recuperació...`);
      
      // Intentar recuperar el document utilitzant la ruta estàndard
      const probablePath = `user-${userId}/template-${params.templateId}/original/original.docx`;
      
      try {
        console.log(`[API regenerate-placeholder-docx] Verificant existència de: ${probablePath}`);
        const { data: fileExists } = await supabase.storage
          .from('template-docx')
          .download(probablePath);
          
        if (fileExists && fileExists.size > 0) {
          originalDocxPath = probablePath;
          
          // Actualitzar la BD immediatament per corregir el problema sistemàtic
          const { error: updateError } = await supabase
            .from('plantilla_configs')
            .update({ base_docx_storage_path: probablePath })
            .eq('id', params.templateId)
            .eq('user_id', userId);
          
          if (updateError) {
            console.warn(`[API regenerate-placeholder-docx] Avís actualitzant BD amb ruta recuperada:`, updateError);
          } else {
            console.log(`[API regenerate-placeholder-docx] ✅ BD actualitzada amb ruta recuperada: ${probablePath}`);
          }
        } else {
          throw new Error('Document no vàlid o buit');
        }
      } catch (recoverError) {
        console.error(`[API regenerate-placeholder-docx] No s'ha pogut recuperar el document:`, recoverError);
        
        // Intentar buscar qualsevol fitxer .docx al directori
        try {
          const { data: fileList } = await supabase.storage
            .from('template-docx')
            .list(`user-${userId}/template-${params.templateId}/original`);
          
          if (fileList && fileList.length > 0) {
            const docxFile = fileList.find(f => f.name.toLowerCase().endsWith('.docx'));
            
            if (docxFile) {
              const recoveredPath = `user-${userId}/template-${params.templateId}/original/${docxFile.name}`;
              console.log(`[API regenerate-placeholder-docx] Trobat fitxer alternatiu: ${recoveredPath}`);
              
              // Verificar que és vàlid
              const { data: altFileData } = await supabase.storage
                .from('template-docx')
                .download(recoveredPath);
              
              if (altFileData && altFileData.size > 0) {
                originalDocxPath = recoveredPath;
                
                // Actualitzar BD
                await supabase
                  .from('plantilla_configs')
                  .update({ base_docx_storage_path: recoveredPath })
                  .eq('id', params.templateId)
                  .eq('user_id', userId);
                
                console.log(`[API regenerate-placeholder-docx] ✅ Document alternatiu recuperat: ${recoveredPath}`);
              }
            }
          }
        } catch (listError) {
          console.error(`[API regenerate-placeholder-docx] Error llistant fitxers:`, listError);
        }
      }
    }
    
    // Si encara no tenim document original, fallar amb error informatiu
    if (!originalDocxPath) {
      console.error(`[API regenerate-placeholder-docx] No s'ha pogut trobar cap document original per la plantilla ${params.templateId}`);
      return NextResponse.json({ 
        error: 'No hi ha document original disponible per aquesta plantilla',
        details: 'Cal pujar un document DOCX original abans de poder generar el placeholder',
        templateId: params.templateId
      }, { status: 400 });
    }
    
    // 3. Descarregar el document original des de Storage
    console.log(`[API regenerate-placeholder-docx] Descarregant document original de: ${originalDocxPath}`);
    const { data: originalDocxData, error: originalDocxError } = await supabase
      .storage
      .from('template-docx')
      .download(originalDocxPath);
    
    if (originalDocxError || !originalDocxData) {
      console.error(`[API regenerate-placeholder-docx] Error obtenint document original:`, originalDocxError);
      return NextResponse.json({ error: 'No s\'ha pogut obtenir el document original' }, { status: 404 });
    }
    
    // Convertir el Blob a Buffer
    const arrayBuffer = await originalDocxData.arrayBuffer();
    const originalDocxBuffer = Buffer.from(arrayBuffer as ArrayBuffer);
    console.log(`[API regenerate-placeholder-docx] Document original obtingut, mida: ${originalDocxBuffer.length} bytes`);
    
    // 4. Obtenir les configuracions de link mappings i AI instructions de l'estructura actual
    const linkMappings = template.link_mappings || [];
    const aiInstructions = template.ai_instructions || [];
    
    console.log(`[API regenerate-placeholder-docx] Configuració obtinguda:`, {
      linkMappingsCount: linkMappings.length,
      aiInstructionsCount: aiInstructions.length
    });
    
    // 5. Verificar si el document ja està indexat
    const isIndexed = await isDocxIndexed(originalDocxBuffer);
    console.log(`[API regenerate-placeholder-docx] Verificació indexació:`, {
      indexed: isIndexed.indexed,
      sdtCount: isIndexed.docproofSdtCount
    });
    
    let indexedDocxBuffer = originalDocxBuffer;
    
    // Si no està indexat, indexar-lo primer
    if (!isIndexed.indexed) {
      console.log(`[API regenerate-placeholder-docx] Document no indexat. Procedint a indexar...`);
      
      try {
        const indexResult = await indexDocxWithSdts(originalDocxBuffer);
        indexedDocxBuffer = indexResult.indexedBuffer;
        console.log(`[API regenerate-placeholder-docx] Document indexat correctament amb ${Object.keys(indexResult.idMap).length} IDs`);
      } catch (indexError) {
        console.error(`[API regenerate-placeholder-docx] Error indexant document:`, indexError);
        return NextResponse.json({ error: 'No s\'ha pogut indexar el document' }, { status: 500 });
      }
    } else {
      console.log(`[API regenerate-placeholder-docx] Document ja indexat amb ${isIndexed.docproofSdtCount} SDTs`);
    }
    
    // 6. Generar el nou placeholder utilitzant generatePlaceholderDocxWithIds
    let placeholderBuffer: Buffer;
    
    try {
      console.log(`[API regenerate-placeholder-docx] Generant placeholder amb algoritme basat en IDs...`);
      placeholderBuffer = await generatePlaceholderDocxWithIds(
        indexedDocxBuffer,
        linkMappings as ExcelLinkMapping[],
        aiInstructions as AIInstruction[]
      );
      
      console.log(`[API regenerate-placeholder-docx] Placeholder generat correctament, mida: ${placeholderBuffer.length} bytes`);
    } catch (placeholderError) {
      console.error(`[API regenerate-placeholder-docx] Error generant placeholder:`, placeholderError);
      return NextResponse.json({ error: 'No s\'ha pogut generar el placeholder' }, { status: 500 });
    }
    
    // 7. Determinar la ruta de placeholder basada en la ruta original
    let placeholderPath = '';
    const originalPath = template.base_docx_storage_path;
    
    if (originalPath && originalPath.includes('/original/')) {
      placeholderPath = originalPath.replace('/original/', '/placeholder/').replace(/\/[^\/]+$/, '/placeholder.docx');
    } else {
      // Fallback: construir ruta basada en l'estructura esperada
      placeholderPath = `user-${userId}/template-${params.templateId}/placeholder/placeholder.docx`;
    }
    
    console.log(`[API regenerate-placeholder-docx] Ruta placeholder: ${placeholderPath}`);
    
    // 8. Pujar el nou placeholder a Supabase Storage
    try {
      // Assegurar que el directori existeix
      const placeholderDir = placeholderPath.substring(0, placeholderPath.lastIndexOf('/'));
      try {
        await supabase.storage
          .from('template-docx')
          .upload(`${placeholderDir}/.keep`, new Uint8Array(0), { upsert: true });
      } catch (dirError: any) {
        // Ignorem errors si ja existeix
        if (!dirError?.message?.includes('duplicate')) {
          console.warn(`[API regenerate-placeholder-docx] Avís creant directori: ${dirError?.message}`);
        }
      }
      
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('template-docx')
        .upload(placeholderPath, placeholderBuffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: true
        });
      
      if (uploadError) {
        console.error(`[API regenerate-placeholder-docx] Error pujant placeholder:`, uploadError);
        return NextResponse.json({ error: 'No s\'ha pogut pujar el placeholder' }, { status: 500 });
      }
      
      console.log(`[API regenerate-placeholder-docx] Placeholder pujat correctament a ${uploadData.path}`);
      
      // 9. Actualitzar la BD amb la ruta del placeholder
      const { error: updateError } = await supabase
        .from('plantilla_configs')
        .update({ placeholder_docx_storage_path: uploadData.path })
        .eq('id', params.templateId)
        .eq('user_id', userId);
      
      if (updateError) {
        console.error(`[API regenerate-placeholder-docx] Error actualitzant BD:`, updateError);
        // No fallem completament, el placeholder s'ha generat correctament
      } else {
        console.log(`[API regenerate-placeholder-docx] BD actualitzada amb ruta placeholder`);
      }
      
      // 10. Si hem hagut d'indexar el document, també desem la versió indexada
      if (!isIndexed.indexed) {
        const indexedPath = originalPath.replace('/original/', '/indexed/').replace(/\/[^\/]+$/, '/indexed.docx');
        
        const { error: indexedUploadError } = await supabase
          .storage
          .from('template-docx')
          .upload(indexedPath, indexedDocxBuffer, {
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            upsert: true
          });
        
        if (indexedUploadError) {
          console.warn(`[API regenerate-placeholder-docx] Avís: No s'ha pogut pujar document indexat:`, indexedUploadError);
        } else {
          console.log(`[API regenerate-placeholder-docx] Document indexat desat a ${indexedPath}`);
        }
      }
      
    } catch (storageError) {
      console.error(`[API regenerate-placeholder-docx] Error amb emmagatzematge:`, storageError);
      return NextResponse.json({ error: 'Error d\'emmagatzematge' }, { status: 500 });
    }
    
    // 11. Retornar resposta d'èxit
    return NextResponse.json({
      success: true,
      message: 'Placeholder regenerat correctament',
      placeholderSize: placeholderBuffer.length,
      placeholderPath: placeholderPath
    }, { status: 200 });
    
  } catch (error) {
    console.error(`[API regenerate-placeholder-docx] Error no controlat:`, error);
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 });
  }
}

/**
 * Handler GET mantingut per compatibilitat (però adaptat a l'arquitectura actual)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ templateId: string }> }
) {
  // Redirigir al POST per mantenir la lògica unificada
  return POST(request, context);
}
