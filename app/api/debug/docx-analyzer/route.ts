/**
 * Endpoint de diagnòstic per analitzar contingut XML de fitxers DOCX
 * Identifica placeholders problemàtics que causen errors de docxtemplater
 */

import { NextRequest, NextResponse } from 'next/server';
import supabaseServerClient from '@/lib/supabase/server';
import PizZip from 'pizzip';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templatePath, action = 'analyze' } = body;

    if (!templatePath) {
      return NextResponse.json(
        { success: false, error: 'templatePath és obligatori' },
        { status: 400 }
      );
    }

    console.log(`🔍 [DOCX-Analyzer] Analitzant: ${templatePath}`);

    // Descarregar el fitxer DOCX
    const { data, error } = await supabaseServerClient.storage
      .from('template-docx')
      .download(templatePath);

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: `Error descarregant fitxer: ${error?.message}` },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    console.log(`📥 [DOCX-Analyzer] Fitxer descarregat: ${buffer.length} bytes`);

    // Extreure contingut XML
    const zip = new PizZip(buffer);
    const documentXml = zip.file('word/document.xml')?.asText() || '';

    if (!documentXml) {
      return NextResponse.json(
        { success: false, error: 'No s\'ha trobat document.xml dins del DOCX' },
        { status: 400 }
      );
    }

    // Analitzar placeholders
    const analysis = analyzeDocumentXml(documentXml);

    if (action === 'analyze') {
      return NextResponse.json({
        success: true,
        templatePath,
        analysis,
        xmlLength: documentXml.length,
        xmlPreview: documentXml.substring(0, 500) + '...',
      });
    }

    if (action === 'clean') {
      const cleanedXml = cleanDocumentXml(documentXml);
      const cleanedAnalysis = analyzeDocumentXml(cleanedXml);

      // Crear nou DOCX amb XML netejat
      zip.file('word/document.xml', cleanedXml);
      const cleanedBuffer = zip.generate({ type: 'nodebuffer' });

      return NextResponse.json({
        success: true,
        templatePath,
        originalAnalysis: analysis,
        cleanedAnalysis,
        changes: {
          xmlLength: { before: documentXml.length, after: cleanedXml.length },
          placeholders: { 
            before: analysis.placeholders.length, 
            after: cleanedAnalysis.placeholders.length 
          },
        },
        cleanedDocumentBase64: cleanedBuffer.toString('base64'),
      });
    }

    return NextResponse.json(
      { success: false, error: 'Acció no vàlida. Usa "analyze" o "clean"' },
      { status: 400 }
    );

  } catch (error) {
    console.error(`❌ [DOCX-Analyzer] Error:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error intern analitzant DOCX',
        details: error instanceof Error ? error.message : 'Error desconegut',
      },
      { status: 500 }
    );
  }
}

/**
 * Analitza el contingut XML per detectar problemes amb placeholders
 */
function analyzeDocumentXml(xml: string) {
  const analysis = {
    placeholders: [] as string[],
    brokenPlaceholders: [] as string[],
    xmlTags: [] as string[],
    problems: [] as string[],
    statistics: {
      totalLength: xml.length,
      xmlTagCount: 0,
      placeholderCount: 0,
      brokenPlaceholderCount: 0,
    }
  };

  // Detectar placeholders complets
  const placeholderMatches = xml.match(/\{\{[^}]+\}\}/g) || [];
  analysis.placeholders = placeholderMatches;
  analysis.statistics.placeholderCount = placeholderMatches.length;

  // Detectar placeholders trencats
  const brokenOpenMatches = xml.match(/\{\{[^}]*(?!\}\})/g) || [];
  const brokenCloseMatches = xml.match(/(?<!\{\{)[^{]*\}\}/g) || [];
  analysis.brokenPlaceholders = [...brokenOpenMatches, ...brokenCloseMatches];
  analysis.statistics.brokenPlaceholderCount = analysis.brokenPlaceholders.length;

  // Detectar tags XML dins de placeholders
  const xmlInPlaceholders = xml.match(/\{\{[^}]*<[^>]*>[^}]*\}\}/g) || [];
  if (xmlInPlaceholders.length > 0) {
    analysis.problems.push(`${xmlInPlaceholders.length} placeholders contenen tags XML`);
    analysis.xmlTags = xmlInPlaceholders;
  }

  // Detectar duplicacions
  const duplicateOpen = xml.match(/\{\{\{\{/g) || [];
  const duplicateClose = xml.match(/\}\}\}\}/g) || [];
  if (duplicateOpen.length > 0) {
    analysis.problems.push(`${duplicateOpen.length} obertures duplicades {{{{`);
  }
  if (duplicateClose.length > 0) {
    analysis.problems.push(`${duplicateClose.length} tancaments duplicats }}}}`);
  }

  // Detectar tags XML generals
  const allXmlTags = xml.match(/<[^>]+>/g) || [];
  analysis.statistics.xmlTagCount = allXmlTags.length;

  // Detectar patrons problemàtics específics
  const problematicPatterns = [
    { pattern: /\{\{[^}]*\{\{/g, description: 'Placeholder amb obertura duplicada' },
    { pattern: /\}\}[^{]*\}\}/g, description: 'Placeholder amb tancament duplicat' },
    { pattern: /\{\{[^}]{100,}\}\}/g, description: 'Placeholder massa llarg (>100 chars)' },
    { pattern: /\{\{.*<w:.*\}\}/g, description: 'Placeholder amb tags Word específics' },
  ];

  problematicPatterns.forEach(({ pattern, description }) => {
    const matches = xml.match(pattern);
    if (matches) {
      analysis.problems.push(`${description}: ${matches.length} ocurrències`);
    }
  });

  return analysis;
}

/**
 * Neteja el contingut XML eliminant problemes comuns
 */
function cleanDocumentXml(xml: string): string {
  let cleaned = xml;
  let iterations = 0;
  const maxIterations = 20;

  console.log(`🧹 [XML-Cleaner] Iniciant neteja...`);

  while (iterations < maxIterations) {
    const before = cleaned;

    // Eliminar tags XML dins de placeholders
    cleaned = cleaned.replace(/(\{\{[^}]*?)(<[^>]*>)+([^}]*?\}\})/g, '$1$3');

    // Eliminar duplicacions
    cleaned = cleaned.replace(/\{\{\{\{/g, '{{');
    cleaned = cleaned.replace(/\}\}\}\}/g, '}}');

    // Arreglar placeholders trencats comuns
    cleaned = cleaned.replace(/\{\{([A-Z_]+)(?!.*\}\})/g, '{{$1}}');
    cleaned = cleaned.replace(/(?<!\{\{.*)([A-Z_]+)\}\}/g, '{{$1}}');

    // Netejar espais
    cleaned = cleaned.replace(/\{\{\s*([^}]+?)\s*\}\}/g, '{{$1}}');

    iterations++;
    if (cleaned === before) break;
  }

  console.log(`✅ [XML-Cleaner] Neteja completada en ${iterations} iteracions`);
  return cleaned;
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'DOCX Analyzer operatiu',
    usage: {
      analyze: 'POST { "templatePath": "path/to/file.docx", "action": "analyze" }',
      clean: 'POST { "templatePath": "path/to/file.docx", "action": "clean" }',
    },
    description: 'Analitza i neteja fitxers DOCX per detectar placeholders problemàtics'
  });
}
