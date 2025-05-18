import { NextRequest, NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient'; // Per verificar l'usuari
import { createClient } from '@supabase/supabase-js'; // Per al client de servei
import { generatePlaceholderDocx } from '@util/generatePlaceholderDocx';

// Interfície per a les dades esperades al body (pot ser més específica)
interface UpdateTemplatePayload {
  config_name?: string;
  base_docx_name?: string | null; // Nom original del fitxer DOCX
  excel_file_name?: string | null;
  final_html?: string;
  excel_headers?: string[];
  link_mappings?: any[]; // Especificar tipus més concret si és possible
  ai_instructions?: IAInstruction[];
  originalDocxPath?: string | null; // Ruta del DOCX original a Supabase Storage
  skipPlaceholderGeneration?: boolean; // Permet ometre la generació del placeholder
}

// Interfície per a les instruccions d'IA (ja existent)
interface IAInstruction {
  id?: string;
  paragraphId?: string;
  content?: string;
  prompt?: string;
  status?: string;
  order?: number;
}

export async function PUT(request: NextRequest) {
  // 1. Verificar autenticació
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autenticat. Falten credencials.' }, { status: 401 });
  }
  const accessToken = authHeader.replace('Bearer ', '').trim();
  
  const userSupabaseClient = createUserSupabaseClient(accessToken); // Client per verificar l'usuari
  const { data: userData, error: userError } = await userSupabaseClient.auth.getUser();

  if (userError || !userData?.user) {
    console.error("[API UPDATE-TEMPLATE] Error verificant usuari:", userError);
    return NextResponse.json({ error: 'Usuari no autenticat o token invàlid.', details: userError?.message }, { status: 401 });
  }
  const userId = userData.user.id;
  console.log("[API UPDATE-TEMPLATE] Usuari autenticat:", userId);
  
  // 2. Crear client amb service role key
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // Extreu l'id de la URL (paràmetre dinàmic) de la pathname
  // Ex: /api/update-template/1234-5678-abcd-efgh
  const pathParts = request.nextUrl.pathname.split('/');
  const id = pathParts[pathParts.length - 1];
  console.log('[API UPDATE-TEMPLATE] ID de la plantilla a actualitzar:', id);
  
  if (!id) {
    return NextResponse.json({ error: 'Falta l\'id de la plantilla.' }, { status: 400 });
  }

  const body = (await request.json()) as UpdateTemplatePayload;
  console.log('[API UPDATE-TEMPLATE] Body rebut:', JSON.stringify(body, null, 2).substring(0,500) + "...");
  
  // Determinar si s'ha de saltar la generació del placeholder
  const skipPlaceholderGeneration = body.skipPlaceholderGeneration === true;
  if (skipPlaceholderGeneration) {
    console.log('[API UPDATE-TEMPLATE] Es saltarà la generació del placeholder (skipPlaceholderGeneration = true)');
  }

  // Camps permesos per actualitzar directament
  const allowedFields: Array<keyof UpdateTemplatePayload> = [
    'config_name',
    'base_docx_name', // Nom original del fitxer
    'excel_file_name',
    'final_html',
    'excel_headers',
    'link_mappings',
    // 'ai_instructions' i 'originalDocxPath' es gestionen per separat
  ];

  const updateData: Record<string, any> = {};
  for (const key of allowedFields) {
    if (key in body && body[key] !== undefined) { // Només incloure si està present al body
      updateData[key] = body[key];
    }
  }
  
  // Gestió especial per a 'ai_instructions'
  if (body.ai_instructions && Array.isArray(body.ai_instructions)) {
    updateData.ai_instructions = body.ai_instructions.map((instr: IAInstruction) => ({
      id: instr.id || `ia-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      paragraphId: instr.paragraphId || '',
      prompt: instr.content || instr.prompt || '',
      content: instr.content || instr.prompt || '',
      status: instr.status || 'saved',
      order: instr.order || 0
    }));
  }

  // Gestió especial per a 'originalDocxPath' per actualitzar 'base_docx_storage_path'
  // Permet enviar null per desvincular el DOCX.
  if (body.originalDocxPath !== undefined) {
    // Emmagatzema la ruta original en el camp base_docx_storage_path
    updateData.base_docx_storage_path = body.originalDocxPath;
  }
  // Si originalDocxPath no ve al body, base_docx_storage_path no es modifica.

  // Assegurar que user_id no es pot canviar des del body i s'estableix correctament
  // updateData.user_id = userId; // No cal, ja que el filtre .eq('user_id', userId) ho protegeix

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ message: 'No hi ha camps per actualitzar.', template: null }, { status: 200 });
  }
  
  console.log('[API UPDATE-TEMPLATE] Dades a actualitzar (updateData):', JSON.stringify(updateData, null, 2));

  // 3. Actualitzar plantilla
  const { data: updatedTemplate, error: dbError } = await serviceClient
    .from('plantilla_configs')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', userId) // Important: assegurar que l'usuari només actualitza les seves plantilles
    .select()
    .single();

  if (dbError) {
    console.error('[API UPDATE-TEMPLATE] Error actualitzant la plantilla a la BD:', dbError);
    // ... (gestió d'errors existent)
    let userMessage = 'Error actualitzant la plantilla.';
    if (dbError.code === 'PGRST116') userMessage = 'No s\'ha trobat la plantilla per actualitzar o no pertany a l\'usuari.';
    // ... (altres codis d'error)
    return NextResponse.json({ error: userMessage, details: dbError.message, code: dbError.code }, { status: 400 });
  }

  if (!updatedTemplate) {
    console.warn('[API UPDATE-TEMPLATE] No s\'ha trobat la plantilla per actualitzar (ID: ${id}, UserID: ${userId}) o no hi ha hagut canvis.');
    return NextResponse.json({ error: 'No s\'ha trobat la plantilla per actualitzar o no pertany a l\'usuari.', template: null }, { status: 404 });
  }

  console.log('[API UPDATE-TEMPLATE] Plantilla actualitzada correctament:', updatedTemplate);


    // Si skipPlaceholderGeneration és true, només actualitzem les metadades i no generem placeholder
    if (skipPlaceholderGeneration) {
      console.log('[API UPDATE-TEMPLATE] Generació de placeholder omesa segons petició. Retornant resposta...');
      return NextResponse.json({ 
        template: updatedTemplate, 
        placeholderDocxPath: (updatedTemplate as any).placeholder_docx_storage_path,
        placeholderStatus: 'skipped'
      }, { status: 200 });
    }
    
    // Determinar ruta original per generació de placeholder i comprovar associacions
    let originalPathToUse = body.originalDocxPath ?? (updatedTemplate as any).base_docx_storage_path;
    
    // Sistema de recuperació si la ruta és null però el document podria existir
    if (!originalPathToUse && ((body.link_mappings?.length ?? 0) > 0 || (body.ai_instructions?.length ?? 0) > 0)) {
      console.log("[API UPDATE-TEMPLATE] Ruta original no trobada. Intentant construir-la automàticament...");
      
      // Construir ruta probable basat en convencions conegudes
      const probablePath = `user-${userId}/template-${id}/original/original.docx`;
      console.log(`[API UPDATE-TEMPLATE] Verificant si existeix document a ruta reconstruïda: ${probablePath}`);
      
      try {
        // Verificar si existeix el fitxer o el directori
        const { data: fileListData } = await serviceClient.storage
          .from('template-docx')
          .list(`user-${userId}/template-${id}/original`);
          
        if (fileListData && fileListData.length > 0) {
          console.log(`[API UPDATE-TEMPLATE] Directori existeix amb ${fileListData.length} fitxers:`, 
            fileListData.map(f => f.name).join(', '));
            
          // Buscar si hi ha algun fitxer .docx
          const docxFile = fileListData.find(f => f.name.toLowerCase().endsWith('.docx'));
          
          if (docxFile) {
            // S'ha trobat un fitxer .docx, reconstruïm la ruta completa
            const recoveredPath = `user-${userId}/template-${id}/original/${docxFile.name}`;
            console.log(`[API UPDATE-TEMPLATE] ✅ Recuperat document: ${recoveredPath}`);
            
            // Actualitzar la plantilla amb la ruta recuperada
            await serviceClient
              .from('plantilla_configs')
              .update({ base_docx_storage_path: recoveredPath })
              .eq('id', id)
              .eq('user_id', userId);
              
            console.log(`[API UPDATE-TEMPLATE] ✅ BD actualitzada amb ruta recuperada`);
            originalPathToUse = recoveredPath;
          } else {
            console.log(`[API UPDATE-TEMPLATE] ⚠️ No s'ha trobat cap fitxer .docx al directori original`);
          }
        } else {
          console.log(`[API UPDATE-TEMPLATE] ⚠️ Directori no existeix o està buit`);
        }
      } catch (recoverError) {
        console.error("[API UPDATE-TEMPLATE] Error recuperant ruta del document:", recoverError);
      }
    }
    
    if (((body.link_mappings?.length ?? 0) > 0 || (body.ai_instructions?.length ?? 0) > 0) && originalPathToUse) {
      try {
        console.log(`[API UPDATE-TEMPLATE] Intent de generar placeholder per a: ${originalPathToUse}`);
        
        // 1. Descarregar el docx original
        const { data: fileData, error: downloadError } = await serviceClient.storage
          .from('template-docx')
          .download(originalPathToUse);
          
        if (downloadError) {
          console.error('[API UPDATE-TEMPLATE] Error descarregant document original:', downloadError);
          throw downloadError;
        }
        
        if (!fileData || fileData.size === 0) {
          console.error('[API UPDATE-TEMPLATE] Document original buit o no trobat a:', originalPathToUse);
          throw new Error('Document original no disponible');
        }
        
        console.log(`[API UPDATE-TEMPLATE] Document original descarregat: ${fileData.size} bytes`);
        
        // 2. Convertir a buffer
        const arrayBuffer = await fileData.arrayBuffer();
        const originalBuffer = Buffer.from(arrayBuffer);
        
        // 3. Generar placeholder DOCX
        console.log(`[API UPDATE-TEMPLATE] Invocant generatePlaceholderDocx amb mappings:`, 
          { linkCount: body.link_mappings?.length, aiCount: body.ai_instructions?.length });
        
        const placeholderBuffer = await generatePlaceholderDocx(
          originalBuffer,
          body.link_mappings ?? [],
          body.ai_instructions ?? []
        );
        
        // 4. Determinar la ruta de placeholder correctament
        let placeholderPath = '';
        
        console.log(`[API UPDATE-TEMPLATE] Processant ruta original: ${originalPathToUse}`);
        
        // Mètode 1: Si la ruta segueix exactament el patró esperat
        if (originalPathToUse.includes('/original/original.docx')) {
          placeholderPath = originalPathToUse.replace('/original/original.docx', '/placeholder/placeholder.docx');
        } 
        // Mètode 2: Reconstruir basant-nos en parts de la ruta
        else {
          // Dividim la ruta per segments
          const pathParts = originalPathToUse.split('/');
          
          // Busquem el segment 'original' si existeix
          const originalIndex = pathParts.findIndex((part: string) => part === 'original');
          
          if (originalIndex !== -1) {
            // Substituïm 'original' per 'placeholder'
            pathParts[originalIndex] = 'placeholder';
            
            // Si hi ha un segment després (nom de fitxer), el substituïm
            if (originalIndex + 1 < pathParts.length) {
              pathParts[originalIndex + 1] = 'placeholder.docx';
            }
            
            placeholderPath = pathParts.join('/');
          } else {
            // Si no trobem cap patró conegut, construïm una ruta basada en la base
            // Eliminem el nom del fitxer per obtenir el directori pare
            const lastSlashIndex = originalPathToUse.lastIndexOf('/');
            const parentDir = lastSlashIndex !== -1 ? 
                              originalPathToUse.substring(0, lastSlashIndex) : 
                              '';
            
            // Pujem un nivell (eliminem 'original' si existeix)
            const baseDir = parentDir.endsWith('/original') ? 
                           parentDir.substring(0, parentDir.length - '/original'.length) : 
                           parentDir;
                           
            placeholderPath = `${baseDir}/placeholder/placeholder.docx`;
          }
        }
        
        console.log(`[API UPDATE-TEMPLATE] Ruta original: ${originalPathToUse}`);
        console.log(`[API UPDATE-TEMPLATE] Ruta placeholder generada: ${placeholderPath}`);
        
        // 5. Assegurar que el directori existeix (crear .keep)
        const placeholderDir = placeholderPath.substring(0, placeholderPath.lastIndexOf('/'));
        try {
          console.log(`[API UPDATE-TEMPLATE] Assegurant directori: ${placeholderDir}`);
          await serviceClient.storage
            .from('template-docx')
            .upload(`${placeholderDir}/.keep`, new Uint8Array(0), { upsert: true });
          console.log(`[API UPDATE-TEMPLATE] Directori assegurat`);
        } catch (dirError: any) {
          // Ignorem errors si ja existeix el fitxer
          if (dirError?.message?.includes('duplicate') || dirError?.error?.includes('duplicate')) {
            console.log(`[API UPDATE-TEMPLATE] Directori ja existeix`);
          } else {
            console.warn(`[API UPDATE-TEMPLATE] Avís creant directori: ${dirError?.message || dirError}`);
            // Continuem tot i així, pot ser que funcioni
          }
        }
        
        // 6. Pujar el placeholder
        console.log(`[API UPDATE-TEMPLATE] Pujant placeholder de ${placeholderBuffer.length} bytes`);
        const { data: uploadData, error: uploadError } = await serviceClient.storage
          .from('template-docx')
          .upload(placeholderPath, placeholderBuffer, {
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            upsert: true
          });
          
        if (uploadError) {
          console.error('[API UPDATE-TEMPLATE] Error pujant placeholder:', uploadError);
          throw uploadError;
        }
      await serviceClient
        .from('plantilla_configs')
        .update({ placeholder_docx_storage_path: uploadData.path })
        .eq('id', id)
        .eq('user_id', userId);
      (updatedTemplate as any).placeholder_docx_storage_path = uploadData.path;
      } catch (error) {
        // Logging detallat per ajudar al diagnòstic
        console.error('[API UPDATE-TEMPLATE] Error generant placeholder.docx:', error);
        console.error('[API UPDATE-TEMPLATE] Detalls addicionals:', {
          templateId: id,
          userId,
          originalPathExistent: !!originalPathToUse,
          originalPath: originalPathToUse,
          linkMappingsCount: body.link_mappings?.length ?? 0,
          aiInstructionsCount: body.ai_instructions?.length ?? 0,
          errorName: error instanceof Error ? error.name : 'Unknown',
          errorMessage: error instanceof Error ? error.message : String(error)
        });
        
        // No fallem completament, continuem per retornar la plantilla tot i l'error
      }
  }

  return NextResponse.json({ 
    template: updatedTemplate, 
    placeholderDocxPath: (updatedTemplate as any).placeholder_docx_storage_path,
    placeholderStatus: 'generated'
  }, { status: 200 });
}
