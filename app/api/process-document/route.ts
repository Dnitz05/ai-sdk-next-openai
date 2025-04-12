// app/api/process-document/route.ts

import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth'; // Importem la biblioteca instal·lada

export async function POST(request: NextRequest) {
  console.log("API /api/process-document rebuda petició POST");

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      console.error("No s'ha trobat cap fitxer a la petició.");
      return NextResponse.json({ error: 'No s\'ha pujat cap fitxer' }, { status: 400 });
    }

    if (file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
         console.warn(`Tipus de fitxer rebut no esperat: ${file.type}`);
         // Podries afegir validació més estricta aquí si cal
    }

    console.log(`Fitxer rebut: ${file.name}, Mida: ${file.size} bytes, Tipus: ${file.type}`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ---- CONFIGURACIÓ PER A TÍTOLS (H1-H4) ----
    // Definim un mapeig d'estils. Busca paràgrafs (<p>) que tinguin aplicat
    // l'estil de Word anomenat "Heading 1" (o "Títol 1", etc.) i els converteix a <h1>.
    // ":fresh" assegura que es crea una nova etiqueta cada cop, ":separator" podria usar-se per llistes.
    const styleMap = [
        "p[style-name='Heading 1'] => h1:fresh", // Anglès
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Títol 1'] => h1:fresh",    // Català (Nom comú)
        "p[style-name='Títol 2'] => h2:fresh",
        "p[style-name='Títol 3'] => h3:fresh",
        "p[style-name='Títol 4'] => h4:fresh",
        "p[style-name='Título 1'] => h1:fresh",    // Castellà (Nom comú)
        "p[style-name='Título 2'] => h2:fresh",
        "p[style-name='Título 3'] => h3:fresh",
        "p[style-name='Título 4'] => h4:fresh",
        // Afegeix aquí altres noms d'estil si els teus documents utilitzen noms personalitzats per als títols
    ];

    const mammothOptions = {
         styleMap: styleMap
         // Aquí es podrien afegir altres opcions de Mammoth si fossin necessàries
    };
    // ------------------------------------------

    console.log("Iniciant conversió amb Mammoth amb styleMap...");
    // Passem les opcions a la funció de conversió
    const result = await mammoth.convertToHtml({ buffer }, mammothOptions);
    const html = result.value;
    const messages = result.messages;

    // Mantenim el log per verificar el resultat
    console.log("===== HTML Generat amb StyleMap (Primers 1000 caràcters) =====");
    console.log(html.substring(0, 1000));
    console.log("============================================================");

    if (messages && messages.length > 0) {
        console.warn("Missatges de Mammoth durant la conversió:", messages);
    }

    console.log("Conversió amb Mammoth completada.");

    return NextResponse.json({ html: html, messages: messages });

  } catch (error) {
    console.error("Error processant el document:", error);
    return NextResponse.json({ error: 'Error intern processant el document', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}