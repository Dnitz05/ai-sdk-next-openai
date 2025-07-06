/**
 * API Endpoint: /api/reports/generate-smart
 * 
 * Aquest és l'endpoint revolucionari que substitueix tot el sistema antic.
 * Genera múltiples informes en una sola crida amb coherència narrativa garantida.
 * 
 * Data: 6 de juliol de 2025
 * Arquitecte: Cline
 * Objectiu: 20x més ràpid, 95% més fiable, 85% més simple
 */

import { NextRequest, NextResponse } from 'next/server';
import { SmartDocumentProcessor } from '@/lib/smart/SmartDocumentProcessor';
import { BatchProcessingConfig, isValidExcelData } from '@/lib/smart/types';
import supabaseServerClient from '@/lib/supabase/server';

// ============================================================================
// CONFIGURACIÓ DE L'ENDPOINT
// ============================================================================

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minuts màxim per processament

// ============================================================================
// HANDLER PRINCIPAL - POST
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log(`🚀 [SmartAPI] Nova petició de generació intel·ligent rebuda`);

    // 1. Parsejar i validar el body de la petició
    const body = await request.json();
    const { templateId, excelData, userId } = body;

    // 2. Validacions bàsiques
    const validationResult = validateRequest(body);
    if (!validationResult.valid) {
      console.error(`❌ [SmartAPI] Validació fallida:`, validationResult.errors);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Dades de petició invàlides',
          details: validationResult.errors 
        },
        { status: 400 }
      );
    }

    // 3. Obtenir informació de la plantilla
    const templateInfo = await getTemplateInfo(templateId);
    if (!templateInfo) {
      console.error(`❌ [SmartAPI] Plantilla no trobada: ${templateId}`);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Plantilla no trobada' 
        },
        { status: 404 }
      );
    }

    // 4. Construir configuració per al processament
    const config: BatchProcessingConfig = {
      templateId,
      templateContent: templateInfo.template_content,
      templateStoragePath: templateInfo.docx_storage_path,
      excelData,
      userId,
    };

    console.log(`📋 [SmartAPI] Configuració preparada:`, {
      templateId: config.templateId,
      documentsToGenerate: config.excelData.length,
      templateContentLength: config.templateContent.length,
      userId: config.userId,
    });

    // 5. Inicialitzar el processador intel·ligent
    const processor = new SmartDocumentProcessor();

    // 6. Validar configuració amb el processador
    const configValidation = processor.validateConfig(config);
    if (!configValidation.valid) {
      console.error(`❌ [SmartAPI] Configuració invàlida:`, configValidation.errors);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Configuració de processament invàlida',
          details: configValidation.errors 
        },
        { status: 400 }
      );
    }

    // 7. PROCESSAMENT REVOLUCIONARI - UNA SOLA CRIDA!
    console.log(`🎯 [SmartAPI] Iniciant processament revolucionari...`);
    const result = await processor.processBatch(config);

    // 8. Gestionar resultat
    if (!result.success) {
      console.error(`❌ [SmartAPI] Error en processament:`, result.errorMessage);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Error en processament de documents',
          details: result.errorMessage 
        },
        { status: 500 }
      );
    }

    // 9. Obtenir mètriques de rendiment
    const metrics = processor.getPerformanceMetrics();
    const totalTime = Date.now() - startTime;

    console.log(`✅ [SmartAPI] Processament completat amb èxit:`, {
      generationId: result.generationId,
      documentsGenerated: result.documentsGenerated,
      processingTimeMs: result.processingTimeMs,
      totalApiTimeMs: totalTime,
      documentsPerSecond: metrics.documentsPerSecond,
    });

    // 10. Retornar resposta d'èxit
    return NextResponse.json({
      success: true,
      generationId: result.generationId,
      documentsGenerated: result.documentsGenerated,
      processingTimeMs: result.processingTimeMs,
      totalApiTimeMs: totalTime,
      metrics: {
        aiCallTimeMs: metrics.aiCallTime,
        docxGenerationTimeMs: metrics.docxGenerationTime,
        storageUploadTimeMs: metrics.storageUploadTime,
        documentsPerSecond: metrics.documentsPerSecond,
      },
      documents: result.documents.map(doc => ({
        documentIndex: doc.documentIndex,
        storagePath: doc.storagePath,
        placeholderValues: doc.placeholderValues,
      })),
      message: `${result.documentsGenerated} documents generats amb èxit en ${(result.processingTimeMs / 1000).toFixed(2)} segons`,
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [SmartAPI] Error crític en endpoint:`, error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error intern del servidor',
        details: error instanceof Error ? error.message : 'Error desconegut',
        processingTimeMs: totalTime,
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// HANDLER GET - ESTAT DE GENERACIÓ
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const generationId = searchParams.get('generationId');

    if (!generationId) {
      return NextResponse.json(
        { success: false, error: 'generationId és obligatori' },
        { status: 400 }
      );
    }

    console.log(`📊 [SmartAPI] Consultant estat de generació: ${generationId}`);

    // Obtenir informació de la generació
    const { data, error } = await supabaseServerClient
      .from('smart_generations')
      .select('*')
      .eq('id', generationId)
      .single();

    if (error || !data) {
      console.error(`❌ [SmartAPI] Generació no trobada:`, error);
      return NextResponse.json(
        { success: false, error: 'Generació no trobada' },
        { status: 404 }
      );
    }

    console.log(`✅ [SmartAPI] Estat obtingut:`, {
      generationId: data.id,
      status: data.status,
      documentsGenerated: data.generated_documents?.length || 0,
      processingTime: data.processing_time,
    });

    return NextResponse.json({
      success: true,
      generation: {
        id: data.id,
        status: data.status,
        numDocuments: data.num_documents,
        documentsGenerated: data.generated_documents?.length || 0,
        processingTime: data.processing_time,
        createdAt: data.created_at,
        completedAt: data.completed_at,
        errorMessage: data.error_message,
        documents: data.generated_documents || [],
      },
    });

  } catch (error) {
    console.error(`❌ [SmartAPI] Error consultant estat:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error consultant estat de generació',
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
 * Valida la petició d'entrada
 */
function validateRequest(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!body.templateId) {
    errors.push('templateId és obligatori');
  }

  if (!body.userId) {
    errors.push('userId és obligatori');
  }

  if (!body.excelData) {
    errors.push('excelData és obligatori');
  } else if (!isValidExcelData(body.excelData)) {
    errors.push('excelData ha de ser un array vàlid amb dades');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Obté informació de la plantilla des de la base de dades
 */
async function getTemplateInfo(templateId: string): Promise<{
  template_content: string;
  docx_storage_path: string;
} | null> {
  try {
    const { data, error } = await supabaseServerClient
      .from('plantilla_configs')
      .select('template_content, docx_storage_path')
      .eq('id', templateId)
      .single();

    if (error || !data) {
      console.error(`❌ [SmartAPI] Error obtenint plantilla:`, error);
      return null;
    }

    // Validar que la plantilla té el contingut necessari
    if (!data.template_content || !data.docx_storage_path) {
      console.error(`❌ [SmartAPI] Plantilla incompleta:`, {
        hasContent: !!data.template_content,
        hasStoragePath: !!data.docx_storage_path,
      });
      return null;
    }

    return data;

  } catch (error) {
    console.error(`❌ [SmartAPI] Error accedint a plantilla:`, error);
    return null;
  }
}

// ============================================================================
// DOCUMENTACIÓ DE L'ENDPOINT
// ============================================================================

/**
 * DOCUMENTACIÓ DE L'API
 * 
 * POST /api/reports/generate-smart
 * 
 * Body (JSON):
 * {
 *   "templateId": "uuid-de-la-plantilla",
 *   "excelData": [
 *     { "contractista": "Maria Soler", "obra": "reforma", "import": 12345.67 },
 *     { "contractista": "Joan Pérez", "obra": "construcció", "import": 25000 }
 *   ],
 *   "userId": "uuid-de-l-usuari"
 * }
 * 
 * Response (JSON):
 * {
 *   "success": true,
 *   "generationId": "uuid-de-la-generacio",
 *   "documentsGenerated": 2,
 *   "processingTimeMs": 15000,
 *   "totalApiTimeMs": 16000,
 *   "metrics": {
 *     "aiCallTimeMs": 8000,
 *     "docxGenerationTimeMs": 5000,
 *     "storageUploadTimeMs": 2000,
 *     "documentsPerSecond": 0.13
 *   },
 *   "documents": [
 *     {
 *       "documentIndex": 0,
 *       "storagePath": "smart-generations/uuid/document_1.docx",
 *       "placeholderValues": { "CONTRACTISTA": "La contractista Maria Soler", ... }
 *     }
 *   ],
 *   "message": "2 documents generats amb èxit en 15.00 segons"
 * }
 * 
 * GET /api/reports/generate-smart?generationId=uuid
 * 
 * Response (JSON):
 * {
 *   "success": true,
 *   "generation": {
 *     "id": "uuid",
 *     "status": "completed",
 *     "numDocuments": 2,
 *     "documentsGenerated": 2,
 *     "processingTime": 15000,
 *     "createdAt": "2025-07-06T20:00:00Z",
 *     "completedAt": "2025-07-06T20:00:15Z",
 *     "documents": [...]
 *   }
 * }
 */
