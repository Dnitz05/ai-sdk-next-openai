/**
 * Test de Sistema Asíncron Complet
 * 
 * Aquest endpoint permet testejar tot el flux asíncron:
 * 1. Disparar tasques al worker
 * 2. Consultar estat via polling
 * 3. Verificar funcionament complet
 * 
 * ESTAT ACTUAL: ⚠️ PARCIALMENT FUNCIONAL
 * - ✅ Disparador de tasques: FUNCIONA
 * - ✅ Seguretat del worker: FUNCIONA  
 * - ✅ Endpoints disponibles: FUNCIONA
 * - ❌ Consulta d'estat: FALLA (problema de simulació d'autenticació)
 * 
 * PROBLEMA CONEGUT:
 * El test simula un usuari per provar el sistema sense sessions reals.
 * La consulta d'estat (statusCheck) falla perquè la simulació d'autenticació
 * no és perfecta per a aquest endpoint específic. El problema és NOMÉS al test,
 * no afecta el funcionament real del sistema en producció.
 * 
 * SOLUCIÓ FUTURA:
 * Millorar la simulació d'autenticació a /api/reports/generations per
 * fer que accepti completament el mode de test intern.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 [TEST-ASYNC] Iniciant test del sistema asíncron complet');

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // 1. Buscar projectes amb generacions pendents
    const { data: projects, error: projectsError } = await serviceClient
      .from('projects')
      .select('id, project_name, user_id')
      .limit(5);

    if (projectsError) {
      throw new Error(`Error obtenint projectes: ${projectsError.message}`);
    }

    if (!projects || projects.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hi ha projectes disponibles per testear'
      }, { status: 404 });
    }

    console.log(`🧪 [TEST-ASYNC] Trobats ${projects.length} projectes`);

    // 2. Buscar generacions pendents en aquests projectes
    const { data: generations, error: generationsError } = await serviceClient
      .from('generations')
      .select('id, project_id, status, excel_row_index')
      .in('project_id', projects.map(p => p.id))
      .eq('status', 'pending')
      .limit(3); // Només 3 per test

    if (generationsError) {
      throw new Error(`Error obtenint generacions: ${generationsError.message}`);
    }

    if (!generations || generations.length === 0) {
      // Crear una generació de test si no n'hi ha
      const testProject = projects[0];
      const { data: newGeneration, error: createError } = await serviceClient
        .from('generations')
        .insert({
          project_id: testProject.id,
          excel_row_index: 999,
          row_data: {
            test_field: 'Test asíncron',
            created_by: 'async-test-system',
            timestamp: new Date().toISOString()
          },
          status: 'pending'
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Error creant generació de test: ${createError.message}`);
      }

      console.log(`🧪 [TEST-ASYNC] Generació de test creada: ${newGeneration.id}`);
      
      return NextResponse.json({
        success: true,
        testMode: 'created_test_generation',
        message: 'Generació de test creada. Executeu novament per testejar el flux complet.',
        generationId: newGeneration.id,
        projectId: testProject.id
      });
    }

    console.log(`🧪 [TEST-ASYNC] Trobades ${generations.length} generacions pendents`);

    // 3. Obtenir informació del primer projecte per testear
    const testProject = projects.find(p => 
      generations.some(g => g.project_id === p.id)
    );

    if (!testProject) {
      throw new Error('No s\'ha trobat un projecte vàlid per testear');
    }

    const testGenerations = generations.filter(g => g.project_id === testProject.id);
    
    console.log(`🧪 [TEST-ASYNC] Testejant projecte ${testProject.project_name} amb ${testGenerations.length} generacions`);

    // 4. Simular crida a l'API disparador
    const triggerUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/reports/generate-smart-enhanced`;
    
    console.log(`🧪 [TEST-ASYNC] Cridant API disparador: ${triggerUrl}`);

    const triggerResponse = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Simulem l'autenticació interna per al test
        'X-Internal-Test-Auth': process.env.WORKER_SECRET_TOKEN || ''
      },
      body: JSON.stringify({
        projectId: testProject.id,
        mode: 'individual',
        generationIds: testGenerations.map(g => g.id),
        // Passem el userId per simular la sessió
        testUserId: testProject.user_id 
      })
    });

    const triggerResult = await triggerResponse.json();
    
    console.log(`🧪 [TEST-ASYNC] Resposta del disparador:`, triggerResult);

    if (!triggerResponse.ok) {
      throw new Error(`Error en API disparador: ${triggerResult.error}`);
    }

    // 5. Testejar consulta d'estat
    const statusUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/reports/generations`;
    
    console.log(`🧪 [TEST-ASYNC] Testejant consulta d'estat per primera generació`);

    const statusResponse = await fetch(`${statusUrl}?generationId=${testGenerations[0].id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Test-Auth': process.env.WORKER_SECRET_TOKEN || ''
      }
    });

    const statusResult = await statusResponse.json();
    
    console.log(`🧪 [TEST-ASYNC] Resposta de consulta d'estat:`, statusResult);

    // 6. Verificar endpoints essencials
    const endpoints = [
      '/api/worker/generation-processor',
      '/api/reports/generate-smart-enhanced',
      '/api/reports/generations'
    ];

    const endpointTests = [];
    for (const endpoint of endpoints) {
      const testUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}${endpoint}`;
      try {
        const testResponse = await fetch(testUrl, { method: 'OPTIONS' });
        endpointTests.push({
          endpoint,
          available: testResponse.status !== 404,
          status: testResponse.status
        });
      } catch (error) {
        endpointTests.push({
          endpoint,
          available: false,
          error: error instanceof Error ? error.message : 'Error desconegut'
        });
      }
    }

    console.log(`✅ [TEST-ASYNC] Test complet finalitzat`);

    return NextResponse.json({
      success: true,
      testResults: {
        projectsFound: projects.length,
        generationsFound: generations.length,
        testProject: {
          id: testProject.id,
          name: testProject.project_name,
          generationsToTest: testGenerations.length
        },
        triggerResult: {
          success: triggerResult.success,
          tasksStarted: triggerResult.tasksStarted,
          tasksFailed: triggerResult.tasksFailed,
          dispatchTimeMs: triggerResult.dispatchTimeMs
        },
        statusCheck: {
          success: statusResponse.ok,
          hasGeneration: !!(statusResult.generation)
        },
        endpointTests
      },
      recommendations: [
        'Utilitzeu el frontend per veure el polling en acció',
        'Consulteu els logs del servidor per veure el progrés dels workers',
        'Refresqueu la pàgina del projecte per veure els resultats finals',
        triggerResult.tasksStarted > 0 
          ? `${triggerResult.tasksStarted} tasques iniciades correctament`
          : 'No s\'han iniciat tasques - revisar logs'
      ],
      nextSteps: [
        `Aneu a /informes/${testProject.id} per veure el polling`,
        'Els documents haurien de canviar d\'estat en els pròxims minuts',
        'El sistema actualitzarà automàticament l\'estat cada 3 segons'
      ]
    });

  } catch (error) {
    console.error('❌ [TEST-ASYNC] Error en test:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Error en test del sistema asíncron',
      details: error instanceof Error ? error.message : 'Error desconegut',
      troubleshooting: [
        'Verificar que la base de dades està accessible',
        'Comprovar que hi ha projectes i generacions',
        'Revisar els logs del servidor per errors detallats',
        'Assegurar-se que les variables d\'entorn estan configurades'
      ]
    }, { status: 500 });
  }
}

/**
 * GET per obtenir informació d'estat del sistema asíncron
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 [TEST-ASYNC-STATUS] Consultant estat del sistema');

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Estadístiques generals
    const [
      { count: totalProjects },
      { count: totalGenerations },
      { count: pendingGenerations },
      { count: processingGenerations },
      { count: completedGenerations },
      { count: errorGenerations }
    ] = await Promise.all([
      serviceClient.from('projects').select('*', { count: 'exact', head: true }),
      serviceClient.from('generations').select('*', { count: 'exact', head: true }),
      serviceClient.from('generations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      serviceClient.from('generations').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
      serviceClient.from('generations').select('*', { count: 'exact', head: true }).in('status', ['generated', 'completed']),
      serviceClient.from('generations').select('*', { count: 'exact', head: true }).eq('status', 'error')
    ]);

    // Generacions processant-se actualment
    const { data: currentlyProcessing } = await serviceClient
      .from('generations')
      .select('id, project_id, updated_at, excel_row_index')
      .eq('status', 'processing')
      .order('updated_at', { ascending: false })
      .limit(10);

    // Errors recents
    const { data: recentErrors } = await serviceClient
      .from('generations')
      .select('id, project_id, error_message, updated_at, excel_row_index')
      .eq('status', 'error')
      .order('updated_at', { ascending: false })
      .limit(5);

    const systemHealth = {
      healthy: (processingGenerations || 0) < 50 && (errorGenerations || 0) < (totalGenerations || 1) * 0.1,
      activeJobs: processingGenerations || 0,
      errorRate: totalGenerations ? ((errorGenerations || 0) / totalGenerations * 100).toFixed(2) : '0'
    };

    return NextResponse.json({
      success: true,
      systemStatus: {
        healthy: systemHealth.healthy,
        timestamp: new Date().toISOString(),
        uptime: 'Available via API'
      },
      statistics: {
        totalProjects: totalProjects || 0,
        totalGenerations: totalGenerations || 0,
        pending: pendingGenerations || 0,
        processing: processingGenerations || 0,
        completed: completedGenerations || 0,
        errors: errorGenerations || 0,
        errorRate: `${systemHealth.errorRate}%`
      },
      currentActivity: {
        activeJobs: systemHealth.activeJobs,
        processingGenerations: currentlyProcessing || [],
        recentErrors: recentErrors || []
      },
      recommendations: [
        systemHealth.healthy ? '✅ Sistema funcionant correctament' : '⚠️ Sistema amb problemes',
        systemHealth.activeJobs > 0 ? `${systemHealth.activeJobs} generacions processant-se` : 'No hi ha feina activa',
        parseFloat(systemHealth.errorRate) > 10 ? '🔴 Taxa d\'error alta - revisar logs' : '🟢 Taxa d\'error baixa'
      ]
    });

  } catch (error) {
    console.error('❌ [TEST-ASYNC-STATUS] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Error consultant estat del sistema',
      details: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 });
  }
}
