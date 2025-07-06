/**
 * API Endpoint: /api/reports/download-smart/[generationId]/[documentIndex]
 * 
 * Endpoint per descarregar documents individuals del nou sistema intel·ligent.
 * Substitueix el sistema de descàrrega antic amb millor rendiment i seguretat.
 * 
 * Data: 6 de juliol de 2025
 * Arquitecte: Cline
 */

import { NextRequest, NextResponse } from 'next/server';
import supabaseServerClient from '@/lib/supabase/server';
import { SMART_GENERATION_CONSTANTS } from '@/lib/smart/types';

// ============================================================================
// HANDLER GET - DESCARREGAR DOCUMENT
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string; documentIndex: string }> }
) {
  const { generationId, documentIndex } = await params;
  try {
    
    console.log(`📥 [SmartDownload] Petició de descàrrega:`, {
      generationId,
      documentIndex,
    });

    // 1. Validar paràmetres
    if (!generationId || !documentIndex) {
      return NextResponse.json(
        { success: false, error: 'Paràmetres obligatoris: generationId i documentIndex' },
        { status: 400 }
      );
    }

    const docIndex = parseInt(documentIndex);
    if (isNaN(docIndex) || docIndex < 0) {
      return NextResponse.json(
        { success: false, error: 'documentIndex ha de ser un número vàlid >= 0' },
        { status: 400 }
      );
    }

    // 2. Obtenir informació de la generació
    const { data: generation, error: generationError } = await supabaseServerClient
      .from('smart_generations')
      .select('*')
      .eq('id', generationId)
      .single();

    if (generationError || !generation) {
      console.error(`❌ [SmartDownload] Generació no trobada:`, generationError);
      return NextResponse.json(
        { success: false, error: 'Generació no trobada' },
        { status: 404 }
      );
    }

    // 3. Verificar que la generació està completada
    if (generation.status !== 'completed') {
      return NextResponse.json(
        { 
          success: false, 
          error: `Generació en estat: ${generation.status}. Només es poden descarregar generacions completades.` 
        },
        { status: 400 }
      );
    }

    // 4. Verificar que el document existeix
    const documents = generation.generated_documents || [];
    if (docIndex >= documents.length) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Document ${docIndex} no existeix. Aquesta generació té ${documents.length} documents.` 
        },
        { status: 404 }
      );
    }

    const document = documents[docIndex];
    if (!document || !document.storagePath) {
      return NextResponse.json(
        { success: false, error: 'Document no té path de storage vàlid' },
        { status: 404 }
      );
    }

    // 5. Descarregar document de Supabase Storage
    console.log(`📄 [SmartDownload] Descarregant de storage:`, document.storagePath);
    
    const { data: fileData, error: storageError } = await supabaseServerClient.storage
      .from(SMART_GENERATION_CONSTANTS.STORAGE.BUCKET)
      .download(document.storagePath);

    if (storageError || !fileData) {
      console.error(`❌ [SmartDownload] Error descarregant de storage:`, storageError);
      return NextResponse.json(
        { success: false, error: 'Error accedint al document en storage' },
        { status: 500 }
      );
    }

    // 6. Preparar resposta amb el fitxer
    const buffer = Buffer.from(await fileData.arrayBuffer());
    
    // Generar nom de fitxer descriptiu
    const fileName = generateFileName(generation, docIndex, document);
    
    console.log(`✅ [SmartDownload] Document descarregat amb èxit:`, {
      generationId,
      documentIndex: docIndex,
      fileName,
      fileSize: buffer.length,
    });

    // 7. Retornar fitxer amb headers apropiats
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'private, max-age=3600', // Cache 1 hora
      },
    });

  } catch (error) {
    console.error(`❌ [SmartDownload] Error crític:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error intern del servidor',
        details: error instanceof Error ? error.message : 'Error desconegut',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// FUNCIONS AUXILIARS
// ============================================================================

/**
 * Genera un nom de fitxer descriptiu per al document
 */
function generateFileName(
  generation: any,
  documentIndex: number,
  document: any
): string {
  try {
    // Intentar extreure informació descriptiva del document
    const placeholderValues = document.placeholderValues || {};
    
    // Buscar camps que puguin ser útils per al nom
    const contractista = placeholderValues.CONTRACTISTA || 
                        placeholderValues.EMPRESA || 
                        placeholderValues.CLIENT || '';
    
    const obra = placeholderValues.OBRA || 
                 placeholderValues.PROJECTE || 
                 placeholderValues.DESCRIPCIO || '';

    // Netejar text per nom de fitxer
    const cleanContractista = cleanFileName(contractista);
    const cleanObra = cleanFileName(obra);
    
    // Data de creació
    const createdDate = new Date(generation.created_at);
    const dateStr = createdDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Construir nom de fitxer
    let fileName = `informe_${documentIndex + 1}`;
    
    if (cleanContractista) {
      fileName += `_${cleanContractista}`;
    }
    
    if (cleanObra) {
      fileName += `_${cleanObra}`;
    }
    
    fileName += `_${dateStr}.docx`;
    
    // Limitar longitud total
    if (fileName.length > 100) {
      fileName = `informe_${documentIndex + 1}_${dateStr}.docx`;
    }
    
    return fileName;

  } catch (error) {
    console.warn(`⚠️ [SmartDownload] Error generant nom de fitxer:`, error);
    // Fallback a nom simple
    const dateStr = new Date().toISOString().split('T')[0];
    return `informe_${documentIndex + 1}_${dateStr}.docx`;
  }
}

/**
 * Neteja text per usar en nom de fitxer
 */
function cleanFileName(text: string): string {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Només lletres, números i espais
    .replace(/\s+/g, '_') // Espais a underscores
    .replace(/_+/g, '_') // Múltiples underscores a un
    .replace(/^_|_$/g, '') // Eliminar underscores al principi/final
    .substring(0, 30); // Limitar longitud
}

// ============================================================================
// ENDPOINT INFORMATIU - GET SENSE PARÀMETRES
// ============================================================================

/**
 * Endpoint informatiu per llistar tots els documents d'una generació
 */
export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string; documentIndex?: string }> }
) {
  try {
    const { generationId } = await params;
    
    if (!generationId) {
      return NextResponse.json(
        { success: false, error: 'generationId és obligatori' },
        { status: 400 }
      );
    }

    // Obtenir informació de la generació
    const { data: generation, error } = await supabaseServerClient
      .from('smart_generations')
      .select('id, status, num_documents, generated_documents, created_at')
      .eq('id', generationId)
      .single();

    if (error || !generation) {
      return NextResponse.json(
        { success: false, error: 'Generació no trobada' },
        { status: 404 }
      );
    }

    const documents = generation.generated_documents || [];
    
    return NextResponse.json({
      success: true,
      generation: {
        id: generation.id,
        status: generation.status,
        totalDocuments: generation.num_documents,
        availableDocuments: documents.length,
        createdAt: generation.created_at,
      },
      documents: documents.map((doc: any, index: number) => ({
        documentIndex: index,
        downloadUrl: `/api/reports/download-smart/${generationId}/${index}`,
        fileName: generateFileName(generation, index, doc),
        placeholderValues: doc.placeholderValues || {},
      })),
    });

  } catch (error) {
    console.error(`❌ [SmartDownload] Error en OPTIONS:`, error);
    return NextResponse.json(
      { success: false, error: 'Error obtenint informació de documents' },
      { status: 500 }
    );
  }
}
