// app/
// api/save-configuration/route.ts
import { NextRequest, NextResponse } from 'next/server';
// === PAS 1: Importa el client de Supabase per al servidor ===
import { createUserSupabaseClient } from '@/lib/supabase/userClient';

// Interfície per al payload esperat
interface SaveConfigPayload {
    baseDocxName: string | null;
    config_name?: string; // Afegit camp opcional per coherència
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
        
        // Comprovem la mida del HTML per evitar problemes amb límits de Supabase
        if (configurationData.finalHtml && configurationData.finalHtml.length > 1000000) { // 1MB aproximadament
            console.warn("HTML molt gran, podria excedir límits de Supabase:", configurationData.finalHtml.length, "caràcters");
            return NextResponse.json({
                error: 'El contingut HTML és massa gran (més d\'1MB). Redueix el contingut o divideix-lo en parts més petites.',
                htmlSize: configurationData.finalHtml.length
            }, { status: 413 }); // Payload Too Large
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

        // 4. Prepara i valida les dades abans d'inserir
        // Assegurem que el format de les dades complexes sigui correcte per Postgres
        // Convert complex objects to JSON strings if needed
        const linkMappingsJson = Array.isArray(configurationData.linkMappings) 
            ? configurationData.linkMappings 
            : [];
            
        const aiInstructionsJson = Array.isArray(configurationData.aiInstructions)
            ? configurationData.aiInstructions
            : [];
            
        const excelHeadersArray = Array.isArray(configurationData.excelInfo?.headers)
            ? configurationData.excelInfo.headers
            : null;
            
        // 5. Inserta la configuració amb el user_id autenticat
        const configToInsert = {
            user_id: userId, // <- OBLIGATORI, exactament igual que la columna!
            config_name: configurationData.config_name || configurationData.baseDocxName || "Plantilla sense nom", // Utilitzem config_name explícit si existeix
            base_docx_name: configurationData.baseDocxName,
            excel_file_name: configurationData.excelInfo?.fileName,
            excel_headers: excelHeadersArray,
            // Assegurem-nos que els camps complexos són JSON vàlid per PostgreSQL
            link_mappings: linkMappingsJson,
            ai_instructions: aiInstructionsJson,
            final_html: configurationData.finalHtml ? configurationData.finalHtml : ''
        };
        console.log("Intentant inserir a Supabase. user_id:", userId, "TIPUS user_id:", typeof userId, "configToInsert:", JSON.stringify(configToInsert, null, 2));
        
        // Comprovar primer si la taula existeix
        const { error: tableCheckError } = await supabase
            .from('plantilla_configs')
            .select('id')
            .limit(1);
            
        if (tableCheckError) {
            console.error("Error verificant taula plantilla_configs:", tableCheckError);
            return NextResponse.json({
                error: "La taula plantilla_configs no existeix o no és accessible.",
                details: tableCheckError.message,
                code: tableCheckError.code
            }, { status: 500 });
        }
        
        // Si la taula existeix, fem la inserció
        const { data: insertedData, error: dbError } = await supabase
            .from('plantilla_configs')
            .insert([configToInsert])
            .select()
            .single();

        if (dbError) {
            console.error("Error de Supabase al inserir:", dbError);
            console.error("Codi d'error:", dbError.code);
            console.error("Detalls:", dbError.details);
            console.error("Suggeriment:", dbError.hint);
            console.error("Detalls complets de l'error Supabase:", JSON.stringify(dbError, null, 2));
            console.error("Valor user_id inserit:", userId, "TIPUS:", typeof userId);
            
            // Millorem el missatge d'error segons el codi
            let errorMessage = 'Error al desar la configuració a la base de dades.';
            if (dbError.code === "23502") {
                errorMessage = 'Error: Falta un camp obligatori a la base de dades.';
            } else if (dbError.code === "23505") {
                errorMessage = 'Error: Ja existeix una plantilla amb aquestes dades.';
            } else if (dbError.code === "42P01") {
                errorMessage = 'Error: La taula no existeix o no s\'hi pot accedir.';
            } else if (dbError.code?.startsWith("42")) {
                errorMessage = 'Error de sintaxi SQL o problema d\'estructura.';
            } else if (dbError.code?.startsWith("28")) {
                errorMessage = 'Error d\'autorització. Comprova les polítiques RLS.';
            }
            
            return NextResponse.json({
                error: errorMessage,
                details: dbError.message,
                code: dbError.code,
                hint: dbError.hint,
                supabaseError: dbError,
                userId: userId,
                userIdType: typeof userId
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
