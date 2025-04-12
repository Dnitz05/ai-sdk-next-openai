// app/api/process-document/route.ts

import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth'; // Importem la biblioteca instal·lada

export async function POST(request: NextRequest) {
  console.log("API /api/process-document rebuda petició POST");

  try {
    // 1. Obtenir les dades del formulari (que inclouen el fitxer)
    const formData = await request.formData();
    const file = formData.get('file') as File | null; // 'file' és el nom que li donem al camp d'input al formulari del frontend

    // 2. Validar que s'ha rebut un fitxer
    if (!file) {
      console.error("No s'ha trobat cap fitxer a la petició.");
      return NextResponse.json({ error: 'No s\'ha pujat cap fitxer' }, { status: 400 });
    }

    // 3. Validar el tipus de fitxer (opcional però recomanat)
    if (file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
         console.warn(`Tipus de fitxer rebut no esperat: ${file.type}`);
         // Podries rebutjar-lo si vols ser estricte
         // return NextResponse.json({ error: 'Tipus de fitxer no suportat, si us plau puja un .docx' }, { status: 415 });
    }

    console.log(`Fitxer rebut: ${file.name}, Mida: ${file.size} bytes, Tipus: ${file.type}`);

    // 4. Llegir el contingut del fitxer com a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. Utilitzar Mammoth per convertir el buffer a HTML
    console.log("Iniciant conversió amb Mammoth...");
    const result = await mammoth.convertToHtml({ buffer });
    const html = result.value; // El HTML generat
    const messages = result.messages; // Mammoth pot retornar missatges (avisos, errors lleus)

    // ---- LÍNIA AFEGIDA PER DEPURAR ----
    console.log("===== HTML Generat (Primers 1000 caràcters) =====");
    console.log(html.substring(0, 1000)); // Mostrem un tros per inspeccionar
    console.log("================================================");
    // ------------------------------------

    if (messages && messages.length > 0) {
        console.warn("Missatges de Mammoth durant la conversió:", messages);
    }

    console.log("Conversió amb Mammoth completada.");

    // 6. Retornar l'HTML generat al frontend
    return NextResponse.json({ html: html, messages: messages });

  } catch (error) {
    console.error("Error processant el document:", error);
    // Retorna un error genèric al client per seguretat
    return NextResponse.json({ error: 'Error intern processant el document', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}