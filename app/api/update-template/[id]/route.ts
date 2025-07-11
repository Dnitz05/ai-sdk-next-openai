import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { generatePlaceholderDocx } from '@util/generatePlaceholderDocx';
import { indexDocxWithSdts, isDocxIndexed } from '@/util/docx/indexDocxWithSdts';
import { generatePlaceholderDocxWithIds } from '@/util/docx/generatePlaceholderDocxWithIds';
import { AIInstruction, ExcelLinkMapping } from '@/app/types';

// Interfície per a les dades esperades al body (pot ser més específica)
interface UpdateTemplatePayload {
  config_name?: string;
  base_docx_name?: string | null; // Nom original del fitxer DOCX
  excel_file_name?: string | null;
  final_html?: string;
  excel_headers?: string[];
  link_mappings?: ExcelLinkMapping[];
  ai_instructions?: any[]; // Rebem qualsevol cosa i la validarem
  originalDocxPath?: string | null; // Ruta del DOCX original a Supabase Storage
  skipPlaceholderGeneration?: boolean; // Permet ometre la generació del placeholder
}

export async function PUT(request: NextRequest) {
  console.log("[API UPDATE-TEMPLATE] Iniciant actualització de plantilla amb SSR...");
  
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
    console.error("[API UPDATE-TEMPLATE] Error d'autenticació SSR:", authError);
    return NextResponse.json({ 
      error: 'Usuari no autenticat',
      details: authError?.message 
    }, { status: 401 });
  }
  
  const userId = user.id;
  console.log("[API UPDATE-TEMPLATE] Usuari autenticat via SSR:", userId);

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
  
  // Gestió especial per a 'ai_instructions' amb validació robusta
  if (body.ai_instructions && Array.isArray(body.ai_instructions)) {
    updateData.ai_instructions = body.ai_instructions.map((instr: any) => ({
      id: instr.id || `ia-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      paragraphId: instr.paragraphId || '',
      prompt: instr.content || instr.prompt || '',
      content: instr.content || instr.prompt || '',
      status: instr.status || 'saved',
      order: instr.order || 0,
      originalParagraphText: instr.originalParagraphText || '' // Preservar el text original del paràgraf
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

  // 3. Actualitzar plantilla amb RLS automàtic
  const { data: updatedTemplate, error: dbError } = await supabase
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
        const { data: fileListData } = await supabase.storage
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
            await supabase
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
        const { data: fileData, error: downloadError } = await supabase.storage
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
        
        // ==========================================
        // NOVA LÒGICA AMB INDEXACIÓ AUTOMÀTICA
        // ==========================================
        console.log(`[API UPDATE-TEMPLATE] 🔄 Implementant generació amb indexació automàtica...`);
        
        // 2.1. Verificar si existeix versió indexada
        const indexedPath = originalPathToUse.replace('/original/', '/indexed/').replace(/\/[^\/]+\.docx$/, '/indexed.docx');
        console.log(`[API UPDATE-TEMPLATE] Buscant versió indexada a: ${indexedPath}`);
        
        let indexedBuffer = originalBuffer;
        let usingIndexedVersion = false;
        
        try {
          const { data: indexedData, error: indexedError } = await supabase.storage
            .from('template-docx')
            .download(indexedPath);
            
          if (!indexedError && indexedData && indexedData.size > 0) {
            console.log(`[API UPDATE-TEMPLATE] ✅ Versió indexada trobada: ${indexedData.size} bytes`);
            const indexedArrayBuffer = await indexedData.arrayBuffer();
            indexedBuffer = Buffer.from(indexedArrayBuffer);
            usingIndexedVersion = true;
            
            // Verificar que realment està indexada
            const indexCheck = await isDocxIndexed(indexedBuffer);
            if (!indexCheck.indexed) {
              console.log(`[API UPDATE-TEMPLATE] ⚠️ El document "indexat" no té SDTs vàlids. Forçant nova indexació...`);
              usingIndexedVersion = false;
              indexedBuffer = originalBuffer;
            }
          } else {
            console.log(`[API UPDATE-TEMPLATE] ℹ️ No s'ha trobat versió indexada prèvia`);
          }
        } catch (indexedFetchError) {
          console.log(`[API UPDATE-TEMPLATE] ℹ️ Error accedint a versió indexada:`, indexedFetchError);
        }
        
        // 2.2. Si no hi ha versió indexada vàlida, crear-la
        if (!usingIndexedVersion) {
          console.log(`[API UPDATE-TEMPLATE] 🔧 Indexant document original amb SDTs...`);
          
          try {
            // Verificar si el document original ja té SDTs
            const originalIndexCheck = await isDocxIndexed(originalBuffer);
            
            if (originalIndexCheck.indexed) {
              console.log(`[API UPDATE-TEMPLATE] ✅ Document original ja té ${originalIndexCheck.docproofSdtCount} SDTs`);
              indexedBuffer = originalBuffer;
            } else {
              console.log(`[API UPDATE-TEMPLATE] 🔨 Aplicant indexació automàtica...`);
              const indexingResult = await indexDocxWithSdts(originalBuffer);
              indexedBuffer = indexingResult.indexedBuffer;
              
              console.log(`[API UPDATE-TEMPLATE] ✅ Document indexat amb ${indexingResult.idMap.length} paràgrafs`);
              
              // Guardar la versió indexada per futures utilitzacions
              try {
                const { error: saveIndexedError } = await supabase.storage
                  .from('template-docx')
                  .upload(indexedPath, indexedBuffer, {
                    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    upsert: true
                  });
                  
                if (saveIndexedError) {
                  console.warn(`[API UPDATE-TEMPLATE] ⚠️ No s'ha pogut guardar la versió indexada:`, saveIndexedError);
                } else {
                  console.log(`[API UPDATE-TEMPLATE] 💾 Versió indexada guardada a: ${indexedPath}`);
                }
              } catch (saveError) {
                console.warn(`[API UPDATE-TEMPLATE] ⚠️ Error guardant versió indexada:`, saveError);
              }
            }
          } catch (indexingError) {
            console.error(`[API UPDATE-TEMPLATE] ❌ Error durant la indexació:`, indexingError);
            console.log(`[API UPDATE-TEMPLATE] 🔄 Continuant amb la funció legacy...`);
            
            // Fallback a la funció legacy
            const placeholderBuffer = await generatePlaceholderDocx(
              originalBuffer,
              body.link_mappings ?? [],
              body.ai_instructions ?? []
            );
            
            // Saltar a la secció de pujada
            console.log(`[API UPDATE-TEMPLATE] 📤 Utilitzant generació legacy...`);
            const legacyPlaceholderPath = originalPathToUse.replace('/original/original.docx', '/placeholder/placeholder.docx');
            
            const { data: legacyUploadData, error: legacyUploadError } = await supabase.storage
              .from('template-docx')
              .upload(legacyPlaceholderPath, placeholderBuffer, {
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                upsert: true
              });
              
            if (!legacyUploadError && legacyUploadData) {
              await supabase
                .from('plantilla_configs')
                .update({ placeholder_docx_storage_path: legacyUploadData.path })
                .eq('id', id)
                .eq('user_id', userId);
              (updatedTemplate as any).placeholder_docx_storage_path = legacyUploadData.path;
              
              return NextResponse.json({ 
                template: updatedTemplate, 
                placeholderDocxPath: legacyUploadData.path,
                placeholderStatus: 'generated_legacy'
              }, { status: 200 });
            }
            
            throw indexingError;
          }
        }
        
        // 3. Validar i mapejar les instruccions d'IA segons el pla de l'arquitecte
        console.log(`[API UPDATE-TEMPLATE] 🔍 Validant instruccions d'IA...`);
        const validatedAiInstructions: AIInstruction[] = (body.ai_instructions || []).map((instr: any) => {
          if (!instr.id || !instr.paragraphId) {
            // Ometem instruccions sense dades essencials
            console.warn('Ometent instrucció d\'IA invàlida:', instr);
            return null;
          }
          return {
            id: instr.id,
            paragraphId: instr.paragraphId,
            originalParagraphText: instr.originalParagraphText || '',
            status: instr.status || 'saved',
            order: instr.order || 0,
            prompt: instr.prompt || instr.content || '', // Assegurem que 'prompt' sempre existeix
            useExistingText: instr.useExistingText ?? true, // Valor per defecte 'true'
          };
        }).filter(Boolean) as AIInstruction[]; // Filtrem els nuls per seguretat

        console.log(`[API UPDATE-TEMPLATE] ✅ Validades ${validatedAiInstructions.length} instruccions d'IA`);
        
        // 4. Generar placeholder amb la nova funció basada en IDs
        console.log(`[API UPDATE-TEMPLATE] 🎯 Generant placeholder amb tecnologia SDT...`);
        console.log(`[API UPDATE-TEMPLATE] Mappings: ${body.link_mappings?.length || 0} links, ${validatedAiInstructions.length} instruccions AI validades`);
        
        const placeholderBuffer = await generatePlaceholderDocxWithIds(
          indexedBuffer,
          body.link_mappings ?? [],
          validatedAiInstructions // Passem l'array validat i amb el tipus correcte
        );
        
        console.log(`[API UPDATE-TEMPLATE] ✅ Placeholder generat amb èxit: ${placeholderBuffer.length} bytes`);
        
        // 4. Determinar la ruta de placeholder correctament
        let placeholderPath = '';
        
        console.log(`[API UPDATE-TEMPLATE] Processant ruta original: ${originalPathToUse}`);
        
        // Mètode 1: Si la ruta segueix exactament el patró esperat
        if (originalPathToUse && originalPathToUse.includes('/original/original.docx')) {
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
          await supabase.storage
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
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('template-docx')
          .upload(placeholderPath, placeholderBuffer, {
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            upsert: true
          });
          
        if (uploadError) {
          console.error('[API UPDATE-TEMPLATE] Error pujant placeholder:', uploadError);
          throw uploadError;
        }
            await supabase
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
