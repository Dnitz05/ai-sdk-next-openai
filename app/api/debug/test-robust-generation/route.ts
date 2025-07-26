/**
 * Test Endpoint per Verificar la Solució de Robustesa
 * 
 * Aquest endpoint simula tot el flux de generació per verificar que:
 * 1. El timeout intern del worker funciona correctament
 * 2. El processament individual optimitzat funciona
 * 3. Els estats es gestionen correctament fins i tot en cas d'error
 * 4. El frontend rebria la informació adequada
 */

import { NextRequest, NextResponse } from 'next/server';
import supabaseServerClient from '@/lib/supabase/server';

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  timestamp: string;
  details?: any;
}

export async function GET(request: NextRequest) {
  const testResults: TestResult[] = [];
  const testStartTime = Date.now();
  
  const addResult = (step: string, success: boolean, message: string, details?: any) => {
    testResults.push({
      step,
      success,
      message,
      timestamp: new Date().toISOString(),
      details
    });
  };

  try {
    addResult('TEST_START', true, 'Iniciant test de robustesa del sistema de generació');

    // 1. Buscar un projecte i generació reals per fer el test
    addResult('STEP_1', true, 'Buscant projecte i generació per al test...');
    
    const { data: projects, error: projectsError } = await supabaseServerClient
      .from('projects')
      .select('id, template_id, project_name')
      .limit(1);

    if (projectsError || !projects || projects.length === 0) {
      addResult('STEP_1', false, 'No s\'han trobat projectes per testar', { error: projectsError });
      return NextResponse.json({ success: false, results: testResults });
    }

    const testProject = projects[0];
    addResult('STEP_1', true, `Projecte trobat: ${testProject.project_name} (${testProject.id})`);

    // 2. Buscar una generació en estat pendent o crear-ne una de test
    const { data: generations, error: genError } = await supabaseServerClient
      .from('generations')
      .select('id, status, project_id')
      .eq('project_id', testProject.id)
      .in('status', ['pending', 'error'])
      .limit(1);

    let testGenerationId: string;

    if (genError || !generations || generations.length === 0) {
      addResult('STEP_2', true, 'No hi ha generacions disponibles. Creant generació de test...');
      
      // Crear una generació de test
      const { data: newGen, error: createError } = await supabaseServerClient
        .from('generations')
        .insert({
          project_id: testProject.id,
          status: 'pending',
          excel_row_index: 0,
          row_data: { 
            test: 'data',
            nom: 'Test Generació Robustesa',
            descripcio: 'Generació creada automàticament per al test de robustesa'
          }
        })
        .select('id')
        .single();

      if (createError || !newGen) {
        addResult('STEP_2', false, 'Error creant generació de test', { error: createError });
        return NextResponse.json({ success: false, results: testResults });
      }

      testGenerationId = newGen.id;
      addResult('STEP_2', true, `Generació de test creada: ${testGenerationId}`);
    } else {
      testGenerationId = generations[0].id;
      addResult('STEP_2', true, `Generació trobada per testar: ${testGenerationId}`);
    }

    // 3. Simular crida del frontend - Invocar API disparador
    addResult('STEP_3', true, 'Invocant API disparador...');
    
    const triggerUrl = `${request.nextUrl.origin}/api/reports/generate-smart-enhanced`;
    const triggerResponse = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: testProject.id,
        generationId: testGenerationId
      })
    });

    const triggerResult = await triggerResponse.json();
    
    if (!triggerResponse.ok) {
      addResult('STEP_3', false, `Error en API disparador: ${triggerResponse.status}`, triggerResult);
      return NextResponse.json({ success: false, results: testResults });
    }

    addResult('STEP_3', true, 'API disparador invocat correctament', {
      status: triggerResponse.status,
      response: triggerResult
    });

    // 4. Simular polling del frontend - Comprovar estat de manera periòdica
    addResult('STEP_4', true, 'Iniciant simulació de polling del frontend...');
    
    const MAX_POLLING_TIME = 90000; // 90 segons màxim per al test
    const POLL_INTERVAL = 3000; // 3 segons entre cada polling
    const pollingStartTime = Date.now();
    
    let finalStatus = null;
    let pollingCount = 0;
    
    while (Date.now() - pollingStartTime < MAX_POLLING_TIME) {
      pollingCount++;
      
      // Simular crida de polling
      const statusUrl = `${request.nextUrl.origin}/api/reports/generations?generationId=${testGenerationId}`;
      const statusResponse = await fetch(statusUrl, {
        headers: {
          'Cache-Control': 'no-cache',
        }
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const currentStatus = statusData.generation?.status;
        
        addResult('POLLING', true, `Poll #${pollingCount}: Estat = ${currentStatus}`, {
          pollingDuration: Date.now() - pollingStartTime,
          generationData: statusData.generation
        });

        // Comprovar si hem arribat a un estat final
        if (['generated', 'completed', 'error'].includes(currentStatus)) {
          finalStatus = currentStatus;
          addResult('STEP_4', true, `Polling completat. Estat final: ${finalStatus}`, {
            totalPolls: pollingCount,
            totalPollingTime: Date.now() - pollingStartTime
          });
          break;
        }
      } else {
        addResult('POLLING', false, `Poll #${pollingCount}: Error HTTP ${statusResponse.status}`, {
          pollingDuration: Date.now() - pollingStartTime
        });
      }
      
      // Esperar abans del següent poll
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }

    // 5. Analitzar resultats finals
    if (!finalStatus) {
      addResult('STEP_5', false, 'Timeout del test: La generació no ha arribat a un estat final dins del temps límit', {
        pollingDuration: Date.now() - pollingStartTime,
        totalPolls: pollingCount
      });
    } else {
      const success = ['generated', 'completed'].includes(finalStatus);
      addResult('STEP_5', success, success 
        ? 'Test completat amb èxit: La generació s\'ha processat correctament'
        : 'Test completat amb error controlat: La generació ha fallat però l\'estat s\'ha gestionat correctament', 
        {
          finalStatus,
          totalPolls: pollingCount,
          pollingDuration: Date.now() - pollingStartTime
        }
      );
    }

    // 6. Netejar dades de test (opcional)
    addResult('CLEANUP', true, 'Netejant dades de test (deixem la generació per inspecció manual)');

    const totalTestTime = Date.now() - testStartTime;
    const overallSuccess = testResults.every(r => r.success || r.step === 'POLLING');

    return NextResponse.json({
      success: overallSuccess,
      message: overallSuccess 
        ? 'Test de robustesa completat amb èxit' 
        : 'Test de robustesa completat amb errors',
      testSummary: {
        totalTestTime,
        testGenerationId,
        testProject: testProject.project_name,
        finalStatus,
        totalPolls: pollingCount
      },
      results: testResults
    });

  } catch (error) {
    const totalTestTime = Date.now() - testStartTime;
    addResult('ERROR', false, `Error crític durant el test: ${error instanceof Error ? error.message : 'Error desconegut'}`, {
      error: error instanceof Error ? error.stack : error
    });

    return NextResponse.json({
      success: false,
      message: 'Test de robustesa fallit per error crític',
      testSummary: {
        totalTestTime,
        errorOccurred: true
      },
      results: testResults
    }, { status: 500 });
  }
}

/**
 * POST endpoint per executar tests amb paràmetres específics
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, generationId, skipCleanup } = body;

    // Validacions
    if (!projectId || !generationId) {
      return NextResponse.json({
        success: false,
        message: 'projectId i generationId són obligatoris per al test POST'
      }, { status: 400 });
    }

    // Re-dirigir a GET amb paràmetres (simplificat per al test)
    return NextResponse.json({
      success: true,
      message: 'Test POST configurat. Utilitza GET per executar el test complet.',
      parameters: { projectId, generationId, skipCleanup }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Error en configuració del test POST',
      error: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 });
  }
}
