// app/api/save-configuration/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/serverClient' // Assumint que existeix per obtenir l'usuari
import { createClient } from '@supabase/supabase-js'
import { createUserSupabaseClient } from '@/lib/supabase/userClient';
import { generatePlaceholderDocx } from '@util/generatePlaceholderDocx';
// import { cookies } from 'next/headers' // No es necessita si createServerSupabaseClient gestiona cookies

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
  excelInfo: { fileName: string | null; headers: string[] | null } | null;
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
    // ... (resta de validacions existents)

    // Autenticació de l’usuari: primer via header Authorization (Bearer), després cookies
    let userId: string | null = null;
    let userError: any = null;
    const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const accessToken = authHeader.slice(7).trim();
      try {
        const userClient = createUserSupabaseClient(accessToken);
        const { data: userDataAuth, error: authError } = await userClient.auth.getUser();
        if (!authError && userDataAuth.user) {
          userId = userDataAuth.user.id;
        } else {
          userError = authError;
        }
      } catch (e) {
        userError = e;
      }
    }
    if (!userId) {
      const supabaseServer = await createServerSupabaseClient();
      const { data: userDataAuth2, error: serverError } = await supabaseServer.auth.getUser();
      if (!serverError && userDataAuth2.user) {
        userId = userDataAuth2.user.id;
      } else {
        userError = serverError;
      }
    }
    if (!userId) {
      console.error("[API save-configuration] Error obtenint informació de l'usuari:", userError);
      return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 });
    }
    
    console.log("[API save-configuration] Usuari autenticat via JWT/cookie:", userId);
    
    // Client amb service role key per bypassejar RLS (només després de verificar l'usuari)
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    
    console.log("[API save-configuration] Client de servei creat, preparant dades...");

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

    const configToInsert = {
      id: configurationData.id, // Utilitzem l'UUID del frontend com a ID
      user_id: userId,
      config_name: configurationData.config_name || configurationData.baseDocxName || 'Sense nom',
      base_docx_name: configurationData.baseDocxName, // Nom original del fitxer
      base_docx_storage_path: configurationData.originalDocxPath || null, // Ruta a Storage
      excel_file_name: configurationData.excelInfo?.fileName ?? null,
      excel_headers: configurationData.excelInfo?.headers ?? [],
      link_mappings: configurationData.linkMappings || [],
      ai_instructions: processedAiInstructions,
      final_html: configurationData.finalHtml,
      // created_at i updated_at seran gestionats per la BD (DEFAULT now())
    };

    console.log("[API save-configuration] Iniciant inserció amb payload:", JSON.stringify(configToInsert, null, 2));
    
    const { data: insertedData, error: dbError } = await serviceClient
      .from('plantilla_configs')
      .insert([configToInsert]) // insert espera un array
      .select()
      .single();

    if (dbError) {
      console.error("[API save-configuration] Error detallat d'inserció:", dbError);
      // ... (gestió d'errors existent)
      let msg = 'Error al desar la configuració.';
      if (dbError.code === '23505') msg = 'Error de duplicitat: Ja existeix una plantilla amb aquest ID.';
      // ... (altres codis d'error)
      return NextResponse.json({ error: msg, details: dbError.message, code: dbError.code }, { status: 500 });
    }
    
    console.log("[API save-configuration] ✅ Inserció completada amb èxit. ID de la plantilla:", insertedData?.id);

    // Generació inicial del placeholder si hi ha originals
    let placeholderDocxPath = null;
    
    // Determinar ruta original i implementar recuperació si és necesari
    let originalPathToUse = configurationData.originalDocxPath;
    
    // Sistema de recuperació si la ruta és null però el document podria existir
    if (!originalPathToUse && 
        ((configurationData.linkMappings?.length ?? 0) > 0 || 
         (configurationData.ai_instructions?.length ?? 0) > 0 ||
         (configurationData.aiInstructions?.length ?? 0) > 0)) {
      console.log("[API save-configuration] Ruta original no trobada. Intentant construir-la automàticament...");
      
      // Construir ruta probable basat en convencions conegudes
      const probablePath = `user-${userId}/template-${configurationData.id}/original/original.docx`;
      console.log(`[API save-configuration] Verificant si existeix document a ruta reconstruïda: ${probablePath}`);
      
      try {
        // Verificar si existeix el fitxer o el directori
        const { data: fileListData } = await serviceClient.storage
          .from('template-docx')
          .list(`user-${userId}/template-${configurationData.id}/original`);
          
        if (fileListData && fileListData.length > 0) {
          console.log(`[API save-configuration] Directori existeix amb ${fileListData.length} fitxers:`, 
            fileListData.map(f => f.name).join(', '));
            
          // Buscar si hi ha algun fitxer .docx
          const docxFile = fileListData.find(f => f.name.toLowerCase().endsWith('.docx'));
          
          if (docxFile) {
            // S'ha trobat un fitxer .docx, reconstruïm la ruta completa
            const recoveredPath = `user-${userId}/template-${configurationData.id}/original/${docxFile.name}`;
            console.log(`[API save-configuration] ✅ Recuperat document: ${recoveredPath}`);
            
            // Actualitzar el configToInsert per incloure el path recuperat
            configToInsert.base_docx_storage_path = recoveredPath;
            await serviceClient
              .from('plantilla_configs')
              .update({ base_docx_storage_path: recoveredPath })
              .eq('id', configurationData.id);
              
            console.log(`[API save-configuration] ✅ BD actualitzada amb ruta recuperada`);
            originalPathToUse = recoveredPath;
          } else {
            console.log(`[API save-configuration] ⚠️ No s'ha trobat cap fitxer .docx al directori original`);
          }
        } else {
          console.log(`[API save-configuration] ⚠️ Directori no existeix o està buit`);
        }
      } catch (recoverError) {
        console.error("[API save-configuration] Error recuperant ruta del document:", recoverError);
      }
    }
    
    if (originalPathToUse && 
        ((configurationData.linkMappings?.length ?? 0) > 0 || 
         (configurationData.ai_instructions?.length ?? 0) > 0 ||
         (configurationData.aiInstructions?.length ?? 0) > 0)) {
      try {
        console.log(`[API save-configuration] Intent de generar placeholder inicial per a: ${originalPathToUse}`);
        
        // 1. Descarregar el DOCX original
        const { data: fileData, error: downloadError } = await serviceClient.storage
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
        
        // 4. Determinar la ruta de placeholder correctament
        let placeholderPath = '';
        
        // Assegurar que tenim un originalPathToUse string vàlid
        if (!originalPathToUse || typeof originalPathToUse !== 'string') {
          throw new Error('Ruta original no vàlida per generar placeholder');
        }
        
        console.log(`[API save-configuration] Processant ruta original: ${originalPathToUse}`);
        
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
        
        console.log(`[API save-configuration] Ruta original: ${originalPathToUse}`);
        console.log(`[API save-configuration] Ruta placeholder generada: ${placeholderPath}`);
        
        // 5. Assegurar que el directori existeix (crear .keep)
        const placeholderDir = placeholderPath.substring(0, placeholderPath.lastIndexOf('/'));
        try {
          console.log(`[API save-configuration] Assegurant directori: ${placeholderDir}`);
          await serviceClient.storage
            .from('template-docx')
            .upload(`${placeholderDir}/.keep`, new Uint8Array(0), { upsert: true });
          console.log(`[API save-configuration] Directori assegurat`);
        } catch (dirError: any) {
          // Ignorem errors si ja existeix el fitxer
          if (dirError?.message?.includes('duplicate') || dirError?.error?.includes('duplicate')) {
            console.log(`[API save-configuration] Directori ja existeix`);
          } else {
            console.warn(`[API save-configuration] Avís creant directori: ${dirError?.message || dirError}`);
            // Continuem tot i així, pot ser que funcioni
          }
        }
        
        // 6. Pujar el placeholder
        console.log(`[API save-configuration] Pujant placeholder de ${placeholderBuffer.length} bytes`);
        const { data: uploadData, error: uploadError } = await serviceClient.storage
          .from('template-docx')
          .upload(placeholderPath, placeholderBuffer, {
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            upsert: true
          });
          
        if (uploadError) {
          console.error('[API save-configuration] Error pujant placeholder:', uploadError);
          throw uploadError;
        }
        
        // 7. Actualitzar la BD amb la ruta del placeholder
        placeholderDocxPath = uploadData.path;
        console.log(`[API save-configuration] Placeholder pujat correctament. Actualitzant BD amb: ${uploadData.path}`);
        await serviceClient
          .from('plantilla_configs')
          .update({ placeholder_docx_storage_path: uploadData.path })
          .eq('id', configurationData.id)
          .eq('user_id', userId);
          
        console.log('[API save-configuration] Procés de placeholder completat amb èxit');
        
      } catch (error) {
        // Logging detallat per ajudar al diagnòstic
        console.error('[API save-configuration] Error generant placeholder.docx:', error);
        console.error('[API save-configuration] Detalls addicionals:', {
          templateId: configurationData.id,
          userId,
          originalPathExistent: !!configurationData.originalDocxPath,
          originalPath: configurationData.originalDocxPath,
          linkMappingsCount: configurationData.linkMappings?.length ?? 0,
          aiInstructionsCount: (configurationData.ai_instructions?.length ?? 0) + 
                              (configurationData.aiInstructions?.length ?? 0),
          errorName: error instanceof Error ? error.name : 'Unknown',
          errorMessage: error instanceof Error ? error.message : String(error)
        });
        
        // No fallem completament, continuem per retornar la resposta d'èxit
      }
    }

    return NextResponse.json(
      { 
        message: 'Configuració desada correctament!', 
        templateId: insertedData?.id,
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
