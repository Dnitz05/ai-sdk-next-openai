// app/api/process-document/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';

export async function POST(request: NextRequest) {
  console.log("API /api/process-document rebuda petició POST"); // Mantenim aquest log bàsic

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      console.error("No s'ha trobat cap fitxer a la petició.");
      return NextResponse.json({ error: 'No s\'ha pujat cap fitxer' }, { status: 400 });
    }

    // Ometem validació de tipus per simplicitat ara, però pots mantenir-la
    console.log(`Fitxer rebut: ${file.name}, Mida: ${file.size} bytes, Tipus: ${file.type}`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Configurem Mammoth (mantenim el styleMap)
    const styleMap = [
        "p[style-name='Heading 1'] => h1:fresh", "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh", "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Títol 1'] => h1:fresh", "p[style-name='Títol 2'] => h2:fresh",
        "p[style-name='Títol 3'] => h3:fresh", "p[style-name='Títol 4'] => h4:fresh",
        "p[style-name='Título 1'] => h1:fresh", "p[style-name='Título 2'] => h2:fresh",
        "p[style-name='Título 3'] => h3:fresh", "p[style-name='Título 4'] => h4:fresh",
        // Mantenim els mapejos per a estils de paràgraf si els vols provar després
        "p[style-name='Body Text 2'] => p:fresh",
        "p[style-name='Textoindependiente'] => p:fresh",
        "p[style-name='Sangradetextonormal'] => p:fresh",
    ];
    const mammothOptions = { styleMap: styleMap };

    console.log("Iniciant conversió amb Mammoth amb styleMap...");
    const result = await mammoth.convertToHtml({ buffer }, mammothOptions);
    const html = result.value; // HTML complet
    const messages = result.messages;

    // Eliminem el console.log de l'HTML d'aquí

    if (messages && messages.length > 0) {
        // Mantenim l'avís per als missatges de Mammoth
        console.warn("Missatges de Mammoth durant la conversió:", messages);
    }
    console.log("Conversió amb Mammoth completada."); // Mantenim aquest log

    // ---- MODIFICACIÓ AQUÍ ----
    // Creem un snippet per enviar al frontend per depurar
    const htmlSnippet = html.substring(0, 1500); // Enviem els primers 1500 caràcters

    // Retornem l'HTML complet, el snippet i els missatges
    return NextResponse.json({
        html: html, // L'HTML complet per renderitzar
        htmlSnippet: htmlSnippet, // El fragment per depurar a la consola del navegador
        messages: messages
    });
    // -------------------------

  } catch (error) {
    console.error("Error processant el document:", error);
    return NextResponse.json({ error: 'Error intern processant el document', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}