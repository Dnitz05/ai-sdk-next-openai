// app/api/save-configuration/route.ts
import { NextRequest, NextResponse } from 'next/server';

// --- TODO: Importarem el client de Supabase en el següent pas ---
// import supabaseServerClient from '@/lib/supabase/server'; // Ajusta la ruta si cal

// Interfície per al payload esperat des del frontend
interface SaveConfigPayload {
    baseDocxName: string | null;
    excelInfo: {
        fileName: string | null;
        headers: string[] | null;
    } | null;
    linkMappings: { id: string; excelHeader: string; selectedText: string; }[]; // Vincles Excel
    aiInstructions: { id: string; prompt: string; originalText?: string; }[]; // Instruccions IA
    finalHtml: string; // L'HTML amb els marcadors finals
}

// Handler per a les peticions POST
export async function POST(request: NextRequest) {
    console.log("API Route /api/save-configuration: Petició POST rebuda.");

    try {
        // === PAS ACTUAL: Llegir les dades JSON del body ===
        const configurationData: SaveConfigPayload = await request.json();
        console.log("Dades rebudes del frontend:", configurationData);
        // Validació bàsica (es podria millorar amb Zod, etc.)
        if (!configurationData || typeof configurationData !== 'object') {
             throw new Error("Payload buit o invàlid.");
        }
        // Podríem afegir més validacions aquí si cal (ex: comprovar que linkMappings és un array)
        // =============================================

        // --- Aquí vindran els passos següents ---
        // 1. Inicialitzar client Supabase (servidor) -> Pròxim pas!
        // 2. Preparar les dades per a la inserció a la taula 'plantilla_configs'
        // 3. Executar la inserció: supabase.from('plantilla_configs').insert({...})
        // 4. Comprovar errors de la base de dades
        // 5. Retornar una resposta d'èxit (201 Created) amb l'ID de la config guardada?

        console.log("API Route /api/save-configuration: Lògica de desat a BD pendent...");

        // Mantenim la resposta temporal indicant que hem rebut les dades
        return NextResponse.json({
            message: "Dades rebudes correctament, desat pendent.",
            receivedData: configurationData // Opcional: retornar les dades rebudes per debug
        }, { status: 200 }); // Temporalment 200, serà 201 quan desm a BD

    } catch (error) {
        console.error("Error a /api/save-configuration:", error);
         // Error específic per JSON invàlid
         if (error instanceof SyntaxError) {
            return NextResponse.json({ error: 'Format JSON invàlid a la petició' }, { status: 400 }); // Bad Request
         }
         // Altres errors (incloent la nostra validació bàsica)
        return NextResponse.json({
             error: 'Error intern del servidor al processar la petició',
             details: error instanceof Error ? error.message : String(error) // Afegim detall de l'error si és possible
            }, { status: 500 });
    }
}

// Podem afegir handlers per a altres mètodes HTTP (GET, PUT, DELETE) si calgués en el futur
// export async function GET(request: NextRequest) { ... }