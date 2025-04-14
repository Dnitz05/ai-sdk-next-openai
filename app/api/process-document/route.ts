// app/api/process-document/route.ts

import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio'; // <<-- IMPORTEM CHEERIO

export async function POST(request: NextRequest) {
  console.log("API /api/process-document rebuda petició POST");

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) { /* ... error si no hi ha fitxer ... */ }
    console.log(`Fitxer rebut: ${file.name}`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // --- Opcions i StyleMap de Mammoth (sense canvis) ---
    const styleMap = [
        "p[style-name='Heading 1'] => h1:fresh", "p[style-name='Heading 2'] => h2:fresh", // ... resta de mapejos H1-H4 ...
        "p[style-name='Títol 1'] => h1:fresh", "p[style-name='Títol 2'] => h2:fresh", // ... resta ...
        "p[style-name='Título 1'] => h1:fresh", "p[style-name='Título 2'] => h2:fresh", // ... resta ...
        "p[style-name='Body Text'] => p:fresh", "p[style-name='Body Text Indent'] => p:fresh", "p[style-name='Body Text 2'] => p:fresh",
        // Mapeig H4 a classe signature-line (si es va decidir fer servir)
        // "p[style-name='Título 4'] => p.signature-line:fresh", ... etc ...
    ];
    const mammothOptions = { styleMap: styleMap };
    // ----------------------------------------------------

    console.log("Iniciant conversió amb Mammoth...");
    const result = await mammoth.convertToHtml({ buffer }, mammothOptions);
    const rawHtml = result.value; // HTML directe de Mammoth
    const messages = result.messages;

    if (messages && messages.length > 0) {
        console.warn("Missatges de Mammoth durant la conversió:", messages);
    }

    // ---- INICI Neteja d'HTML amb Cheerio ----
    console.log("Netejant HTML generat per Mammoth...");
    const $ = cheerio.load(rawHtml); // Carrega l'HTML a Cheerio

    // Regla 1: Treure <p> dins de <td> (causa comuna d'errors i espaiat)
    $('td').each((_i, tdElement) => {
      const $td = $(tdElement);
      const $children = $td.children();
      // Si només hi ha un fill i és <p>, substituïm el contingut del <td> pel contingut del <p>
      if ($children.length === 1 && $children.is('p')) {
        $td.html($children.html() || '');
      }
      // Es podria afegir lògica més complexa per a múltiples <p> si calgués
    });

    // Regla 2: Arreglar blocs (hN, table, ul, ol) dins de <p>
    $('p > h1, p > h2, p > h3, p > h4, p > h5, p > h6, p > table, p > ul, p > ol, p > div').each((_i, blockElement) => {
        const $block = $(blockElement);
        const $parentParagraph = $block.parent('p');
        if ($parentParagraph.length > 0) {
            // Si el paràgraf només conté aquest bloc (i potser espais buits)
            if (($parentParagraph.text() || '').trim() === ($block.text() || '').trim()) {
                $parentParagraph.replaceWith($block); // Reemplacem <p><block/></p> per <block/>
            } else {
                 // Si hi ha text barrejat, simplement movem el bloc abans del paràgraf
                 $parentParagraph.before($block);
            }
        }
    });

    // Extreu l'HTML netejat (normalment del body, o tot si cal)
    const cleanedHtml = $('body').html() || '';
    console.log("Neteja d'HTML completada.");
    // ---- FI Neteja d'HTML ----


    // Retornem l'HTML netejat i els missatges
    return NextResponse.json({
        html: cleanedHtml, // <<-- HTML NETEJAT
        // htmlSnippet: cleanedHtml.substring(0, 1500), // Snippet ja no cal per depurar #418
        messages: messages
    });

  } catch (error) {
    console.error("Error processant el document:", error);
    return NextResponse.json({ error: 'Error intern processant el document', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}