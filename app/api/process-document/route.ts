// app/api/process-document/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';

export async function POST(request: NextRequest) {
  console.log("API /api/process-document rebuda petició POST (versió actualitzada per llegir de Storage)");

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 1. Llegir el cos JSON per obtenir storagePath
    const body = await request.json();
    const storagePath = body.storagePath as string | undefined;

    if (!storagePath) {
      console.error("[API process-document] No s'ha proporcionat 'storagePath' al cos de la petició.");
      return NextResponse.json({ error: 'Falta la ruta del fitxer (storagePath).' }, { status: 400 });
    }

    console.log(`[API process-document] Intentant descarregar de Storage: ${storagePath}`);

    // 2. Descarregar el fitxer de Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('template-docx') // Nom del bucket
      .download(storagePath);

    if (downloadError) {
      console.error(`[API process-document] Error descarregant el fitxer '${storagePath}' de Supabase Storage:`, downloadError);
      return NextResponse.json({ error: 'Error descarregant el fitxer de Storage.', details: downloadError.message }, { status: 500 });
    }

    if (!fileData) {
        console.error(`[API process-document] No s'han rebut dades (fileData is null) per a '${storagePath}' de Supabase Storage.`);
        return NextResponse.json({ error: 'No s\'han pogut obtenir les dades del fitxer de Storage.'}, { status: 500 });
    }

    console.log(`[API process-document] Fitxer descarregat correctament de Storage. Mida del Blob: ${fileData.size} bytes`);

    // 3. Convertir el Blob a ArrayBuffer i després a Buffer de Node.js
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[API process-document] Buffer creat a partir del fitxer de Storage. Mida del buffer: ${buffer.length} bytes`);

    // --- Opcions i StyleMap de Mammoth (sense canvis) ---
    const styleMap = [
        "p[style-name='Heading 1'] => h1:fresh", "p[style-name='Heading 2'] => h2:fresh", "p[style-name='Heading 3'] => h3:fresh", "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Títol 1'] => h1:fresh", "p[style-name='Títol 2'] => h2:fresh", "p[style-name='Títol 3'] => h3:fresh", "p[style-name='Títol 4'] => h4:fresh",
        "p[style-name='Título 1'] => h1:fresh", "p[style-name='Título 2'] => h2:fresh", "p[style-name='Título 3'] => h3:fresh", "p[style-name='Título 4'] => h4:fresh",
        "p[style-name='Body Text'] => p:fresh", "p[style-name='Body Text Indent'] => p:fresh", "p[style-name='Body Text 2'] => p:fresh",
    ];
    const mammothOptions = { styleMap: styleMap };
    // ----------------------------------------------------

    console.log("[API process-document] Iniciant conversió amb Mammoth...");
    const result = await mammoth.convertToHtml({ buffer: buffer }, mammothOptions);
    const rawHtml = result.value;
    const messages = result.messages;

    if (messages && messages.length > 0) { console.warn("[API process-document] Missatges de Mammoth:", messages); }

    // ---- Neteja d'HTML amb Cheerio i optimització de taules (sense canvis) ----
    console.log("[API process-document] Netejant HTML generat per Mammoth...");
    const $ = cheerio.load(rawHtml);
    
    $('td').each((_i, tdElement) => { 
      const $td = $(tdElement); 
      const $children = $td.children(); 
      if ($children.length === 1 && $children.is('p')) { 
        $td.html($children.html() || ''); 
      } 
    });
    
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
    
    console.log("[API process-document] Aplicant optimització a les taules...");
    $('table').each((_i, tableElement) => {
      const $table = $(tableElement);
      $table.attr('style', 'border-collapse: collapse; width: 100%;');
      $table.find('tr').each((_j, trElement) => {
        $(trElement).attr('style', 'height: auto; line-height: 1;');
      });
      $table.find('td, th').each((_k, cellElement) => {
        const $cell = $(cellElement);
        let existingStyle = $cell.attr('style') || '';
        existingStyle = existingStyle.replace(/line-height\s*:[^;]+;?/g, '');
        existingStyle = existingStyle.replace(/padding\s*:[^;]+;?/g, '');
        const compactStyle = 'padding: 1px 3px; line-height: normal; vertical-align: middle;';
        $cell.attr('style', (existingStyle.trim() + ' ' + compactStyle).trim());
        $cell.find('p').each((_l, pElement) => {
          const $p = $(pElement);
          let pExistingStyle = $p.attr('style') || '';
          pExistingStyle = pExistingStyle.replace(/line-height\s*:[^;]+;?/g, '');
          pExistingStyle = pExistingStyle.replace(/margin\s*:[^;]+;?/g, '');
          $p.attr('style', (pExistingStyle.trim() + ' margin: 0; line-height: normal;').trim());
        });
      });
    });
    
    const cleanedHtml = $('body').html() || '';
    console.log("[API process-document] Neteja d'HTML i optimització de taules completada.");
    // ---------------------------------------------

    console.log("[API process-document] Retornant resposta JSON amb HTML i missatges.");
    return NextResponse.json({ html: cleanedHtml, messages: messages });

  } catch (error) {
    console.error("[API process-document] Error CRÍTIC processant el document:", error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconegut.';
    return NextResponse.json({
        error: 'Error intern processant el document',
        details: errorMessage,
        },
        { status: 500 });
  }
}
