/**
 * Sistema de Generació Individual amb Human-in-the-Loop - Flux Principal
 * 
 * Aquest endpoint millora el sistema actual individual amb:
 * - Solució a l'error "Plantilla no trobada"
 * - Human-in-the-loop com a flow principal
 * - Generació individual optimitzada
 * - Interacció step-by-step amb l'usuari
 */

import { NextRequest, NextResponse } from 'next/server';
import { SmartDocumentProcessor } from '@/lib/smart/SmartDocumentProcessor';
import { BatchProcessingConfig } from '@/lib/smart/types';
import supabaseServerClient from '@/lib/supabase/server';

// ============================================================================
// CONFIGURACIÓ DEL SISTEMA INDIVIDUAL
// ============================================================================

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minuts per generació individual

interface IndividualGenerationRequest {
  projectId?: string;
  templateId?: string;
  documentData: any; // Dades d'un sol document
  userInteraction?: {
    confirmTemplate?: boolean;
    reviewData?: boolean;
    customInstructions?: string;
  };
  step?: 'prepare' | 'confirm' | 'generate' | 'review';
}

// ============================================================================
// HANDLER PRINCIPAL - GENERACIÓ INDIVIDUAL AMB HUMAN-IN-THE-LOOP
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log(`🧑‍💼 [IndividualHITL] Nova petició de generació individual amb human-in-the-loop`);

    // 1. Autenticació
    const { data: userAuth } = await supabaseServerClient.auth.getUser();
    if (!userAuth.user) {
      return NextResponse.json(
        { success: false, error: 'Usuari no autenticat' },
        { status: 401 }
      );
    }

    const userId = userAuth.user.id;

    // 2. Parsejar petició
    const body: IndividualGenerationRequest = await request.json();
    const {
      projectId,
      templateId,
      documentData,
      userInteraction = {},
      step = 'prepare'
    } = body;

    console.log(`📋 [IndividualHITL] Step: ${step}, userId: ${userId.substring(0, 8)}...`);

    // 3. STEP BY STEP HUMAN-IN-THE-LOOP PROCESS
    switch (step) {
      case 'prepare':
        return await handlePrepareStep(userId, projectId, templateId, documentData);
      
      case 'confirm':
        return await handleConfirmStep(userId, templateId, documentData, userInteraction);
      
      case 'generate':
        return await handleGenerateStep(userId, templateId, documentData, userInteraction);
      
      case 'review':
        return await handleReviewStep(userId, documentData);
      
      default:
        return NextResponse.json(
          { success: false, error: `Step '${step}' no reconegut` },
          { status: 400 }
        );
    }

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [IndividualHITL] Error en generació individual:`, error);
    
    return NextResponse.json({
      success: false,
      error: 'Error en generació individual',
      details: error instanceof Error ? error.message : 'Error desconegut',
      processingTimeMs: totalTime,
    }, { status: 500 });
  }
}

// ============================================================================
// STEP 1: PREPARACIÓ - HUMAN SELECCIONA PLANTILLA
// ============================================================================

async function handlePrepareStep(
  userId: string,
  projectId?: string,
  templateId?: string,
  documentData?: any
) {
  console.log(`🔍 [PrepareStep] Preparant generació per usuari ${userId.substring(0, 8)}...`);

  // 1. Investigar plantilla específica si es proporciona
  let templateInvestigation = null;
  if (templateId) {
    try {
      const { data: template, error } = await supabaseServerClient
        .from('plantilla_configs')
        .select('*')
        .eq('id', templateId)
        .single();

      const issues: string[] = [];
      
      // Identificar problemes específics
      if (!template) {
        issues.push('Plantilla no existeix a la base de dades');
      } else {
        if (!template.template_content) {
          issues.push('Plantilla sense contingut');
        }
        if (!template.docx_storage_path) {
          issues.push('Plantilla sense document DOCX original');
        }
      }

      templateInvestigation = {
        templateId,
        exists: !error && !!template,
        valid: template?.template_content && template?.docx_storage_path,
        template: template || null,
        error: error?.message || null,
        issues
      };

    } catch (error) {
      templateInvestigation = {
        templateId,
        exists: false,
        valid: false,
        error: error instanceof Error ? error.message : 'Error desconegut',
        issues: ['Error accedint a la plantilla'],
      };
    }
  }

  // 2. Obtenir plantilles disponibles per l'usuari
  const { data: availableTemplates } = await supabaseServerClient
    .from('plantilla_configs')
    .select('id, name, user_id, created_at, template_content, docx_storage_path')
    .eq('user_id', userId)
    .not('template_content', 'is', null)
    .not('docx_storage_path', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  // 3. Plantilles del projecte si s'especifica
  let projectTemplates: any[] = [];
  if (projectId) {
    const { data: projTemplates } = await supabaseServerClient
      .from('plantilla_configs')
      .select('id, name, created_at')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .not('template_content', 'is', null)
      .not('docx_storage_path', 'is', null)
      .order('created_at', { ascending: false });
    
    projectTemplates = projTemplates || [];
  }

  // 4. RESPOSTA HUMAN-IN-THE-LOOP: SELECCIÓ DE PLANTILLA
  return NextResponse.json({
    success: true,
    step: 'prepare',
    nextStep: 'confirm',
    humanInteractionRequired: true,
    message: 'Selecciona la plantilla i confirma les dades per continuar',
    data: {
      templateInvestigation,
      availableTemplates: {
        count: availableTemplates?.length || 0,
        templates: availableTemplates?.map(t => ({
          id: t.id,
          name: t.name,
          createdAt: t.created_at,
          isValid: !!(t.template_content && t.docx_storage_path),
        })) || [],
      },
      projectTemplates: {
        count: projectTemplates.length,
        templates: projectTemplates,
      },
      documentDataPreview: documentData || null,
      recommendations: generateRecommendationsForTemplate(templateInvestigation, availableTemplates || []),
    },
    userActions: {
      required: [
        'Seleccionar plantilla vàlida',
        'Revisar dades del document',
        'Confirmar per continuar'
      ],
      options: {
        selectTemplate: 'Tria un ID de plantilla de les disponibles',
        useRecommended: availableTemplates?.[0]?.id || null,
        cancelGeneration: 'Cancel·lar el procés',
      }
    }
  });
}

// ============================================================================
// STEP 2: CONFIRMACIÓ - HUMAN REVISA I CONFIRMA
// ============================================================================

async function handleConfirmStep(
  userId: string,
  templateId?: string,
  documentData?: any,
  userInteraction?: any
) {
  console.log(`✅ [ConfirmStep] Confirmant configuració per usuari ${userId.substring(0, 8)}...`);

  if (!templateId) {
    return NextResponse.json(
      { success: false, error: 'templateId és obligatori en el step de confirmació' },
      { status: 400 }
    );
  }

  if (!documentData) {
    return NextResponse.json(
      { success: false, error: 'documentData és obligatori per la generació' },
      { status: 400 }
    );
  }

  // 1. Validar plantilla seleccionada
  const { data: template, error: templateError } = await supabaseServerClient
    .from('plantilla_configs')
    .select('*')
    .eq('id', templateId)
    .single();

  if (templateError || !template) {
    return NextResponse.json(
      { success: false, error: 'Plantilla seleccionada no és vàlida' },
      { status: 400 }
    );
  }

  // 2. Extreure placeholders de la plantilla
  const processor = new SmartDocumentProcessor();
  const placeholders = extractPlaceholdersFromTemplate(template.template_content);

  // 3. Mapear dades del document amb placeholders
  const dataMapping = mapDocumentDataToPlaceholders(documentData, placeholders);

  // 4. RESPOSTA HUMAN-IN-THE-LOOP: CONFIRMACIÓ
  return NextResponse.json({
    success: true,
    step: 'confirm',
    nextStep: 'generate',
    humanInteractionRequired: true,
    message: 'Revisa la configuració i confirma per generar el document',
    data: {
      selectedTemplate: {
        id: template.id,
        name: template.name,
        createdAt: template.created_at,
      },
      placeholders: {
        total: placeholders.length,
        list: placeholders,
      },
      documentData: documentData,
      dataMapping: {
        mapped: dataMapping.mapped,
        unmapped: dataMapping.unmapped,
        issues: dataMapping.issues,
      },
      preview: {
        sampleSubstitution: generatePreviewSubstitution(documentData, placeholders.slice(0, 3)),
      },
      customInstructions: userInteraction?.customInstructions || null,
    },
    userActions: {
      required: [
        'Revisar mapatge de dades',
        'Confirmar placeholders',
        'Procedir amb la generació'
      ],
      options: {
        proceedWithGeneration: 'Generar document amb aquesta configuració',
        modifyData: 'Modificar dades del document',
        changeTemplate: 'Canviar plantilla',
        addCustomInstructions: 'Afegir instruccions personalitzades'
      }
    }
  });
}

// ============================================================================
// STEP 3: GENERACIÓ - PROCESSAR DOCUMENT
// ============================================================================

async function handleGenerateStep(
  userId: string,
  templateId?: string,
  documentData?: any,
  userInteraction?: any
) {
  console.log(`🚀 [GenerateStep] Generant document per usuari ${userId.substring(0, 8)}...`);

  if (!templateId || !documentData) {
    return NextResponse.json(
      { success: false, error: 'templateId i documentData són obligatoris' },
      { status: 400 }
    );
  }

  // 1. Obtenir plantilla
  const { data: template, error: templateError } = await supabaseServerClient
    .from('plantilla_configs')
    .select('*')
    .eq('id', templateId)
    .single();

  if (templateError || !template) {
    return NextResponse.json(
      { success: false, error: 'Error obtenint plantilla per generació' },
      { status: 500 }
    );
  }

  // 2. Configurar processament amb SmartDocumentProcessor
  const processor = new SmartDocumentProcessor();
  const config: BatchProcessingConfig = {
    templateId: template.id,
    templateContent: template.template_content,
    templateStoragePath: template.docx_storage_path,
    excelData: [documentData], // Un sol document
    userId,
  };

  // 3. Processar document
  const result = await processor.processBatch(config);

  if (!result.success) {
    return NextResponse.json({
      success: false,
      step: 'generate',
      error: 'Error en generació del document',
      details: result.errorMessage,
      userActions: {
        options: {
          retry: 'Tornar a intentar la generació',
          changeTemplate: 'Provar amb una altra plantilla',
          modifyData: 'Modificar les dades del document'
        }
      }
    }, { status: 500 });
  }

  // 4. RESPOSTA HUMAN-IN-THE-LOOP: DOCUMENT GENERAT
  return NextResponse.json({
    success: true,
    step: 'generate',
    nextStep: 'review',
    humanInteractionRequired: true,
    message: 'Document generat amb èxit! Revisa el resultat',
    data: {
      generationId: result.generationId,
      document: result.documents[0],
      processingTime: result.processingTimeMs,
      template: {
        id: template.id,
        name: template.name,
      },
      placeholderValues: result.documents[0]?.placeholderValues || {},
    },
    userActions: {
      required: [
        'Revisar document generat',
        'Descarregar o continuar'
      ],
      options: {
        downloadDocument: `/api/reports/download-smart/${result.generationId}/0`,
        reviewDocument: 'Passar al step de revisió',
        generateAnother: 'Generar un altre document',
        modifyAndRegenerate: 'Modificar dades i regenerar'
      }
    }
  });
}

// ============================================================================
// STEP 4: REVISIÓ - HUMAN REVISA RESULTAT
// ============================================================================

async function handleReviewStep(userId: string, documentData?: any) {
  console.log(`📝 [ReviewStep] Revisió final per usuari ${userId.substring(0, 8)}...`);

  return NextResponse.json({
    success: true,
    step: 'review',
    nextStep: null,
    humanInteractionRequired: true,
    message: 'Procés completat. Revisa el document final',
    data: {
      completedAt: new Date().toISOString(),
      documentData: documentData,
    },
    userActions: {
      options: {
        generateAnother: 'Generar un altre document',
        startNewProcess: 'Començar nou procés de generació',
        finishSession: 'Finalitzar sessió'
      }
    }
  });
}

// ============================================================================
// FUNCIONS AUXILIARS
// ============================================================================

function extractPlaceholdersFromTemplate(templateContent: string) {
  const placeholders: any[] = [];
  const placeholderRegex = /\{([A-Z_]+):\s*([^}]+)\}/g;
  let match;

  while ((match = placeholderRegex.exec(templateContent)) !== null) {
    const [, id, instruction] = match;
    placeholders.push({
      id: id.trim(),
      instruction: instruction.trim(),
    });
  }

  return placeholders.filter((placeholder, index, self) =>
    index === self.findIndex(p => p.id === placeholder.id)
  );
}

function mapDocumentDataToPlaceholders(documentData: any, placeholders: any[]) {
  const mapped: any = {};
  const unmapped: string[] = [];
  const issues: string[] = [];

  placeholders.forEach(placeholder => {
    const dataKey = placeholder.id.toLowerCase();
    if (documentData.hasOwnProperty(dataKey)) {
      mapped[placeholder.id] = documentData[dataKey];
    } else {
      unmapped.push(placeholder.id);
    }
  });

  if (unmapped.length > 0) {
    issues.push(`${unmapped.length} placeholders no tenen dades corresponents`);
  }

  return { mapped, unmapped, issues };
}

function generatePreviewSubstitution(documentData: any, placeholders: any[]) {
  return placeholders.map(p => ({
    placeholder: `{${p.id}: ${p.instruction}}`,
    value: documentData[p.id.toLowerCase()] || `[Sense dades per ${p.id}]`,
  }));
}

function generateRecommendationsForTemplate(templateInvestigation: any, availableTemplates: any[]) {
  const recommendations: string[] = [];

  if (templateInvestigation?.issues?.length > 0) {
    recommendations.push(`Plantilla especificada té problemes: ${templateInvestigation.issues.join(', ')}`);
  }

  if (availableTemplates && availableTemplates.length > 0) {
    recommendations.push(`Recomanació: Utilitzar "${availableTemplates[0].name}" (plantilla més recent)`);
  } else {
    recommendations.push('Crear una nova plantilla abans de generar documents');
  }

  return recommendations;
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Sistema de Generació Individual amb Human-in-the-Loop',
    description: 'Flux step-by-step amb interacció humana per generació de documents individuals',
    steps: {
      1: 'prepare - Selecció de plantilla i preparació',
      2: 'confirm - Confirmació de configuració',
      3: 'generate - Generació del document',
      4: 'review - Revisió final'
    },
    usage: {
      endpoint: 'POST /api/reports/generate-individual-enhanced',
      requiredBody: {
        step: 'prepare | confirm | generate | review',
        documentData: 'Object with document data',
        templateId: 'Template ID (optional for prepare step)',
      }
    }
  });
}
