import { NextResponse } from 'next/server';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
// Ja NO necessitem 'google-auth-library' aquí si usem la inicialització directa amb 'credentials'
// Ja NO necessitem 'OpenAI'

// --- CONFIGURACIÓ GOOGLE (Verifica els teus valors!) ---
const GcpProjectId = '525028991447'; // <-- EL TEU PROJECT ID
const GcpLocation = 'eu';           // <-- LA TEVA REGIÓ
const GcpProcessorId = 'b3b358b89a09b30d'; // <-- L'ID DEL TEU PROCESSADOR
// ----------------------------------------------------

export const maxDuration = 180; // Mantenim temps per si Google triga
export const dynamic = 'force-dynamic';

// Funció per crear client Google Document AI (Igual que abans)
async function createDocumentAiClient() {
    console.log("Intentant crear client Document AI...");
    const encodedCredentials = process.env.GOOGLE_CREDENTIALS_BASE64;
    if (!encodedCredentials) { throw new Error('Configuració servidor incorrecta (Falten credencials Google).'); }
    try {
        const credentialsJsonString = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
        const credentials = JSON.parse(credentialsJsonString);
        const clientOptions = { credentials, apiEndpoint: `${GcpLocation}-documentai.googleapis.com` };
        console.log(`Opcions client: apiEndpoint=${clientOptions.apiEndpoint}, project_id=${credentials.project_id}`);
        const client = new DocumentProcessorServiceClient(clientOptions);
        console.log("Client Document AI creat.");
        return client;
    } catch (error: any) {
         console.error("Error inicialitzant Client Document AI:", error);
         if (error instanceof SyntaxError) { throw new Error(`Error parsejant credencials JSON: ${error.message}.`); }
         throw new Error(`Error inicialitzant client Google: ${error.message}`);
    }
}

// Endpoint POST (Simplificat: Només crida a Google)
export async function POST(req: Request) {
    console.log("Rebuda petició a /api/analyze-document-ai (v Google Directe)");
    try {
        const { pdfUrl } = await req.json();
        if (!pdfUrl) { return NextResponse.json({ error: 'pdfUrl requerida.' }, { status: 400 }); }
        console.log(`📄 Analitzant PDF: ${pdfUrl}`);

        // 1. Descarregar PDF de Blob
        console.log("Descarregant PDF...");
        const pdfResponse = await fetch(pdfUrl);
        if (!pdfResponse.ok) throw new Error(`No s'ha pogut descarregar PDF (${pdfResponse.status})`);
        const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
        const encodedPdf = pdfBuffer.toString('base64');
        console.log("✅ PDF descarregat i codificat.");

        // 2. Cridar a Google Document AI
        const client = await createDocumentAiClient();
        const name = `projects/${GcpProjectId}/locations/${GcpLocation}/processors/${GcpProcessorId}`;
        const request = { name, rawDocument: { content: encodedPdf, mimeType: 'application/pdf' } };
        console.log(`🤖 Enviant petició a Google Document AI (${GcpProcessorId})...`);
        const [result] = await client.processDocument(request);
        console.log(`✅ Resposta rebuda de Google.`);

        // 3. Validar i retornar la resposta de Google
        if (!result || !result.document) { throw new Error("Resposta invàlida de Google Document AI."); }
        console.log(`Anàlisi completada. Document té ${result.document.pages?.length || 0} pàgines.`);

        // Retornem NOMÉS l'objecte 'document' dins de 'result' per consistència amb frontend anterior
        return NextResponse.json({ result: result.document }); // <-- Retorna { result: ... }

    } catch (err: any) {
        console.error('❌ Error general a /api/analyze-document-ai (v Google Directe):', err);
        const detail = err.details || err.message || 'Error desconegut';
        let status = 500;
         if (detail.includes("permission") || detail.includes("PermissionDenied")) status = 403;
         if (detail.includes("credentials") || detail.includes("authentication")) status = 401;
         if (detail.includes("caller does not have permission")) status = 403;
         if (detail.includes("processors not found")) status = 404;
        return NextResponse.json({ error: `Error processant amb Document AI: ${detail}` }, { status });
    }
}
