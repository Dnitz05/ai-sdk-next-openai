// app/api/save-configuration/route.ts
import { NextRequest, NextResponse } from 'next/server';
// === PAS 1: Importa el client de Supabase per al servidor ===
import { createUserSupabaseClient } from '@/lib/supabase/userClient';

// Interfície per al payload esperat
interface SaveConfigPayload {
    baseDocxName: string | null;
    excelInfo: { fileName: string | null; headers: string[] | null; } | null;
    linkMappings: { id: string; excelHeader: string; selectedText: string; }[];
    aiInstructions: { id: string; prompt: string; originalText?: string; }[];
    finalHtml: string;
}

// Handler per a les peticions POST (Guardar configuració)
export async function POST(request: NextRequest) {
    console.log("API Route /api/save-configuration: Petició POST rebuda.");

    // 1. Llegeix el token de l'Authorization header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'No autenticat. Falten credencials.' }, { status: 401 });
    }
    const accessToken = authHeader.replace('Bearer ', '').trim();

    try {
        // Llegir les dades JSON del body
        const configurationData: SaveConfigPayload = await request.json();
        console.log("Dades rebudes:", configurationData);
        if (!configurationData || typeof configurationData !== 'object') {
            throw new Error("Payload buit o invàlid.");
        }

        // DEBUG: Log del token rebut
        console.log("Token JWT rebut a l'API:", accessToken);

        // 2. Crea el client Supabase autenticat amb el token de l'usuari
        const supabase = createUserSupabaseClient(accessToken);

        // 3. Obté l'usuari autenticat
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
            return NextResponse.json({ error: 'No s\'ha pogut validar l\'usuari.' }, { status: 401 });
        }
        const userId = userData.user.id;
        // DEBUG: Log del userId obtingut
        console.log("userId obtingut via Supabase:", userId);

        // 4. Inserta la configuració amb el user_id autenticat
        const configToInsert = {
            // user_id sempre el del token autenticat, mai del frontend!
            user_id: userId,
            config_name: configurationData.baseDocxName || `Config ${new Date().toISOString()}`,
            base_docx_name: configurationData.baseDocxName,
            excel_file_name: configurationData.excelInfo?.fileName,
            excel_headers: configurationData.excelInfo?.headers,
            link_mappings: configurationData.linkMappings,
            ai_instructions: configurationData.aiInstructions
        };
        console.log("Intentant inserir a Supabase. user_id:", userId, "configToInsert:", JSON.stringify(configToInsert, null, 2));
        const { data: insertedData, error: dbError } = await supabase
            .from('plantilla_configs')
            .insert([configToInsert])
            .select()
            .single();

        if (dbError) {
            console.error("Error de Supabase al inserir:", dbError);
            console.error("Detalls complets de l'error Supabase:", JSON.stringify(dbError, null, 2));
            return NextResponse.json({
                error: 'Error al desar la configuració a la base de dades.',
                details: dbError.message,
                supabaseError: dbError
            }, { status: 500 });
        }

        console.log("Inserció a Supabase realitzada amb èxit. insertedData:", JSON.stringify(insertedData, null, 2));
        return NextResponse.json({
            message: "Configuració desada amb èxit!",
            configId: insertedData?.id,
            insertedData
        }, { status: 201 });

    } catch (error) {
        console.error("Error general a /api/save-configuration (POST):", error);
        if (error instanceof SyntaxError) {
            return NextResponse.json({ error: 'Format JSON invàlid' }, { status: 400 });
        }
        return NextResponse.json({
            error: 'Error intern del servidor al processar la petició',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

// Handler per a les peticions GET (Placeholder)
export async function GET(request: NextRequest) {
    console.log("API Route /api/save-configuration: Petició GET rebuda.");
    try {
        console.log("API Route /api/save-configuration (GET): Lògica pendent...");
        // Aquí podríem fer: const { data, error } = await supabaseServerClient.from('plantilla_configs').select('*');
        return NextResponse.json({ message: "Endpoint GET pendent d'implementar" }, { status: 200 });
    } catch (error) { /* ... gestió errors ... */ }
}