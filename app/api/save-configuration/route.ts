// app/api/save-configuration/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { generatePlaceholderDocx } from '@util/generatePlaceholderDocx';

// Interfície unificada per a les instruccions d'IA
interface IAInstruction {
  id: string;
  paragraphId?: string;
  content?: string;
  prompt?: string;
  status?: string;
  order?: number;
}

interface SaveConfigPayload {
  id: string; // UUID generat pel frontend
  baseDocxName: string | null; // Nom original del fitxer DOCX
  config_name?: string;
  excelInfo: { fileName: string | null; headers: string[] | null; excelStoragePath?: string | null } | null;
  linkMappings: { id: string; excelHeader: string; selectedText: string }[];
  aiInstructions: IAInstruction[]; // Antic format
  ai_instructions?: IAInstruction[]; // Nou format
  finalHtml: string;
  originalDocxPath?: string | null; // Ruta del DOCX original a Supabase Storage
}

export async function POST(request: NextRequest) {
  console.log("[API save-configuration] Rebuda petició POST");
  try {
    const configurationData = (await request.json()) as SaveConfigPayload;
    console.log("[API save-configuration] Dades rebudes:", JSON.stringify(configurationData, null, 2).substring(0, 500) + "...");

    // Validacions bàsiques
    if (!configurationData || typeof configurationData !== 'object') {
      return NextResponse.json({ error: 'Payload invàlid.' }, { status: 400 });
    }
    if (!configurationData.id || typeof configurationData.id !== 'string') {
      return NextResponse.json({ error: 'El camp "id" (UUID del frontend) és obligatori.' }, { status: 400 });
    }
    if (typeof configurationData.finalHtml !== 'string' || configurationData.finalHtml.length === 0) {
      return NextResponse.json({ error: 'finalHtml obligatori i ha de ser string.' }, { status: 400 });
    }

    // Crear client SSR per autenticació
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

    // Obtenir userId de la sessió
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[API save-configuration] Error obtenint informació de l'usuari:", authError);
      return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 });
    }
    
    const userId = user.id;
    console.log("[API save-configuration] Usuari autenticat:", userId);
    
    console.log("[API save-configuration] Client creat, preparant dades...");

    // Processament de ai_instructions (lògica existent)
    let processedAiInstructions: IAInstruction[];
    if (Array.isArray(configurationData.ai_instructions)) {
      processedAiInstructions = configurationData.ai_instructions;
    } else if (Array.isArray(configurationData.aiInstructions)) {
      processedAiInstructions = configurationData.aiInstructions.map((instr: any) => ({
        id: instr.id || `ia-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        paragraphId: instr.originalText || '', // Ajustar segons la definició real
        content: instr.prompt || '',
        prompt: instr.prompt || '',
        status: instr.status || 'saved',
        order: instr.order || 0
      }));
    } else {
      processedAiInstructions = [];
    }

    // ✅ SOLUCIÓ BUG: Consultar camps Excel existents abans de l'UPSERT (RLS filtra automàticament)
    console.log("[API save-configuration] Consultant camps Excel existents...");
    const { data: existingTemplate, error: queryError } = await supabase
      .from('plantilla_configs')
      .select('excel_storage_path, excel_file_name, excel_headers')
      .eq('id', configurationData.id)
      .single();

    if (queryError && queryError.code !== 'PGRST116') { // PGRST116 = no trobat (OK per plantilles noves)
      console.error("[API save-configuration] Error consultant plantilla existent:", queryError);
      return NextResponse.json({ 
        error: `Error consultant plantilla: ${queryError.message}` 
      }, { status: 500 });
    }

    console.log("[API save-configuration] Plantilla existent:", {
      hasExcel: !!existingTemplate?.excel_storage_path,
      excel_storage_path: existingTemplate?.excel_storage_path || 'NULL',
      excel_file_name: existingTemplate?.excel_file_name || 'NULL'
    });

    const configToInsert = {
      id: configurationData.id, // Utilitzem l'UUID del frontend com a ID
      user_id: userId,
      config_name: configurationData.config_name || configurationData.baseDocxName || 'Sense nom',
      base_docx_name: configurationData.baseDocxName, // Nom original del fitxer
      base_docx_storage_path: configurationData.originalDocxPath || null, // Ruta a Storage
      // ✅ SOLUCIÓ: Utilitzar dades d'Excel del frontend amb fallback a existents
      excel_storage_path: configurationData.excelInfo?.excelStoragePath || existingTemplate?.excel_storage_path || null,
      excel_file_name: configurationData.excelInfo?.fileName || existingTemplate?.excel_file_name || null,
      excel_headers: configurationData.excelInfo?.headers || existingTemplate?.excel_headers || null,
      link_mappings: configurationData.linkMappings || [],
      ai_instructions: processedAiInstructions,
      final_html: configurationData.finalHtml,
      // created_at i updated_at seran gestionats per la BD (DEFAULT now())
    };

    console.log("[API save-configuration] Configuració a inserir (amb camps Excel preservats):", {
      excel_storage_path: configToInsert.excel_storage_path || 'NULL',
      excel_file_name: configToInsert.excel_file_name || 'NULL',
      preservedFromExisting: !!existingTemplate?.excel_storage_path
    });

    console.log("[API save-configuration] Iniciant operació UPSERT amb payload:", JSON.stringify(configToInsert, null, 2));
    
    // Implementem UPSERT per manejar tant insercions com actualitzacions (RLS filtra automàticament)
    const { data: upsertedData, error: dbError } = await supabase
      .from('plantilla_configs')
      .upsert([configToInsert], { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (dbError) {
      console.error("[API save-configuration] Error detallat d'UPSERT:", dbError);
      
      let msg = 'Error al desar la configuració.';
      if (dbError.code === '23505') {
        msg = 'Error de duplicitat: Conflicte amb ID existent.';
      } else if (dbError.code === '23503') {
        msg = 'Error d\'integritat referencial: Usuari no vàlid.';
      } else if (dbError.code === '23514') {
        msg = 'Error de validació: Dades invàlides.';
      } else if (dbError.code === '42501') {
        msg = 'Error de permisos: No autoritzat per aquesta operació.';
      }
      
      return NextResponse.json({ 
        error: msg, 
        details: dbError.message, 
        code: dbError.code,
        hint: dbError.hint 
      }, { status: 500 });
    }
    
    console.log("[API save-configuration] ✅ Operació UPSERT completada amb èxit. ID de la plantilla:", upsertedData?.id);

    // ==========================================
    // GENERACIÓ ROBUSTA DEL PLACEHOLDER
    // ==========================================
    let placeholderDocxPath = null;
    let placeholderGenerationStatus = 'not_required';
    
    // Verificar si cal generar placeholder
    const hasLinkMappings = (configurationData.linkMappings?.length ?? 0) > 0;
    const hasAiInstructions = (configurationData.ai_instructions?.length ?? 0) > 0 || 
                             (configurationData.aiInstructions?.length ?? 0) > 0;
    
    if (hasLinkMappings || hasAiInstructions) {
      console.log("[API save-configuration] Detecció de necessitat de placeholder:", {
        linkMappings: hasLinkMappings,
        aiInstructions: hasAiInstructions
      });
      
      // 1. Primer, intentar obtenir la ruta de la BD (que hauria d'estar actualitzada per upload-original-docx)
      console.log("[API save-configuration] Obtenint ruta del document original de la BD...");
      const { data: templateData, error: templateError } = await supabase
        .from('plantilla_configs')
        .select('base_docx_storage_path')
        .eq('id', configurationData.id)
        .single();
      
      let originalPathToUse = templateData?.base_docx_storage_path || configurationData.originalDocxPath;
      
      // 2. Si encara no tenim ruta, intentar recuperar-la
      if (!originalPathToUse) {
        console.log("[API save-configuration] Ruta no trobada a BD ni frontend. Intentant recuperació...");
        
        const probablePath = `user-${userId}/template-${configurationData.id}/original/original.docx`;
        
        try {
          const { data: fileExists } = await supabase.storage
            .from('template-docx')
            .download(probablePath);
            
          if (fileExists) {
            originalPathToUse = probablePath;
            // Actualitzar la BD immediatament (RLS filtra automàticament)
            await supabase
              .from('plantilla_configs')
              .update({ base_docx_storage_path: probablePath })
              .eq('id', configurationData.id);
            console.log(`[API save-configuration] ✅ Document recuperat: ${probablePath}`);
          }
        } catch (recoverError) {
          console.error("[API save-configuration] No s'ha pogut recuperar el document:", recoverError);
        }
      }
      
      // 3. Si tenim ruta, intentar generar placeholder
      if (originalPathToUse) {
        placeholderGenerationStatus = 'attempting';
        console.log(`[API save-configuration] Generant placeholder des de: ${originalPathToUse}`);
        
        try {
          console.log(`[API save-configuration] Intent de generar placeholder inicial per a: ${originalPathToUse}`);
          
          // 1. Descarregar el DOCX original
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('template-docx')
            .download(originalPathToUse);
            
          if (downloadError) {
            console.error('[API save-configuration] Error descarregant document original:', downloadError);
            throw downloadError;
          }
          
          if (!fileData || fileData.size === 0) {
            console.error('[API save-configuration] Document original buit o no trobat');
            throw new Error('Document original no disponible');
          }
          
          console.log(`[API save-configuration] Document original descarregat: ${fileData.size} bytes`);
          
          // 2. Convertir a buffer
          const arrayBuffer = await fileData.arrayBuffer();
          const originalBuffer = Buffer.from(arrayBuffer);
          
          // 3. Generar placeholder DOCX
          const aiInstructions = configurationData.ai_instructions || configurationData.aiInstructions || [];
          console.log(`[API save-configuration] Invocant generatePlaceholderDocx amb mappings:`, 
            { linkCount: configurationData.linkMappings?.length, aiCount: aiInstructions.length });
          
          const placeholderBuffer = await generatePlaceholderDocx(
            originalBuffer,
            configurationData.linkMappings || [],
            aiInstructions
          );
          
          // 4. Determinar la ruta de placeholder
          const placeholderPath = originalPathToUse.replace('/original/original.docx', '/placeholder/placeholder.docx');
          
          console.log(`[API save-configuration] Ruta placeholder: ${placeholderPath}`);
          
          // 5. Pujar el placeholder
          console.log(`[API save-configuration] Pujant placeholder de ${placeholderBuffer.length} bytes`);
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('template-docx')
            .upload(placeholderPath, placeholderBuffer, {
              contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              upsert: true
            });
            
          if (uploadError) {
            console.error('[API save-configuration] Error pujant placeholder:', uploadError);
            throw uploadError;
          }
          
          // 6. Actualitzar la BD amb la ruta del placeholder (RLS filtra automàticament)
          placeholderDocxPath = uploadData.path;
          placeholderGenerationStatus = 'success';
          console.log(`[API save-configuration] Placeholder generat amb èxit: ${uploadData.path}`);
          
          await supabase
            .from('plantilla_configs')
            .update({ placeholder_docx_storage_path: uploadData.path })
            .eq('id', configurationData.id);
            
        } catch (error) {
          console.error('[API save-configuration] Error generant placeholder:', error);
          placeholderGenerationStatus = 'failed';
          // No fallem completament - la plantilla ja està desada
        }
      } else {
        console.log("[API save-configuration] No hi ha document original, saltant generació de placeholder");
        placeholderGenerationStatus = 'no_original_document';
      }
    } else {
      console.log("[API save-configuration] No cal generar placeholder (sense mappings ni instruccions IA)");
    }

    return NextResponse.json(
      { 
        message: 'Configuració desada correctament!', 
        templateId: upsertedData?.id,
        placeholderDocxPath: placeholderDocxPath 
      },
      { status: 201 }
    );

  } catch (err) {
    console.error("[API save-configuration] Error general:", err);
    return NextResponse.json(
      { error: 'Error intern del servidor.', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Aquesta ruta GET no forma part del pla actual, es manté com estava.
  return NextResponse.json({ message: "GET request a save-configuration no implementat per a aquesta funcionalitat." }, { status: 405 });
}
