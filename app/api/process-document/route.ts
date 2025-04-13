// app/api/process-document/route.ts

import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';

export async function POST(request: NextRequest) {
  console.log("API /api/process-document rebuda petició POST");

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      console.error("No s'ha trobat cap fitxer a la petició.");
      return NextResponse.json({ error: 'No s\'ha pujat cap fitxer' }, { status: 400 });
    }

    console.log(`Fitxer rebut: ${file.name}, Mida: ${file.size} bytes, Tipus: ${file.type}`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // --- StyleMap actualitzat ---
    const styleMap = [
        // Mapejos de Títols (H1-H4)
        "p[style-name='Heading 1'] => h1:fresh", "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh", "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Títol 1'] => h1:fresh", "p[style-name='Títol 2'] => h2:fresh",
        "p[style-name='Títol 3'] => h3:fresh", "p[style-name='Títol 4'] => h4:fresh",
        "p[style-name='Título 1'] => h1:fresh", "p[style-name='Título 2'] => h2:fresh",
        "p[style-name='Título 3'] => h3:fresh", "p[style-name='Título 4'] => h4:fresh",

        // <<< NOUS MAPEJOS PER A PARÀGRAFS COMUNS >>>
        "p[style-name='Body Text'] => p:fresh",          // Per silenciar avís Textoindependiente
        "p[style-name='Body Text Indent'] => p:fresh",  // Per silenciar avís Sangradetextonormal
        "p[style-name='Body Text 2'] => p:fresh",       // Per silenciar avís BodyText2
        // <<< FI NOUS MAPEJOS >>>
    ];

    const mammothOptions = { styleMap: styleMap };
    // -----------------------------

    console.log("Iniciant conversió amb Mammoth amb styleMap actualitzat...");
    const result = await mammoth.convertToHtml({ buffer }, mammothOptions);
    const html = result.value;
    const messages = result.messages;

    // Eliminem el log de l'snippet, ja no cal
    // console.log("==== Snippet HTML Rebut del Backend ===="); ...

    // Mantenim l'avís per als missatges *restants* de Mammoth
    if (messages && messages.length > 0) {
        console.warn("Missatges de Mammoth durant la conversió:", messages);
    }
    console.log("Conversió amb Mammoth completada.");

    // Retornem només HTML complet i missatges (sense snippet)
    return NextResponse.json({
        html: html,
        messages: messages
    });

  } catch (error) {
    console.error("Error processant el document:", error);
    return NextResponse.json({ error: 'Error intern processant el document', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}