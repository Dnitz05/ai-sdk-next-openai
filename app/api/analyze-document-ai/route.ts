import { NextResponse } from 'next/server';
// Importem el client de Document AI i la llibreria d'autenticació
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
// NOTA: Ja no necessitem importar GoogleAuth aquí si passem credencials directament
// import { GoogleAuth } from 'google-auth-library'; // <- Eliminada o comentada

// --- CONFIGURACIÓ IMPORTANT ---
// Valors correctes per al teu projecte i el processador "Form Parser" ('ailaw')
const GcpProjectId = '525028991447'; // <-- El teu Project ID correcte
const GcpLocation = 'eu';           // <-- La teva Regió correcta
const GcpProcessorId = 'b3b358b89a09b30d'; // <-- L'ID del teu nou processador "Form Parser"
// --------------------------------

// Permetem temps suficient (requereix pla Pro a Vercel si > 60s)
export const maxDuration = 180; // 3 minuts
export const dynamic = 'force-dynamic';

// Funció auxiliar per crear el client de Document AI autenticat (VERSIÓ CORREGIDA)
async function createDocumentAiClient() {
    console.log("Intentant crear client Document AI...");
    const encodedCredentials = process.env.GOOGLE_CREDENTIALS_BASE64;
    if (!encodedCredentials) {
        console.error('ERROR FATAL: Variable d\'entorn GOOGLE_CREDENTIALS_BASE64 no definida a Vercel!');
        throw new Error('Configuració del servidor incorrecta (Falten credencials de Google).');
    }
    try {
        // Decodifiquem les credencials Base64
        const credentialsJsonString = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
        // Parsejem el JSON per obtenir l'objecte de credencials
        const credentials = JSON.parse(credentialsJsonString);
        console.log("Credencials Base64 llegides i decodificades.");

        // Configurem les opcions del client passant les credencials directament
        const clientOptions = {
            credentials, // <-- Passem l'objecte credentials directament
            apiEndpoint: `${GcpLocation}-documentai.googleapis.com`, // L'endpoint regional és correcte
        };
        // Log per verificar (sense mostrar la clau privada!)
        console.log(`Opcions del client Document AI: apiEndpoint=${clientOptions.apiEndpoint}, credentials project_id=${credentials.project_id}`);

        // Creem i retornem el client amb les opcions correctes
        const client = new DocumentProcessorServiceClient(clientOptions);
        console.log("Client Document AI creat amb èxit.");
        return client;

    } catch (error: any) {
         console.error("Error inicialitzant Document AI Client:", error);
         if (error instanceof SyntaxError) {
            // Error més específic si falla el parseig del JSON de les credencials
            throw new Error(`Error parsejant les credencials JSON de GOOGLE_CREDENTIALS_BASE64: ${error.message}. Verifica la variable a Vercel.`);
         }
         // Propaguem altres errors
         throw new Error(`Error inicialitzant client de Google: ${error.message}`);
    }
}

// Funció principal de l'endpoint POST
export async function POST(req: Request) {
    console.log("Rebuda petició a /api/analyze-document-ai");
    try {
        // 1. Obtenim la URL del PDF del cos de la petició
        const body = await req.json();
        const pdfUrl = body?.pdfUrl;

        if (!pdfUrl || typeof pdfUrl !== 'string') {
             console.warn("Petició invàlida: Falta 'pdfUrl' o no és un string.", body);
            return NextResponse.json({ error: 'No s\'ha proporcionat la URL del PDF al cos de la petició.' }, { status: 400 });
        }
        console.log(`📄 URL del PDF rebuda per analitzar: ${pdfUrl}`);

        // 2. Descarreguem el contingut del PDF des de la URL de Vercel Blob
        console.log("Descarregant PDF des de Vercel Blob...");
        const pdfResponse = await fetch(pdfUrl);
        if (!pdfResponse.ok || !pdfResponse.body) {
             console.error(`Error ${pdfResponse.status} descarregant PDF des de ${pdfUrl}.`);
             throw new Error(`No s'ha pogut descarregar el PDF (${pdfResponse.status}).`);
        }
        // Convertim la resposta a un Buffer
        const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
        console.log(`✅ PDF descarregat (${(pdfBuffer.length / 1024).toFixed(0)} KB)`);


        // 3. Codifiquem el PDF a Base64 (requerit per l'API de Google)
        const encodedPdf = pdfBuffer.toString('base64');
        console.log("PDF codificat a Base64.");

        // 4. Creem el client de Document AI (amb autenticació)
        const client = await createDocumentAiClient();

        // 5. Construïm el nom complet del processador
        const name = `projects/${GcpProjectId}/locations/${GcpLocation}/processors/${GcpProcessorId}`;
        console.log(`Nom del processador a utilitzar: ${name}`);


        // 6. Preparem la petició per a l'API `processDocument`
        const request = {
            name: name,
            rawDocument: { // Enviem el document directament
                content: encodedPdf,
                mimeType: 'application/pdf',
            },
            // Podem afegir 'processOptions' o 'fieldMask' si calgués més endavant
        };
        console.log("Petició a Google API preparada (sense mostrar contingut Base64).");

        // 7. Cridem a l'API de Google
        console.log(`🤖 Enviant petició a Google Document AI API...`);
        const [result] = await client.processDocument(request);
        console.log(`✅ Resposta rebuda de Google Document AI.`);

        // 8. Verifiquem mínimament la resposta
        if (!result || !result.document) {
            console.error("Resposta inesperada o buida de Document AI:", result);
            throw new Error("L'anàlisi de Document AI no ha retornat l'objecte 'document'.");
        }
        console.log(`Anàlisi completada. Document té ${result.document.pages?.length || 0} pàgines. Text inicial: "${result.document.text?.substring(0, 100)}..."`);


        // 9. Retornem NOMÉS l'objecte 'document', que conté tota l'anàlisi
        return NextResponse.json({ result: result.document });

    } catch (err: any) {
        console.error('❌ Error durant l\'execució de /api/analyze-document-ai:', err);
        // Intentem donar un missatge d'error útil al frontend
        const detail = err.details || err.message || 'Error desconegut';
        let status = 500;
         if (detail.includes("permission") || detail.includes("PermissionDenied")) status = 403;
         if (detail.includes("credentials") || detail.includes("authentication")) status = 401;
         if (detail.includes("caller does not have permission")) status = 403;
         if (detail.includes("processors not found")) status = 404; // Error comú si l'ID/Location és incorrecte

        // Retornem l'error en format JSON
        return NextResponse.json({ error: `Error processant amb Document AI: ${detail}` }, { status });
    }
}

