import { NextResponse } from 'next/server';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { GoogleAuth } from 'google-auth-library';
import OpenAI from 'openai'; // Importem OpenAI

// --- CONFIGURACIÓ GOOGLE ---
const GcpProjectId = '525028991447'; // <-- El teu Project ID
const GcpLocation = 'eu';           // <-- La teva Regió
const GcpProcessorId = 'b3b358b89a09b30d'; // <-- L'ID del teu "Form Parser"
// --------------------------

// --- CONFIGURACIÓ OPENAI ---
// Assegura't que tens la variable OPENAI_API_KEY configurada a Vercel
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const OPENAI_MODEL_FOR_TABLES = "gpt-4o-mini"; // O "gpt-3.5-turbo" - un model eficient per text
// --------------------------

export const maxDuration = 300; // Augmentem a 5 minuts (Pla Pro!) ja que fem dues crides
export const dynamic = 'force-dynamic';

// Funció per crear client Google Document AI (sense canvis)
async function createDocumentAiClient() { /* ... (codi igual que abans) ... */
    console.log("Intentant crear client Document AI..."); const encodedCredentials = process.env.GOOGLE_CREDENTIALS_BASE64; if (!encodedCredentials) { console.error('ERROR FATAL: Variable d\'entorn GOOGLE_CREDENTIALS_BASE64 no definida!'); throw new Error('Configuració del servidor incorrecta (Falten credencials de Google).'); } try { const credentialsJsonString = Buffer.from(encodedCredentials, 'base64').toString('utf-8'); const credentials = JSON.parse(credentialsJsonString); const auth = new GoogleAuth({ credentials, scopes: 'https://www.googleapis.com/auth/cloud-platform', }); const clientOptions = { auth: auth, apiEndpoint: `${GcpLocation}-documentai.googleapis.com`, }; console.log(`Opcions del client Document AI: apiEndpoint=${clientOptions.apiEndpoint}, project_id=${credentials.project_id}`); const client = new DocumentProcessorServiceClient(clientOptions); console.log("Client Document AI creat."); return client; } catch (error: any) { console.error("Error inicialitzant Google Auth o Document AI Client:", error); if (error instanceof SyntaxError) { throw new Error(`Error parsejant credencials JSON: ${error.message}.`); } throw new Error(`Error inicialitzant client Google: ${error.message}`); } }

// Funció Helper per extreure text (sense canvis)
const getText = (textAnchor: any, fullText: string): string => { /* ... (codi igual que abans) ... */
    if (!textAnchor?.textSegments || !fullText) { return ''; } let extractedText = ''; for (const segment of textAnchor.textSegments) { const startIndex = parseInt(segment?.startIndex || '0', 10); const endIndex = parseInt(segment?.endIndex || '0', 10); if (!isNaN(startIndex) && !isNaN(endIndex) && startIndex >= 0 && endIndex >= startIndex && endIndex <= fullText.length) { extractedText += fullText.substring(startIndex, endIndex); } else { console.warn("Segment índex invàlid:", segment); } } return extractedText; };

// --- NOU: Funció per reformatar una taula amb OpenAI ---
async function reformatTableWithOpenAI(tableData: string[][]): Promise<string> {
    if (!openai) { throw new Error("OpenAI API Key no configurada."); }
    if (!tableData || tableData.length === 0) return '<table></table>'; // Retorna taula buida si no hi ha dades

    // Convertim les dades de la taula a un format simple (ex: Markdown o JSON string) per al prompt
    // Markdown sol ser entenedor per la IA
    let tableMarkdown = "";
    if (tableData[0]) {
        tableMarkdown += `| ${tableData[0].join(' | ')} |\n`;
        tableMarkdown += `| ${tableData[0].map(() => '---').join(' | ')} |\n`;
    }
    tableData.slice(1).forEach(row => {
        tableMarkdown += `| ${row.join(' | ')} |\n`;
    });

    const prompt = `Donada la següent taula extreta d'un PDF (en format Markdown):\n\n${tableMarkdown}\n\nGenera el codi HTML per a aquesta taula. Utilitza etiquetes HTML estàndard (<table>, <thead>, <tbody>, <tr>, <th> per a la primera fila, <td> per la resta). Aplica classes bàsiques de Tailwind CSS per a un estil net: 'min-w-full text-sm border-collapse border border-slate-400' per a la <table>, 'bg-slate-100' per a <thead>, 'border border-slate-300 px-4 py-2 text-left font-semibold text-slate-700' per a <th>, 'border border-slate-300 px-4 py-2 align-top' per a <td>, i 'hover:bg-slate-50' per a <tr> al tbody. Simplifica l'estructura visual si sembla apropiat per a la claredat, però mantén tot el contingut textual. Retorna NOMÉS el codi HTML de la taula, sense comentaris ni text addicional.`;

    try {
        console.log(`🤖 Enviant dades de taula a OpenAI (${OPENAI_MODEL_FOR_TABLES})...`);
        const response = await openai.chat.completions.create({
            model: OPENAI_MODEL_FOR_TABLES,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2,
            max_tokens: 1500, // Ajustar segons mida esperada de taules
        });
        const htmlResult = response.choices[0]?.message?.content?.trim() ?? '<table><tr><td>Error generant HTML</td></tr></table>';
        console.log(`✅ Taula HTML rebuda d'OpenAI.`);
        // Simple neteja per si retorna ```html ... ```
        return htmlResult.replace(/^```html\s*|```\s*$/g, '').trim();
    } catch (error: any) {
        console.error("❌ Error cridant a OpenAI per reformatar taula:", error);
        return `<table><tr><td>Error al processar la taula amb OpenAI: ${error.message}</td></tr></table>`; // Retorna un error HTML
    }
}
// --- FI Funció OpenAI ---


export async function POST(req: Request) {
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
        const client = await createDocumentAiClient();
        const name = `projects/${GcpProjectId}/locations/${GcpLocation}/processors/${GcpProcessorId}`;
        const request = { name, rawDocument: { content: encodedPdf, mimeType: 'application/pdf' } };
        const [result] = await client.processDocument(request);
        if (!result || !result.document) throw new Error("Resposta invàlida de Google Document AI.");
        console.log(`✅ Anàlisi de Google Document AI completada.`);
        const googleDocument = result.document; // Guardem la resposta completa de Google
        // -------------------------------------------------

        // --- PAS 2: Identificar i Reformatar Taules amb OpenAI ---
        const reformattedTables: { pageIndex: number; tableIndexOnPage: number; html: string }[] = [];
        if (googleDocument?.pages && openai) { // Només si tenim pàgines i client OpenAI
             console.log("Iniciant reformatació de taules amb OpenAI...");
             let tablePromises: Promise<void>[] = [];

             googleDocument.pages.forEach((page: any, pageIndex: number) => {
                 if (page.tables) {
                     page.tables.forEach((table: any, tableIndexOnPage: number) => {
                         // Extreure dades de la taula del JSON de Google
                         const tableData: string[][] = [];
                         table.headerRows?.forEach((hRow: any) => {
                             tableData.push(hRow.cells?.map((cell: any) => getText(cell.layout?.textAnchor, googleDocument.text)) ?? []);
                         });
                         table.bodyRows?.forEach((bRow: any) => {
                             tableData.push(bRow.cells?.map((cell: any) => getText(cell.layout?.textAnchor, googleDocument.text)) ?? []);
                         });

                         // Afegim una promesa per reformatar aquesta taula
                         if (tableData.length > 0) {
                              tablePromises.push(
                                 reformatTableWithOpenAI(tableData).then(htmlResult => {
                                     reformattedTables.push({ pageIndex, tableIndexOnPage, html: htmlResult });
                                 })
                              );
                         }
                     });
                 }
             });
             // Esperem que totes les crides a OpenAI per a les taules acabin
             await Promise.all(tablePromises);
             console.log(`✅ Reformatació de ${reformattedTables.length} taules completada.`);
        } else if (!openai) {
             console.warn("⚠️ OpenAI API Key no configurada, no es reformataran les taules.")
        }
        // -----------------------------------------------------

        // --- PAS 3: Retornar Resultats Combinats ---
        // Enviem la resposta original de Google i les taules HTML reformatades
        return NextResponse.json({
             google_document: googleDocument,
             reformatted_tables: reformattedTables
            });
        // ------------------------------------------

    } catch (err: any) {
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
