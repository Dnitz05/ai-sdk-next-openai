// app/api/save-configuration/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/serverClient' // Assumint que existeix per obtenir l'usuari
import { createClient } from '@supabase/supabase-js'
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

    // Obtenir usuari actual
    // const cookieStore = cookies(); // Si createServerSupabaseClient no ho gestiona
    const supabase = await createServerSupabaseClient(); // Aquest client hauria de poder llegir la sessió
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      console.error("[API save-configuration] Error obtenint informació de l'usuari:", userError);
      return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 });
    }
    
    const userId = userData.user.id;
    console.log("[API save-configuration] Usuari autenticat identificat:", userId);
    
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

    return NextResponse.json(
      { message: 'Configuració desada correctament!', templateId: insertedData?.id },
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
