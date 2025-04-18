// app/
// api/save-configuration/route.ts
import { NextRequest, NextResponse } from 'next/server';
// PAS 1: Importa el helper de cookies i el client oficial per a route handlers
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createAnonClient } from '@supabase/supabase-js';

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
    // DEBUG: Llista de cookies rebudes
    const allCookies = await cookies();
    // Llista totes les cookies rebudes (async, compatible amb Next.js 14+)
    // Si getAll() existeix, mostra totes les cookies; si no, mostra només la sb-access-token
    if (typeof allCookies.getAll === 'function') {
        console.log("Cookies rebudes al backend:", allCookies.getAll());
    } else {
        console.log("Cookie sb-access-token:", allCookies.get('sb-access-token'));
    }

    // 1. [ELIMINAT] No cal llegir el token de l'Authorization header: Supabase utilitza la cookie sb-access-token.
    // La comprovació del header s'ha eliminat per confiar únicament en la cookie.

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

        // 2. Crea el client Supabase autenticat amb la cookie (només per obtenir la sessió)
        const supabase = createRouteHandlerClient({ cookies });

        // OPCIÓ A: Obté el token i crea un client manual amb header Authorization
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        // Crea el client manual amb el token
        // (importa createClient de '@supabase/supabase-js' a dalt si no hi és)
        // import { createClient } from '@supabase/supabase-js';
        const serverSupabase = createAnonClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: { headers: { Authorization: `Bearer ${accessToken}` } },
            auth:   { persistSession: false },
          }
        );

        // 3. Obté l'usuari autenticat
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
            return NextResponse.json({ error: 'No s\'ha pogut validar l\'usuari.' }, { status: 401 });
        }
        const userId = userData.user.id;
        // DEBUG: Log del userId obtingut
        console.log("userId obtingut via Supabase:", userId);

        // 4. Prepara i valida les dades abans d'inserir
        // Declarem les variables fora del bloc try per poder usar-les després
        let linkMappingsJson: string;
        let aiInstructionsJson: string;
        const excelHeadersArray = Array.isArray(configurationData.excelInfo?.headers)
            ? configurationData.excelInfo.headers
            : [];
            
        // Convertim explícitament les estructures complexes a JSON
        try {
            // Assegurem-nos que les dades són vàlides convertint-les a JSON
            linkMappingsJson = JSON.stringify(
                Array.isArray(configurationData.linkMappings) 
                ? configurationData.linkMappings 
                : []
            );
                
            aiInstructionsJson = JSON.stringify(
                Array.isArray(configurationData.aiInstructions)
                ? configurationData.aiInstructions
                : []
            );
                
            // Intentem parsejar el JSON per comprovar que és vàlid
            JSON.parse(linkMappingsJson);
            JSON.parse(aiInstructionsJson);
        } catch (jsonError) {
            console.error("Error processant JSON:", jsonError);
            return NextResponse.json({
                error: 'Format JSON invàlid a les dades enviades',
                details: jsonError instanceof Error ? jsonError.message : String(jsonError)
            }, { status: 400 });
        }
            
        // 5. Inserta la configuració amb el user_id autenticat
        const configToInsert = {
            user_id: userId, // <- OBLIGATORI, exactament igual que la columna!
            config_name: configurationData.config_name || configurationData.baseDocxName || "Plantilla sense nom", // Utilitzem config_name explícit si existeix
            base_docx_name: configurationData.baseDocxName,
            excel_file_name: configurationData.excelInfo?.fileName,
            excel_headers: excelHeadersArray,
            // Supabase utilitza PostgreSQL JSONB per als camps que contenen objectes.
            // Internament el client Supabase convertirà aquests objectes a JSONB.
            link_mappings: JSON.parse(linkMappingsJson),
            ai_instructions: JSON.parse(aiInstructionsJson),
            final_html: configurationData.finalHtml ? configurationData.finalHtml : ''
        };
        console.log("Intentant inserir a Supabase. user_id:", userId, "TIPUS user_id:", typeof userId, "configToInsert:", JSON.stringify(configToInsert, null, 2));
        // DEBUG: Mostra el JSON complet que s'intenta inserir
        console.log("DEBUG INSERT payload:", JSON.stringify(configToInsert, null, 2));
        
        // DEBUG: Mostra el token JWT utilitzat
        console.log("TOKEN JWT:", accessToken);

        // Prova d'insert mínim per validar RLS
        // const { data: insertedData, error: dbError } = await serverSupabase
        //     .from('plantilla_configs')
        //     .insert([{ user_id: userId, config_name: "test ràpid" }])
        //     .select()
        //     .single();

        // Un cop validat, inserim tots els camps
        const { data: insertedData, error: dbError } = await serverSupabase
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
