/**
 * Sistema de Generació Massiva Millorat - Flux Principal
 * 
 * Aquest endpoint substitueix la generació individual per un sistema massiu automàtic.
 * Sense human-in-the-loop, processament batch complet, màxima eficiència.
 * 
 * Característiques:
 * - Generació automàtica de múltiples documents
 * - Detecció intel·ligent de plantilles
 * - Processament paral·lel optimitzat
 * - Gestió robusta d'errors
 * - Mètriques de rendiment avançades
 */

import { NextRequest, NextResponse } from 'next/server';
import { SmartDocumentProcessor } from '@/lib/smart/SmartDocumentProcessor';
import { BatchProcessingConfig } from '@/lib/smart/types';
import supabaseServerClient from '@/lib/supabase/server';

// ============================================================================
// CONFIGURACIÓ DEL SISTEMA MASSIU
// ============================================================================

export const runtime = 'nodejs';
export const maxDuration = 600; // 10 minuts per processaments massius

interface EnhancedBatchRequest {
  projectId?: string;
  templateId?: string;
  excelData: any[];
  templateSelector?: 'auto' | 'specific' | 'fallback';
  batchSize?: number;
  processingMode?: 'parallel' | 'sequential' | 'optimized';
  errorHandling?: 'strict' | 'tolerant' | 'continue';
}

// ============================================================================
// HANDLER PRINCIPAL - GENERACIÓ MASSIVA
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log(`🚀 [BatchEnhanced] Nova petició de generació massiva rebuda`);

    // 1. Autenticació i obtenció d'usuari
    const { data: userAuth } = await supabaseServerClient.auth.getUser();
    if (!userAuth.user) {
      return NextResponse.json(
        { success: false, error: 'Usuari no autenticat' },
        { status: 401 }
      );
    }

    const userId = userAuth.user.id;

    // 2. Parsejar i validar petició
    const body: EnhancedBatchRequest = await request.json();
    const {
      projectId,
      templateId,
      excelData,
      templateSelector = 'auto',
      batchSize = 50,
      processingMode = 'optimized',
      errorHandling = 'tolerant'
    } = body;

    // 3. Validacions bàsiques
    if (!excelData || !Array.isArray(excelData) || excelData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'excelData és obligatori i ha de ser un array no buit' },
        { status: 400 }
      );
    }

    console.log(`📊 [BatchEnhanced] Configuració rebuda:`, {
      documentsToGenerate: excelData.length,
      templateSelector,
      batchSize,
      processingMode,
      errorHandling,
      userId: userId.substring(0, 8) + '...',
    });

    // 4. SELECCIÓ INTEL·LIGENT DE PLANTILLA
    const templateInfo = await selectTemplate(templateId, projectId, userId, templateSelector);
    if (!templateInfo.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No s\'ha pogut trobar una plantilla vàlida',
          details: templateInfo.error,
          suggestions: templateInfo.suggestions || []
        },
        { status: 404 }
      );
    }

    console.log(`✅ [BatchEnhanced] Plantilla seleccionada:`, {
      templateId: templateInfo.template.id,
      templateName: templateInfo.template.name,
      selectionMethod: templateInfo.method,
    });

    // 5. PROCESSAMENT MASSIU EN BATCHES
    const processor = new SmartDocumentProcessor();
    const results = await processMassiveBatch({
      templateInfo: templateInfo.template,
      excelData,
      userId,
      batchSize,
      processingMode,
      errorHandling,
      processor,
    });

    const totalTime = Date.now() - startTime;

    // 6. Preparar resposta final
    const response = {
      success: true,
      batchId: results.batchId,
      summary: {
        totalDocuments: excelData.length,
        successfulDocuments: results.successfulDocuments,
        failedDocuments: results.failedDocuments,
        totalProcessingTimeMs: totalTime,
        averageTimePerDocument: totalTime / excelData.length,
        documentsPerSecond: (excelData.length / totalTime * 1000).toFixed(2),
      },
      template: {
        id: templateInfo.template.id,
        name: templateInfo.template.name,
        selectionMethod: templateInfo.method,
      },
      processing: {
        mode: processingMode,
        batchSize,
        errorHandling,
        batches: results.batchResults.length,
      },
      documents: results.generatedDocuments.map(doc => ({
        index: doc.documentIndex,
        success: doc.success,
        storagePath: doc.storagePath,
        error: doc.error || null,
      })),
      downloadUrl: `/api/reports/download-batch/${results.batchId}`,
      message: `Generació massiva completada: ${results.successfulDocuments}/${excelData.length} documents generats amb èxit`,
    };

    console.log(`✅ [BatchEnhanced] Processament massiu completat:`, response.summary);

    return NextResponse.json(response);

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [BatchEnhanced] Error crític en generació massiva:`, error);
    
    return NextResponse.json({
      success: false,
      error: 'Error crític en generació massiva',
      details: error instanceof Error ? error.message : 'Error desconegut',
      processingTimeMs: totalTime,
    }, { status: 500 });
  }
}

// ============================================================================
// SELECCIÓ INTEL·LIGENT DE PLANTILLA
// ============================================================================

async function selectTemplate(
  templateId?: string,
  projectId?: string,
  userId?: string,
  selector: string = 'auto'
): Promise<{
  success: boolean;
  template?: any;
  method?: string;
  error?: string;
  suggestions?: string[];
}> {
  
  try {
    console.log(`🎯 [TemplateSelector] Iniciant selecció amb mode: ${selector}`);

    // Estratègia 1: Plantilla específica proporcionada
    if (templateId && selector !== 'auto') {
      const { data: template, error } = await supabaseServerClient
        .from('plantilla_configs')
        .select('*')
        .eq('id', templateId)
        .single();

      if (!error && template && template.template_content && template.docx_storage_path) {
        return {
          success: true,
          template,
          method: 'specific_id',
        };
      }

      console.warn(`⚠️ [TemplateSelector] Plantilla específica no vàlida: ${templateId}`);
    }

    // Estratègia 2: Plantilla del projecte
    if (projectId) {
      const { data: projectTemplates } = await supabaseServerClient
        .from('plantilla_configs')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .not('template_content', 'is', null)
        .not('docx_storage_path', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (projectTemplates && projectTemplates.length > 0) {
        return {
          success: true,
          template: projectTemplates[0],
          method: 'project_latest',
        };
      }
    }

    // Estratègia 3: Plantilla més recent de l'usuari
    const { data: userTemplates } = await supabaseServerClient
      .from('plantilla_configs')
      .select('*')
      .eq('user_id', userId)
      .not('template_content', 'is', null)
      .not('docx_storage_path', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (userTemplates && userTemplates.length > 0) {
      return {
        success: true,
        template: userTemplates[0],
        method: 'user_latest',
      };
    }

    // Estratègia 4: Plantilla fallback del sistema
    const { data: systemTemplates } = await supabaseServerClient
      .from('plantilla_configs')
      .select('*')
      .not('template_content', 'is', null)
      .not('docx_storage_path', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (systemTemplates && systemTemplates.length > 0) {
      console.warn(`⚠️ [TemplateSelector] Utilitzant plantilla fallback del sistema`);
      return {
        success: true,
        template: systemTemplates[0],
        method: 'system_fallback',
      };
    }

    // No s'ha trobat cap plantilla vàlida
    return {
      success: false,
      error: 'No s\'ha trobat cap plantilla vàlida disponible',
      suggestions: [
        'Crear una nova plantilla abans de la generació',
        'Verificar que les plantilles existents tenen contingut i path de storage',
        'Contactar amb l\'administrador del sistema',
      ],
    };

  } catch (error) {
    console.error(`❌ [TemplateSelector] Error en selecció:`, error);
    return {
      success: false,
      error: `Error accedint a plantilles: ${error instanceof Error ? error.message : 'Error desconegut'}`,
    };
  }
}

// ============================================================================
// PROCESSAMENT MASSIU EN BATCHES
// ============================================================================

async function processMassiveBatch(config: {
  templateInfo: any;
  excelData: any[];
  userId: string;
  batchSize: number;
  processingMode: string;
  errorHandling: string;
  processor: SmartDocumentProcessor;
}) {
  const { templateInfo, excelData, userId, batchSize, processingMode, errorHandling, processor } = config;
  
  console.log(`🔄 [MassiveBatch] Iniciant processament massiu de ${excelData.length} documents`);

  // Crear ID únic per al batch
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Dividir dades en batches
  const batches: any[][] = [];
  for (let i = 0; i < excelData.length; i += batchSize) {
    batches.push(excelData.slice(i, i + batchSize));
  }

  console.log(`📦 [MassiveBatch] Dades dividides en ${batches.length} batches de màxim ${batchSize} documents`);

  const batchResults: any[] = [];
  const generatedDocuments: any[] = [];
  let successfulDocuments = 0;
  let failedDocuments = 0;

  // Processar cada batch
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batchData = batches[batchIndex];
    
    try {
      console.log(`🚀 [MassiveBatch] Processant batch ${batchIndex + 1}/${batches.length} (${batchData.length} documents)`);

      const batchConfig: BatchProcessingConfig = {
        templateId: templateInfo.id,
        templateContent: templateInfo.template_content,
        templateStoragePath: templateInfo.docx_storage_path,
        excelData: batchData,
        userId,
      };

      // Processar batch amb el SmartDocumentProcessor
      const batchResult = await processor.processBatch(batchConfig);
      
      if (batchResult.success) {
        successfulDocuments += batchResult.documentsGenerated;
        generatedDocuments.push(...batchResult.documents.map((doc, idx) => ({
          ...doc,
          documentIndex: batchIndex * batchSize + idx,
          success: true,
          batchIndex,
        })));
      } else {
        failedDocuments += batchData.length;
        
        // Afegir documents fallits
        batchData.forEach((_, idx) => {
          generatedDocuments.push({
            documentIndex: batchIndex * batchSize + idx,
            success: false,
            error: batchResult.errorMessage,
            batchIndex,
          });
        });

        if (errorHandling === 'strict') {
          throw new Error(`Batch ${batchIndex + 1} fallit: ${batchResult.errorMessage}`);
        }
      }

      batchResults.push({
        batchIndex,
        success: batchResult.success,
        documentsProcessed: batchData.length,
        processingTime: batchResult.processingTimeMs,
        error: batchResult.errorMessage || null,
      });

      // Pausa breu entre batches per evitar sobrecàrrega
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      console.error(`❌ [MassiveBatch] Error en batch ${batchIndex + 1}:`, error);
      
      failedDocuments += batchData.length;
      
      batchResults.push({
        batchIndex,
        success: false,
        documentsProcessed: batchData.length,
        processingTime: 0,
        error: error instanceof Error ? error.message : 'Error desconegut',
      });

      if (errorHandling === 'strict') {
        throw error;
      }
    }
  }

  console.log(`✅ [MassiveBatch] Processament massiu completat:`, {
    totalBatches: batches.length,
    successfulDocuments,
    failedDocuments,
    successRate: `${((successfulDocuments / excelData.length) * 100).toFixed(1)}%`,
  });

  return {
    batchId,
    successfulDocuments,
    failedDocuments,
    batchResults,
    generatedDocuments,
  };
}

// ============================================================================
// HANDLER GET - ESTAT DEL BATCH
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      return NextResponse.json(
        { success: false, error: 'batchId és obligatori' },
        { status: 400 }
      );
    }

    // Obtenir informació del batch (placeholder - implementar segons necessitat)
    return NextResponse.json({
      success: true,
      message: 'Consulta d\'estat de batch - funcionalitat per implementar',
      batchId,
    });

  } catch (error) {
    console.error(`❌ [BatchEnhanced] Error consultant estat:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error consultant estat de batch',
        details: error instanceof Error ? error.message : 'Error desconegut',
      },
      { status: 500 }
    );
  }
}
