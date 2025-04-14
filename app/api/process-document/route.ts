// app/api/process-document/route.ts

import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio'; // Mantenim Cheerio per netejar

export async function POST(request: NextRequest) {
  console.log("API /api/process-document rebuda petició POST");

  try {
    const formData = await request.formData();
    // Obtenim el valor, podria ser File, string o null
    const file = formData.get('file');

    // ---- COMPROVACIÓ MILLORADA ----
    // Comprovem si realment és un objecte File i no és null o un string
    if (!(file instanceof File)) {
      console.error("No s'ha trobat un fitxer vàlid (File object) a la petició.");
      return NextResponse.json({ error: 'No s\'ha pujat un fitxer vàlid' }, { status: 400 });
    }
    // Si passem d'aquí, TypeScript sap que 'file' ÉS un objecte File i no pot ser null
    // ------------------------------

    // Ara podem accedir a les propietats de 'file' amb seguretat
    console.log(`Fitxer rebut: ${file.name}, Mida: ${file.size} bytes, Tipus: ${file.type}`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // --- Opcions i StyleMap de Mammoth (sense canvis) ---
    const styleMap = [
        "p[style-name='Heading 1'] => h1:fresh", "p[style-name='Heading 2'] => h2:fresh", "p[style-name='Heading 3'] => h3:fresh", "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Títol 1'] => h1:fresh", "p[style-name='Títol 2'] => h2:fresh", "p[style-name='Títol 3'] => h3:fresh", "p[style-name='Títol 4'] => h4:fresh",
        "p[style-name='Título 1'] => h1:fresh", "p[style-name='Título 2'] => h2:fresh", "p[style-name='Título 3'] => h3:fresh", "p[style-name='Título 4'] => h4:fresh",
        "p[style-name='Body Text'] => p:fresh", "p[style-name='Body Text Indent'] => p:fresh", "p[style-name='Body Text 2'] => p:fresh",
         // "p[style-name='Título 4'] => p.signature-line:fresh", // Mapeig H4 a signatura si s'escull
    ];
    const mammothOptions = { styleMap: styleMap };
    // ----------------------------------------------------

    console.log("Iniciant conversió amb Mammoth amb styleMap actualitzat...");
    const result = await mammoth.convertToHtml({ buffer }, mammothOptions);
    const rawHtml = result.value;
    const messages = result.messages;

    if (messages && messages.length > 0) { console.warn("Missatges de Mammoth:", messages); }

    // ---- Neteja d'HTML amb Cheerio (sense canvis) ----
    console.log("Netejant HTML generat per Mammoth...");
    const $ = cheerio.load(rawHtml);
    $('td').each((_i, tdElement) => { const $td = $(tdElement); const $children = $td.children(); if ($children.length === 1 && $children.is('p')) { $td.html($children.html() || ''); } });
    $('p > h1, p > h2, p > h3, p > h4, p > h5, p > h6, p > table, p > ul, p > ol, p > div').each((_i, blockElement) => { const $block = $(blockElement); const $parentParagraph = $block.parent('p'); if ($parentParagraph.length > 0) { if (($parentParagraph.text() || '').trim() === ($block.text() || '').trim()) { $parentParagraph.replaceWith($block); } else { $parentParagraph.before($block); } } });
    const cleanedHtml = $('body').html() || '';
    console.log("Neteja d'HTML completada.");
    // ---------------------------------------------

    // Retornem l'HTML netejat
    return NextResponse.json({ html: cleanedHtml, messages: messages });

  } catch (error) {
    console.error("Error processant el document:", error);
    return NextResponse.json({ error: 'Error intern processant el document', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}