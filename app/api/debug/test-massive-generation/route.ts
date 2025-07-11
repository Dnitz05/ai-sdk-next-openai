/**
 * Endpoint de Test per al Sistema de Generació Massiva
 * 
 * Testa la solució completa per al problema "Plantilla no trobada"
 * i valida el nou sistema de generació massiva automàtica.
 */

import { NextRequest, NextResponse } from 'next/server';
import supabaseServerClient from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    console.log(`🧪 [TestMassive] Iniciant test del sistema de generació massiva`);

    const body = await request.json();
    const { 
      testMode = 'full',
      documentsCount = 5,
      templateId,
      simulateError = false 
    } = body;

    // 1. VERIFICAR AUTENTICACIÓ
    const { data: userAuth } = await supabaseServerClient.auth.getUser();
    if (!userAuth.user) {
      return NextResponse.json({
        success: false,
        error: 'Usuari no autenticat',
        step: 'authentication',
      }, { status: 401 });
    }

    const userId = userAuth.user.id;
    console.log(`✅ [TestMassive] Usuari autenticat: ${userId.substring(0, 8)}...`);

    // 2. GENERAR DADES DE TEST
    const testExcelData = Array.from({ length: documentsCount }, (_, i) => ({
      contractista: `Contractista Test ${i + 1}`,
      obra: `Obra de prova número ${i + 1}`,
      import: (Math.random() * 50000 + 1000).toFixed(2),
      data_inici: `2024-0${Math.floor(Math.random() * 9) + 1}-15`,
      descripcion: `Descripció detallada per al document ${i + 1}`,
      index: i + 1,
    }));

    console.log(`📊 [TestMassive] Dades de test generades: ${testExcelData.length} documents`);

    // 3. INVESTIGAR PLANTILLA PROBLEMÀTICA (si s'especifica)
    let templateInvestigation = null;
    if (templateId) {
      try {
        const { data: template, error } = await supabaseServerClient
          .from('plantilla_configs')
          .select('*')
          .eq('id', templateId)
          .single();

        templateInvestigation = {
          templateId,
          exists: !error && !!template,
          hasContent: template?.template_content ? template.template_content.length > 0 : false,
          hasStoragePath: !!template?.docx_storage_path,
          error: error?.message || null,
        };

        console.log(`🔍 [TestMassive] Investigació de plantilla:`, templateInvestigation);
      } catch (error) {
        templateInvestigation = {
          templateId,
          exists: false,
          error: error instanceof Error ? error.message : 'Error desconegut',
        };
      }
    }

    // 4. TESTEJAR SISTEMA DE GENERACIÓ MASSIVA
    let massiveTestResult = null;
    if (testMode === 'full' || testMode === 'massive') {
      try {
        console.log(`🚀 [TestMassive] Testejant sistema de generació massiva...`);

        const massiveRequest = {
          excelData: testExcelData,
          templateId: templateId || undefined,
          templateSelector: 'auto',
          batchSize: 10,
          processingMode: 'optimized',
          errorHandling: 'tolerant',
        };

        // Simular error si es demana
        if (simulateError) {
          massiveRequest.excelData = null as any;
        }

        const response = await fetch(`${request.nextUrl.origin}/api/reports/generate-batch-enhanced`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': request.headers.get('Authorization') || '',
            'Cookie': request.headers.get('Cookie') || '',
          },
          body: JSON.stringify(massiveRequest),
        });

        const result = await response.json();

        massiveTestResult = {
          success: response.ok,
          statusCode: response.status,
          result,
          message: response.ok 
            ? 'Sistema de generació massiva funciona correctament'
            : 'Sistema de generació massiva ha fallat (comportament esperat en alguns casos)',
        };

        console.log(`📋 [TestMassive] Resultat test massiu:`, {
          success: massiveTestResult.success,
          statusCode: massiveTestResult.statusCode,
        });

      } catch (error) {
        massiveTestResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Error desconegut',
          message: 'Error en test del sistema massiu',
        };
      }
    }

    // 5. OBTENIR LLISTA DE PLANTILLES DISPONIBLES
    const { data: availableTemplates } = await supabaseServerClient
      .from('plantilla_configs')
      .select('id, name, user_id, created_at, template_content, docx_storage_path')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    // 6. PREPARAR RESPOSTA COMPLETA
    const testResults = {
      success: true,
      timestamp: new Date().toISOString(),
      testConfiguration: {
        testMode,
        documentsCount,
        templateId: templateId || 'auto-selection',
        simulateError,
        userId: userId.substring(0, 8) + '...',
      },
      authentication: {
        success: true,
        userId: userId.substring(0, 8) + '...',
      },
      templateInvestigation,
      massiveGenerationTest: massiveTestResult,
      availableTemplates: {
        count: availableTemplates?.length || 0,
        templates: availableTemplates?.map(t => ({
          id: t.id,
          name: t.name,
          hasContent: !!t.template_content,
          hasStoragePath: !!t.docx_storage_path,
          contentLength: t.template_content?.length || 0,
        })) || [],
      },
      testData: {
        excelDataGenerated: testExcelData.length,
        sampleDocument: testExcelData[0],
      },
      recommendations: generateRecommendations(templateInvestigation, massiveTestResult, availableTemplates || []),
    };

    console.log(`✅ [TestMassive] Test completat amb èxit`);

    return NextResponse.json(testResults);

  } catch (error) {
    console.error(`❌ [TestMassive] Error en test:`, error);
    
    return NextResponse.json({
      success: false,
      error: 'Error crític en test del sistema',
      details: error instanceof Error ? error.message : 'Error desconegut',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    if (action === 'investigate-template') {
      const templateId = searchParams.get('templateId') || '365429f4-25b3-421f-a04e-b646d1e3939d';
      
      // Redirigir a l'endpoint específic d'investigació
      const response = await fetch(`${request.nextUrl.origin}/api/debug/investigate-template-specific`, {
        method: 'GET',
      });

      const result = await response.json();

      return NextResponse.json({
        success: true,
        action: 'investigate-template',
        templateId,
        investigation: result,
        message: 'Investigació de plantilla completada',
      });
    }

    // Status per defecte
    return NextResponse.json({
      success: true,
      message: 'Endpoint de test del sistema de generació massiva',
      availableActions: {
        'POST /': 'Executar test complet del sistema',
        'GET ?action=investigate-template&templateId=X': 'Investigar plantilla específica',
        'GET ?action=status': 'Aquest missatge d\'estat',
      },
      samplePostBody: {
        testMode: 'full', // 'full' | 'massive' | 'template-only'
        documentsCount: 5,
        templateId: '365429f4-25b3-421f-a04e-b646d1e3939d', // opcional
        simulateError: false,
      },
    });

  } catch (error) {
    console.error(`❌ [TestMassive] Error en GET:`, error);
    return NextResponse.json({
      success: false,
      error: 'Error en consulta de test',
      details: error instanceof Error ? error.message : 'Error desconegut',
    }, { status: 500 });
  }
}

/**
 * Genera recomanacions basades en els resultats del test
 */
function generateRecommendations(
  templateInvestigation: any,
  massiveTestResult: any,
  availableTemplates: any[]
): string[] {
  const recommendations: string[] = [];

  // Recomanacions sobre plantilles
  if (templateInvestigation) {
    if (!templateInvestigation.exists) {
      recommendations.push('La plantilla especificada no existeix. Utilitzar selecció automàtica de plantilles.');
    } else if (!templateInvestigation.hasContent) {
      recommendations.push('La plantilla no té contingut. Verificar o recrear la plantilla.');
    } else if (!templateInvestigation.hasStoragePath) {
      recommendations.push('La plantilla no té path de storage DOCX. Pujar document DOCX original.');
    }
  }

  // Recomanacions sobre generació massiva
  if (massiveTestResult) {
    if (massiveTestResult.success) {
      recommendations.push('Sistema de generació massiva funciona correctament. Llest per producció.');
    } else {
      recommendations.push('Sistema de generació massiva presenta errors. Revisar configuració i plantilles.');
    }
  }

  // Recomanacions sobre plantilles disponibles
  if (!availableTemplates || availableTemplates.length === 0) {
    recommendations.push('No hi ha plantilles disponibles. Crear almenys una plantilla abans de generar documents.');
  } else {
    const validTemplates = availableTemplates.filter(t => t.template_content && t.docx_storage_path);
    if (validTemplates.length === 0) {
      recommendations.push('Cap plantilla és completament vàlida. Verificar contingut i paths de storage.');
    } else if (validTemplates.length < availableTemplates.length) {
      recommendations.push(`${validTemplates.length}/${availableTemplates.length} plantilles són vàlides. Revisar les plantilles incompletes.`);
    }
  }

  // Recomanació general si tot està bé
  if (recommendations.length === 0) {
    recommendations.push('Sistema complet funciona correctament. Llest per generació massiva en producció.');
  }

  return recommendations;
}
