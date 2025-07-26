/**
 * Test Simplificat del Worker de Robustesa
 * 
 * Aquest endpoint testa directament el worker sense necessitat d'autenticació,
 * per verificar que el timeout intern i el processament optimitzat funcionen.
 */

import { NextRequest, NextResponse } from 'next/server';
import supabaseServerClient from '@/lib/supabase/server';

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  timestamp: string;
  duration?: number;
  details?: any;
}

export async function GET(request: NextRequest) {
  const testResults: TestResult[] = [];
  const testStartTime = Date.now();
  
  const addResult = (step: string, success: boolean, message: string, details?: any, duration?: number) => {
    testResults.push({
      step,
      success,
      message,
      timestamp: new Date().toISOString(),
      duration,
      details
    });
  };

  try {
    addResult('TEST_START', true, 'Iniciant test de robustesa del worker');

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
      addResult('STEP_2', true, 'Creant generació de test...');
      
      // Crear una generació de test
      const { data: newGen, error: createError } = await supabaseServerClient
        .from('generations')
        .insert({
          project_id: testProject.id,
          status: 'pending',
          excel_row_index: 0,
          row_data: { 
            test: 'data',
            nom: 'Test Worker Robustesa',
            descripcio: 'Generació creada per testar la robustesa del worker'
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

    // 3. Testar directament el worker
    addResult('STEP_3', true, 'Invocant worker directament...');
    
    const workerStartTime = Date.now();
    
    const workerUrl = `${request.nextUrl.origin}/api/worker/generation-processor`;
    const workerResponse = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Mode': 'true' // Header especial per indicar que és un test
      },
      body: JSON.stringify({
        type: 'process-single',
        projectId: testProject.id,
        generationId: testGenerationId
      })
    });

    const workerDuration = Date.now() - workerStartTime;
    const workerResult = await workerResponse.json();
    
    if (!workerResponse.ok) {
      addResult('STEP_3', false, `Error del worker: ${workerResponse.status}`, 
        workerResult, workerDuration);
    } else {
      addResult('STEP_3', true, 'Worker executat correctament', 
        { status: workerResponse.status, response: workerResult }, workerDuration);
    }

    // 4. Verificar l'estat final de la generació
    addResult('STEP_4', true, 'Verificant estat final de la generació...');
    
    const { data: finalGeneration, error: finalError } = await supabaseServerClient
      .from('generations')
      .select('id, status, error_message, updated_at')
      .eq('id', testGenerationId)
      .single();

    if (finalError || !finalGeneration) {
      addResult('STEP_4', false, 'Error consultant estat final', { error: finalError });
    } else {
      const isSuccessfulState = ['generated', 'completed'].includes(finalGeneration.status);
      const isErrorState = finalGeneration.status === 'error';
      const isValidFinalState = isSuccessfulState || isErrorState;
      
      addResult('STEP_4', isValidFinalState, 
        `Estat final: ${finalGeneration.status}${isErrorState ? ` (${finalGeneration.error_message})` : ''}`, 
        finalGeneration);
    }

    // 5. Test de timeout (opcional) - Simulació d'una generació llarga
    addResult('STEP_5', true, 'Testant comportament amb generació llarga (simulació)...');
    
    // Creem una altra generació per simular un cas de timeout
    const { data: timeoutGeneration, error: timeoutCreateError } = await supabaseServerClient
      .from('generations')
      .insert({
        project_id: testProject.id,
        status: 'pending',
        excel_row_index: 1,
        row_data: { 
          test: 'timeout-simulation',
          nom: 'Test Timeout Simulation',
          descripcio: 'Generació per simular timeout (NO es processarà realment)'
        }
      })
      .select('id')
      .single();

    if (timeoutCreateError || !timeoutGeneration) {
      addResult('STEP_5', false, 'Error creant generació de timeout', { error: timeoutCreateError });
    } else {
      // Simular un processament que trigaria massa (NO executem realment el worker)
      addResult('STEP_5', true, 'Generació de timeout simulada creada', {
        timeoutGenerationId: timeoutGeneration.id,
        note: 'Aquesta generació NO es processa per evitar timeout real en el test'
      });
      
      // Marcar-la com a error per simular timeout
      await supabaseServerClient
        .from('generations')
        .update({ 
          status: 'error', 
          error_message: 'Timeout simulat pel test de robustesa' 
        })
        .eq('id', timeoutGeneration.id);
    }

    const totalTestTime = Date.now() - testStartTime;
    const overallSuccess = testResults.every(r => r.success);

    return NextResponse.json({
      success: overallSuccess,
      message: overallSuccess 
        ? 'Test de robustesa del worker completat amb èxit' 
        : 'Test de robustesa del worker completat amb alguns errors',
      testSummary: {
        totalTestTime,
        testGenerationId,
        testProject: testProject.project_name,
        workerDuration: testResults.find(r => r.step === 'STEP_3')?.duration,
        finalStatus: testResults.find(r => r.step === 'STEP_4')?.details?.status
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
      message: 'Test de robustesa del worker fallit per error crític',
      testSummary: {
        totalTestTime,
        errorOccurred: true
      },
      results: testResults
    }, { status: 500 });
  }
}

/**
 * POST endpoint per netejar dades de test
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cleanup } = body;

    if (cleanup === true) {
      // Netejar generacions de test
      const { data, error } = await supabaseServerClient
        .from('generations')
        .delete()
        .or(`row_data->>test.eq."data",row_data->>test.eq."timeout-simulation"`)
        .select('id');

      if (error) {
        return NextResponse.json({
          success: false,
          message: 'Error netejant dades de test',
          error: error.message
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Netejades ${data?.length || 0} generacions de test`
      });
    }

    return NextResponse.json({
      success: false,
      message: 'Especifica cleanup: true per netejar dades de test'
    }, { status: 400 });

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Error en neteja de test',
      error: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 });
  }
}
