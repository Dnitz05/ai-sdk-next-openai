// app/api/save-configuration/route.ts
import { NextRequest, NextResponse } from 'next/server';
// === PAS 1: Importa el client de Supabase per al servidor ===
import supabaseServerClient from '@/lib/supabase/server'; // Ajusta la ruta si cal (@/ apunta a l'arrel normalment)

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

    try {
        // Llegir les dades JSON del body
        const configurationData: SaveConfigPayload = await request.json();
        console.log("Dades rebudes:", configurationData);
        if (!configurationData || typeof configurationData !== 'object') {
             throw new Error("Payload buit o invàlid.");
        }

        // === PAS 2: Preparar i executar la inserció a Supabase ===
        console.log("Connectant a Supabase i intentant inserir...");

        // Mapeja les dades rebudes a les columnes de la taula
        // Nota: user_id i docx_storage_path estan pendents
        const { data: insertedData, error: dbError } = await supabaseServerClient
            .from('plantilla_configs') // Nom de la taula
            .insert([ // insert espera un array d'objectes
                {
                    // user_id: userId, // TODO: Obtenir d'una sessió d'usuari autenticat
                    config_name: configurationData.baseDocxName || `Config ${new Date().toISOString()}`, // Nom provisional si no ve
                    base_docx_name: configurationData.baseDocxName,
                    // docx_storage_path: 'PENDENT', // TODO: Gestionar la pujada del DOCX a Storage
                    excel_file_name: configurationData.excelInfo?.fileName,
                    excel_headers: configurationData.excelInfo?.headers, // Desa l'array directament a JSONB
                    link_mappings: configurationData.linkMappings,       // Desa l'array directament a JSONB
                    ai_instructions: configurationData.aiInstructions     // Desa l'array directament a JSONB
                    // created_at i updated_at s'haurien d'omplir automàticament pels valors per defecte de la BD
                }
            ])
            .select() // Demanem que retorni la fila insertada (opcional)
            .single(); // Esperem només una fila de resultat

        // === PAS 3: Comprovar errors de la base de dades ===
        if (dbError) {
            console.error("Error de Supabase al inserir:", dbError);
            // Retornem un error específic de la base de dades si és possible
            return NextResponse.json({
                error: 'Error al desar la configuració a la base de dades.',
                details: dbError.message
            }, { status: 500 });
        }

        // === PAS 4: Retornar resposta d'èxit ===
        console.log("Inserció a Supabase realitzada amb èxit:", insertedData);
        return NextResponse.json({
            message: "Configuració desada amb èxit!",
            configId: insertedData?.id // Retornem l'ID de la nova configuració creada
        }, { status: 201 }); // 201 Created

    } catch (error) {
        console.error("Error general a /api/save-configuration (POST):", error);
         if (error instanceof SyntaxError) { // Error llegint JSON
            return NextResponse.json({ error: 'Format JSON invàlid' }, { status: 400 });
         }
         // Altres errors (incloent validació manual o errors inesperats)
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