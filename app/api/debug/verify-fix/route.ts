import { NextRequest, NextResponse } from 'next/server';
import { getDocxTextContent } from '@/util/docx/readDocxFromStorage';

export async function GET(request: NextRequest) {
  try {
    console.log('[verify-fix] Iniciant verificació post-fix...');
    
    // Paths dels documents a verificar
    const templateId = 'd338ef63-7656-4d16-a373-6d988b1fe73e';
    const userId = '2c439ad3-2097-4f17-a1a3-1b4fa8967075';
    
    const paths = {
      original: `user-${userId}/template-${templateId}/original/original.docx`,
      indexed: `user-${userId}/template-${templateId}/indexed/indexed.docx`,
      placeholder: `user-${userId}/template-${templateId}/placeholder/placeholder.docx`
    };
    
    const results = {
      original: { success: false, error: null as string | null, preview: null as string | null },
      indexed: { success: false, error: null as string | null, preview: null as string | null },
      placeholder: { success: false, error: null as string | null, preview: null as string | null }
    };
    
    // Test lectura document original
    try {
      console.log('[verify-fix] Testejant lectura document original...');
      const originalContent = await getDocxTextContent(paths.original);
      results.original.success = true;
      results.original.preview = originalContent.substring(0, 200) + '...';
      console.log('[verify-fix] ✅ Document original llegit correctament');
    } catch (error) {
      console.error('[verify-fix] ❌ Error llegint document original:', error);
      results.original.error = error instanceof Error ? error.message : String(error);
    }
    
    // Test lectura document indexed
    try {
      console.log('[verify-fix] Testejant lectura document indexed...');
      const indexedContent = await getDocxTextContent(paths.indexed);
      results.indexed.success = true;
      results.indexed.preview = indexedContent.substring(0, 200) + '...';
      console.log('[verify-fix] ✅ Document indexed llegit correctament');
    } catch (error) {
      console.error('[verify-fix] ❌ Error llegint document indexed:', error);
      results.indexed.error = error instanceof Error ? error.message : String(error);
    }
    
    // Test lectura document placeholder
    try {
      console.log('[verify-fix] Testejant lectura document placeholder...');
      const placeholderContent = await getDocxTextContent(paths.placeholder);
      results.placeholder.success = true;
      results.placeholder.preview = placeholderContent.substring(0, 200) + '...';
      console.log('[verify-fix] ✅ Document placeholder llegit correctament');
    } catch (error) {
      console.error('[verify-fix] ❌ Error llegint document placeholder:', error);
      results.placeholder.error = error instanceof Error ? error.message : String(error);
    }
    
    // Resum de resultats
    const allSuccess = results.original.success && results.indexed.success && results.placeholder.success;
    const successCount = Object.values(results).filter(r => r.success).length;
    
    console.log(`[verify-fix] Verificació completada: ${successCount}/3 documents llegits correctament`);
    
    return NextResponse.json({
      success: allSuccess,
      summary: {
        total_documents: 3,
        successful_reads: successCount,
        failed_reads: 3 - successCount,
        all_documents_readable: allSuccess
      },
      results,
      paths,
      message: allSuccess 
        ? '🎉 TOTS els documents es poden llegir correctament! El fix ha funcionat.'
        : `⚠️ ${3 - successCount} document(s) encara tenen problemes de lectura.`,
      next_steps: allSuccess 
        ? [
            'Crear un nou job de generació per testejar el sistema complet',
            'Verificar que l\'endpoint /api/reports/jobs-status respon correctament',
            'Confirmar que l\'error ERR_INTERNET_DISCONNECTED ha desaparegut'
          ]
        : [
            'Revisar els errors de lectura reportats',
            'Verificar que el fitxer duplicat s\'ha eliminat correctament',
            'Comprovar permisos de storage i configuració de Supabase'
          ]
    });
    
  } catch (error) {
    console.error('[verify-fix] Error inesperat durant la verificació:', error);
    return NextResponse.json({
      success: false,
      error: 'Error inesperat durant la verificació',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
