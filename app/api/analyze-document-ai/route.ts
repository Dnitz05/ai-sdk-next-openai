import { NextResponse } from 'next/server';
// Importem el client de Document AI
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
// NO necessitem importar GoogleAuth si passem credencials directament

// --- CONFIGURACIÓ IMPORTANT ---
// RECORDA VERIFICAR QUE AQUESTS VALORS SÓN ELS CORRECTES PER AL TEU PROJECTE!
const GcpProjectId = '525028991447'; // <-- EL TEU PROJECT ID (Ex: ...1447)
const GcpLocation = 'eu';           // <-- LA TEVA REGIÓ (Ex: 'eu', 'us')
const GcpProcessorId = 'b3b358b89a09b30d'; // <-- L'ID DEL TEU PROCESSADOR (Ex: el 'Form Parser'/'ailaw')
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

// Funció principal de l'endpoint POST (sense canvis respecte l'última versió híbrida)
export async function POST(req: Request) {
   // ... (Mantenim tota la lògica POST que ja teníem, amb la crida a Google i la crida a OpenAI per reformatar taules) ...
   // ... (Assegura't que el codi POST aquí és el de la resposta #175)...

    console.log("Rebuda petició a /api/analyze-document-ai (v Híbrida)");
    try {
        const { pdfUrl } = await req.json();
        if (!pdfUrl) { return NextResponse.json({ error: 'pdfUrl requerida.' }, { status: 400 }); }
        console.log(`📄 Analitzant PDF: ${pdfUrl}`);

        // --- PAS 1: Obtenir Anàlisi de Google Document AI ---
        console.log("Iniciant crida a Google Document AI...");
        const pdfResponse = await fetch(pdfUrl);
        if (!pdfResponse.ok) throw new Error(`No s'ha pogut descarregar PDF (${pdfResponse.status})`);
        const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
        const encodedPdf = pdfBuffer.toString('base64');
        const client = await createDocumentAiClient(); // Usa la funció corregida
        const name = `projects/${GcpProjectId}/locations/${GcpLocation}/processors/${GcpProcessorId}`;
        const request = { name, rawDocument: { content: encodedPdf, mimeType: 'application/pdf' } };
        const [result] = await client.processDocument(request);
        if (!result || !result.document) throw new Error("Resposta invàlida de Google Document AI.");
        console.log(`✅ Anàlisi de Google Document AI completada.`);
        const googleDocument = result.document;
        // -------------------------------------------------

        // --- PAS 2: Identificar i Reformatar Taules amb OpenAI ---
        const reformattedTables: { pageIndex: number; tableIndexOnPage: number; html: string }[] = [];
        if (googleDocument?.pages && openai) {
             console.log("Iniciant reformatació de taules amb OpenAI...");
             let tablePromises: Promise<void>[] = [];
             const fullText = googleDocument.text || ""; // Pass text for getText helper

             googleDocument.pages.forEach((page: any, pageIndex: number) => {
                 if (page.tables) {
                     page.tables.forEach((table: any, tableIndexOnPage: number) => {
                         const tableData: string[][] = [];
                         table.headerRows?.forEach((hRow: any) => { tableData.push(hRow.cells?.map((cell: any) => getText(cell.layout?.textAnchor, fullText)) ?? []); });
                         table.bodyRows?.forEach((bRow: any) => { tableData.push(bRow.cells?.map((cell: any) => getText(cell.layout?.textAnchor, fullText)) ?? []); });

                         if (tableData.length > 0) {
                              tablePromises.push( reformatTableWithOpenAI(tableData).then(htmlResult => { reformattedTables.push({ pageIndex, tableIndexOnPage, html: htmlResult }); }) );
                         }
                     });
                 }
             });
             await Promise.all(tablePromises);
             console.log(`✅ Reformatació de ${reformattedTables.length} taules completada.`);
        } else if (!openai) { console.warn("⚠️ OpenAI API Key no configurada, no es reformataran les taules.") }
        // -----------------------------------------------------

        // --- PAS 3: Retornar Resultats Combinats ---
        return NextResponse.json({ google_document: googleDocument, reformatted_tables: reformattedTables });
        // ------------------------------------------

    } catch (err: any) {
        // ... (Gestió d'errors igual que abans) ...
        console.error('❌ Error general a /api/analyze-document-ai (híbrid):', err);
        const detail = err.details || err.message || 'Error desconegut';
        let status = 500;
         if (detail.includes("permission") || detail.includes("PermissionDenied")) status = 403;
         if (detail.includes("credentials") || detail.includes("authentication")) status = 401;
         if (detail.includes("caller does not have permission")) status = 403;
         if (detail.includes("processors not found")) status = 404;
        return NextResponse.json({ error: `Error processant (híbrid): ${detail}` }, { status });
    }
}

// Funció Helper per extreure text (necessària dins de POST per accedir a googleDocument.text)
const getText = (textAnchor: any, fullText: string): string => {
    if (!textAnchor?.textSegments || !fullText) { return ''; } let extractedText = '';
    for (const segment of textAnchor.textSegments) {
      const startIndex = parseInt(segment?.startIndex || '0', 10);
      const endIndex = parseInt(segment?.endIndex || '0', 10);
      if (!isNaN(startIndex) && !isNaN(endIndex) && startIndex >= 0 && endIndex >= startIndex && endIndex <= fullText.length) {
           extractedText += fullText.substring(startIndex, endIndex);
      } else { console.warn("Segment índex invàlid:", segment); }
    } return extractedText;
};


// Funció per reformatar taula amb OpenAI (necessita accés al client openai)
async function reformatTableWithOpenAI(tableData: string[][]): Promise<string> {
    if (!openai) { throw new Error("OpenAI API Key no configurada."); }
    if (!tableData || tableData.length === 0) return '<table><tr><td>Taula buida</td></tr></table>';

    let tableMarkdown = "";
    if (tableData[0]) { tableMarkdown += `| ${tableData[0].join(' | ')} |\n| ${tableData[0].map(() => '---').join(' | ')} |\n`; }
    tableData.slice(1).forEach(row => { tableMarkdown += `| ${row.join(' | ')} |\n`; });

    const prompt = `Donada la següent taula (format Markdown):\n\n${tableMarkdown}\n\nGenera codi HTML per a aquesta taula. Utilitza <table>, <thead>, <tbody>, <tr>, <th> (per la primera fila), <td>. Aplica classes Tailwind: 'min-w-full text-sm border-collapse border border-slate-400' per <table>, 'bg-slate-100' per <thead>, 'border border-slate-300 px-4 py-2 text-left font-semibold text-slate-700' per <th>, 'border border-slate-300 px-4 py-2 align-top' per <td>, 'hover:bg-slate-50' per <tr> al tbody. Simplifica l'estructura visual si té sentit per claredat, preservant les dades. Retorna NOMÉS l'HTML de la taula.`;

    try {
        console.log(`🤖 Enviant dades taula a OpenAI (${OPENAI_MODEL_FOR_TABLES})...`);
        const response = await openai.chat.completions.create({
            model: OPENAI_MODEL_FOR_TABLES, messages: [{ role: "user", content: prompt }],
            temperature: 0.2, max_tokens: 1500,
        });
        const htmlResult = response.choices[0]?.message?.content?.trim() ?? '<table><tr><td>Error OpenAI</td></tr></table>';
        console.log(`✅ Taula HTML rebuda d'OpenAI.`);
        return htmlResult.replace(/^```html\s*|```\s*$/g, '').trim();
    } catch (error: any) {
        console.error("❌ Error OpenAI reformatant taula:", error);
        return `<table><tr><td>Error processant taula: ${error.message}</td></tr></table>`;
    }
}
