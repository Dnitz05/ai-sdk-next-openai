import { NextResponse } from 'next/server';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { GoogleAuth } from 'google-auth-library';
import OpenAI from 'openai'; // <<--- IMPORTACIÓ OPENAI

// --- CONFIGURACIÓ GOOGLE ---
// RECORDA VERIFICAR AQUESTS VALORS!
const GcpProjectId = '525028991447'; // <-- El teu Project ID
const GcpLocation = 'eu';           // <-- La teva Regió
const GcpProcessorId = 'b3b358b89a09b30d'; // <-- L'ID del teu "Form Parser"
// --------------------------

// --- CONFIGURACIÓ OPENAI ---
// Assegura't que tens la variable OPENAI_API_KEY configurada a Vercel
// AQUESTA ÉS LA LÍNIA CLAU QUE POT FALTAR O SER INCORRECTA:
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const OPENAI_MODEL_FOR_TABLES = "gpt-4o-mini"; // Model per reformatar taules
// --------------------------

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Funció per crear client Google Document AI
async function createDocumentAiClient() { /* ... (codi igual que a la resposta #160) ... */
    console.log("Intentant crear client Document AI..."); const encodedCredentials = process.env.GOOGLE_CREDENTIALS_BASE64; if (!encodedCredentials) { console.error('ERROR FATAL: Variable GOOGLE_CREDENTIALS_BASE64 no definida!'); throw new Error('Configuració del servidor incorrecta (Falten credencials Google).'); } try { const credentialsJsonString = Buffer.from(encodedCredentials, 'base64').toString('utf-8'); const credentials = JSON.parse(credentialsJsonString); console.log("Credencials Base64 llegides."); const clientOptions = { credentials, apiEndpoint: `${GcpLocation}-documentai.googleapis.com`, }; console.log(`Opcions client: apiEndpoint=${clientOptions.apiEndpoint}, project_id=${credentials.project_id}`); const client = new DocumentProcessorServiceClient(clientOptions); console.log("Client Document AI creat."); return client; } catch (error: any) { console.error("Error inicialitzant Client Document AI:", error); if (error instanceof SyntaxError) { throw new Error(`Error parsejant credencials JSON: ${error.message}.`); } throw new Error(`Error inicialitzant client Google: ${error.message}`); } }

// Funció Helper per extreure text
const getText = (textAnchor: any, fullText: string): string => { /* ... (codi igual que a la resposta #175) ... */
    if (!textAnchor?.textSegments || !fullText) { return ''; } let extractedText = ''; for (const segment of textAnchor.textSegments) { const startIndex = parseInt(segment?.startIndex || '0', 10); const endIndex = parseInt(segment?.endIndex || '0', 10); if (!isNaN(startIndex) && !isNaN(endIndex) && startIndex >= 0 && endIndex >= startIndex && endIndex <= fullText.length) { extractedText += fullText.substring(startIndex, endIndex); } else { console.warn("Segment índex invàlid:", segment); } } return extractedText; };


// Funció per reformatar una taula amb OpenAI
async function reformatTableWithOpenAI(tableData: string[][]): Promise<string> {
    // Aquesta funció utilitza la constant 'openai' definida a dalt
    if (!openai) { throw new Error("OpenAI API Key no configurada."); }
    if (!tableData || tableData.length === 0) return '<table><tr><td>Taula buida rebuda</td></tr></table>';

    let tableMarkdown = "";
    try { // Afegim try-catch aquí per si tableData té problemes
      if (tableData[0]) { tableMarkdown += `| ${tableData[0].join(' | ')} |\n| ${tableData[0].map(() => '---').join(' | ')} |\n`; }
      tableData.slice(1).forEach(row => { tableMarkdown += `| ${row.join(' | ')} |\n`; });
    } catch (e: any) {
        console.error("Error generant Markdown per taula:", e, tableData);
        return `<table><tr><td>Error intern formatant dades taula: ${e.message}</td></tr></table>`;
    }


    const prompt = `Donada la següent taula extreta d'un PDF (format Markdown):\n\n${tableMarkdown}\n\nGenera codi HTML per a aquesta taula. Utilitza <table>, <thead>, <tbody>, <tr>, <th> (1a fila), <td>. Aplica classes Tailwind: 'min-w-full text-sm border-collapse border border-slate-400' per <table>, 'bg-slate-100' per <thead>, 'border border-slate-300 px-4 py-2 text-left font-semibold text-slate-700' per <th>, 'border border-slate-300 px-4 py-2 align-top' per <td>, 'hover:bg-slate-50' per <tr> al tbody. Simplifica l'estructura visual si té sentit per claredat, preservant les dades. Retorna NOMÉS l'HTML de la taula.`;

    try {
        console.log(`🤖 Enviant dades taula a OpenAI (${OPENAI_MODEL_FOR_TABLES})...`);
        const response = await openai.chat.completions.create({
            model: OPENAI_MODEL_FOR_TABLES, messages: [{ role: "user", content: prompt }],
            temperature: 0.2, max_tokens: 1500,
        });
        const htmlResult = response.choices[0]?.message?.content?.trim() ?? '<table><tr><td>Resposta buida OpenAI</td></tr></table>';
        console.log(`✅ Taula HTML rebuda d'OpenAI.`);
        return htmlResult.replace(/^```html\s*|```\s*$/g, '').trim();
    } catch (error: any) {
        console.error("❌ Error OpenAI reformatant taula:", error?.error?.message || error?.message || error);
        // Retornem un error HTML més informatiu si és possible
        const errorDetail = error?.error?.message || error?.message || "Desconegut";
        return `<table><tr><td>Error processant taula amb OpenAI: ${errorDetail}</td></tr></table>`;
    }
}

// Endpoint POST principal
export async function POST(req: Request) {
    console.log("Rebuda petició a /api/analyze-document-ai (v Híbrida)");
    try {
        const { pdfUrl } = await req.json();
        if (!pdfUrl) { return NextResponse.json({ error: 'pdfUrl requerida.' }, { status: 400 }); }
        console.log(`📄 Analitzant PDF: ${pdfUrl}`);

        // --- PAS 1: Google Document AI ---
        console.log("Iniciant crida a Google Document AI...");
        const pdfResponse = await fetch(pdfUrl);
        if (!pdfResponse.ok) throw new Error(`No s'ha pogut descarregar PDF (${pdfResponse.status})`);
        const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
        const encodedPdf = pdfBuffer.toString('base64');
        const client = await createDocumentAiClient();
        const name = `projects/${GcpProjectId}/locations/${GcpLocation}/processors/${GcpProcessorId}`;
        const request = { name, rawDocument: { content: encodedPdf, mimeType: 'application/pdf' } };
        const [result] = await client.processDocument(request);
        if (!result || !result.document) throw new Error("Resposta invàlida de Google Document AI.");
        console.log(`✅ Anàlisi Google AI completada.`);
        const googleDocument = result.document;
        const fullText = googleDocument.text || ""; // Guardem text per a getText
        // -----------------------------------

        // --- PAS 2: Reformatar Taules (OpenAI) ---
        const reformattedTables: { pageIndex: number; tableIndexOnPage: number; html: string }[] = [];
        if (googleDocument?.pages && openai) { // Només si tenim client OpenAI
             console.log("Iniciant reformatació de taules amb OpenAI...");
             let tablePromises: Promise<void>[] = [];
             googleDocument.pages.forEach((page: any, pageIndex: number) => {
                 if (page.tables) {
                     page.tables.forEach((table: any, tableIndexOnPage: number) => {
                         const tableData: string[][] = [];
                         // Extraiem dades amb getText, passant fullText
                         table.headerRows?.forEach((hRow: any) => { tableData.push(hRow.cells?.map((cell: any) => getText(cell.layout?.textAnchor, fullText)) ?? []); });
                         table.bodyRows?.forEach((bRow: any) => { tableData.push(bRow.cells?.map((cell: any) => getText(cell.layout?.textAnchor, fullText)) ?? []); });
                         if (tableData.length > 0) {
                              tablePromises.push( reformatTableWithOpenAI(tableData).then(htmlResult => { reformattedTables.push({ pageIndex, tableIndexOnPage, html: htmlResult }); }) );
                         }
                     });
                 }
             });
             await Promise.all(tablePromises); // Esperem totes les crides a OpenAI
             console.log(`✅ Reformatació de ${reformattedTables.length} taules completada.`);
        } else if (!openai) { console.warn("⚠️ OpenAI API Key no configurada, no es reformataran les taules.") }
        // ----------------------------------------

        // --- PAS 3: Retornar Resultats ---
        return NextResponse.json({ google_document: googleDocument, reformatted_tables: reformattedTables });
        // ---------------------------------

    } catch (err: any) {
        // ... (Gestió d'errors igual que abans) ...
        console.error('❌ Error general a /api/analyze-document-ai (híbrid):', err); const detail = err.details || err.message || 'Error desconegut'; let status = 500; if (detail.includes("permission") || detail.includes("PermissionDenied")) status = 403; if (detail.includes("credentials") || detail.includes("authentication")) status = 401; if (detail.includes("caller does not have permission")) status = 403; if (detail.includes("processors not found")) status = 404; return NextResponse.json({ error: `Error processant (híbrid): ${detail}` }, { status });
    }
}
