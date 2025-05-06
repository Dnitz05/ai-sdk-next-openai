// app/api/process-document/route.ts

import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio'; // Mantenim Cheerio per netejar

export async function POST(request: NextRequest) {
  console.log("API /api/process-document rebuda petició POST");

  try {
    const formData = await request.formData();
    // Obtenim el valor associat a la clau 'file'
    const file = formData.get('file');

    // ---- COMPROVACIÓ CORREGIDA (DUCK TYPING) ----
    // Comprovem si 'file' és un objecte i té les propietats/mètodes essencials
    // Aquesta comprovació és segura en l'entorn Node.js
    if (
        !file ||
        typeof file !== 'object' ||
        !('arrayBuffer' in file) ||
        !('name' in file) ||
        !('size' in file) ||
        !('type' in file) ||
        typeof file.arrayBuffer !== 'function' // Assegura que arrayBuffer és una funció
       ) {
         console.error("L'element 'file' rebut no sembla un objecte File vàlid (format inesperat).");
         // Opcional: Log per depurar què s'ha rebut realment
         console.log("Tipus rebut:", typeof file);
         if (file && typeof file === 'object') console.log("Propietats rebudes:", Object.keys(file));
         return NextResponse.json({ error: 'No s\'ha pujat un fitxer vàlid (format inesperat)' }, { status: 400 });
    }
    // Si passem d'aquí, sabem que 'file' té l'aparença d'un fitxer
    // Ajudem TypeScript definint la forma esperada (sense usar 'File' del navegador)
    const fileObject = file as { name: string; size: number; type: string; arrayBuffer: () => Promise<ArrayBuffer> };
    // ---------------------------------------------

    // Ara utilitzem fileObject per accedir a les propietats/mètodes amb seguretat
    console.log(`Fitxer rebut: ${fileObject.name}, Mida: ${fileObject.size} bytes, Tipus: ${fileObject.type}`);

    // Obtenim l'ArrayBuffer i el convertim a Buffer de Node.js
    const arrayBuffer = await fileObject.arrayBuffer(); // Utilitzem fileObject
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
    // Passem el buffer a Mammoth
    const result = await mammoth.convertToHtml({ buffer: buffer }, mammothOptions);
    const rawHtml = result.value;
    const messages = result.messages;

    if (messages && messages.length > 0) { console.warn("Missatges de Mammoth:", messages); }

    // ---- Neteja d'HTML amb Cheerio i optimització de taules ----
    console.log("Netejant HTML generat per Mammoth...");
    const $ = cheerio.load(rawHtml);
    
    // Eliminar paràgrafs buits dins de cel·les
    $('td').each((_i, tdElement) => { 
      const $td = $(tdElement); 
      const $children = $td.children(); 
      if ($children.length === 1 && $children.is('p')) { 
        $td.html($children.html() || ''); 
      } 
    });
    
    // Corregir elements de bloc dins de paràgrafs
    $('p > h1, p > h2, p > h3, p > h4, p > h5, p > h6, p > table, p > ul, p > ol, p > div').each((_i, blockElement) => { 
      const $block = $(blockElement); 
      const $parentParagraph = $block.parent('p'); 
      if ($parentParagraph.length > 0) { 
        if (($parentParagraph.text() || '').trim() === ($block.text() || '').trim()) { 
          $parentParagraph.replaceWith($block); 
        } else { 
          $parentParagraph.before($block); 
        } 
      } 
    });
    
    // Optimització de taules: reduir l'altura per a què siguin més compactes
    console.log("Aplicant optimització a les taules...");
    
    // Aplicar estils directament a les taules per fer-les més compactes
    $('table').each((_i, tableElement) => {
      const $table = $(tableElement);
      
      // Aplicar estil a la taula principal
      $table.attr('style', 'border-collapse: collapse; width: 100%;');
      
      // Optimitzar files
      $table.find('tr').each((_j, trElement) => {
        $(trElement).attr('style', 'height: auto; line-height: 1;');
      });
      
      // Optimitzar cel·les
      $table.find('td, th').each((_k, cellElement) => {
        const $cell = $(cellElement);
        // Mantenir altres estils que puguin existir i afegir els nostres
        let existingStyle = $cell.attr('style') || '';
        // Eliminar propietats de line-height i padding existents per evitar conflictes
        existingStyle = existingStyle.replace(/line-height\s*:[^;]+;?/g, '');
        existingStyle = existingStyle.replace(/padding\s*:[^;]+;?/g, '');

        const compactStyle = 'padding: 1px 3px; line-height: normal; vertical-align: middle;';
        $cell.attr('style', (existingStyle.trim() + ' ' + compactStyle).trim());

        // Assegurar que els paràgrafs dins de les cel·les també tinguin interlineat sencillo i sense marge
        $cell.find('p').each((_l, pElement) => {
          const $p = $(pElement);
          let pExistingStyle = $p.attr('style') || '';
          // Eliminar propietats de line-height i margin existents
          pExistingStyle = pExistingStyle.replace(/line-height\s*:[^;]+;?/g, '');
          pExistingStyle = pExistingStyle.replace(/margin\s*:[^;]+;?/g, '');
          $p.attr('style', (pExistingStyle.trim() + ' margin: 0; line-height: normal;').trim());
        });
      });
    });
    
    const cleanedHtml = $('body').html() || '';
    console.log("Neteja d'HTML i optimització de taules (interlineat sencillo) completada.");
    // ---------------------------------------------

    // Retornem l'HTML netejat i els missatges
    console.log("Retornant resposta JSON amb HTML i missatges.");
    return NextResponse.json({ html: cleanedHtml, messages: messages });

  } catch (error) {
    console.error("Error CRÍTIC processant el document:", error); // Log més detallat de l'error
    // Retornem un error 500 amb detalls si és possible
    return NextResponse.json({
        error: 'Error intern processant el document',
        details: error instanceof Error ? error.message : String(error),
        // Opcional: Incloure stack trace en desenvolupament
        // stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
        },
        { status: 500 });
  }
}
