/**
 * Test Final del Sistema de Generació Asíncrona
 * 
 * Prova tant el mode individual com el mode batch amb el nou worker blindat
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log(`🧪 [Test-Final] Iniciant test complet del sistema asíncron millorat`);

    const body = await request.json();
    const { mode = 'individual', projectId: providedProjectId } = body;

    if (!['individual', 'batch'].includes(mode)) {
      return NextResponse.json(
        { success: false, error: 'mode ha de ser "individual" o "batch"' },
        { status: 400 }
      );
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Buscar un projecte de test vàlid
    let projectId = providedProjectId;
    if (!projectId) {
      const { data: projects, error: projectsError } = await serviceClient
        .from('projects')
        .select('id, project_name, template_id, total_rows')
        .limit(1);

      if (projectsError || !projects || projects.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No hi ha projectes disponibles per al test' },
          { status: 404 }
        );
      }
      projectId = projects[0].id;
      console.log(`🧪 [Test-Final] Utilitzant projecte: ${projects[0].project_name} (${projectId})`);
    }

    // 2. Obtenir dades del projecte
    const { data: project, error: projectError } = await serviceClient
      .from('projects')
      .select(`
        id,
        project_name,
        template_id,
        total_rows,
        excel_data,
        user_id
      `)
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { success: false, error: `Projecte ${projectId} no trobat` },
        { status: 404 }
      );
    }

    console.log(`🧪 [Test-Final] Projecte carregat: ${project.project_name} amb ${project.total_rows} files`);

    // 3. Crear o verificar generacions de test
    let targetGenerations: string[] = [];

    if (mode === 'individual') {
      console.log(`🧪 [Test-Final] Mode individual: Creant 2 generacions de test`);

      // Crear 2 generacions individuals per al test
      const testData = project.excel_data?.slice(0, 2) || [
        { nom: 'Test 1', camp1: 'valor1' },
        { nom: 'Test 2', camp1: 'valor2' }
      ];

      for (let i = 0; i < testData.length; i++) {
        const { data: newGen, error: createError } = await serviceClient
          .from('generations')
          .insert({
            project_id: projectId,
            row_data: testData[i],
            excel_row_index: i + 1,
            status: 'pending',
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (createError) {
          console.error(`❌ [Test-Final] Error creant generació ${i + 1}:`, createError);
        } else {
          targetGenerations.push(newGen.id);
          console.log(`✅ [Test-Final] Generació ${i + 1} creada: ${newGen.id}`);
        }
      }
    } else {
      console.log(`🧪 [Test-Final] Mode batch: Buscant generacions pendents existents`);

      // Mode batch: buscar generacions pendents existents
      const { data: existing, error: existingError } = await serviceClient
        .from('generations')
        .select('id, status')
        .eq('project_id', projectId)
        .eq('status', 'pending')
        .limit(5);

      if (existingError) {
        console.error(`❌ [Test-Final] Error buscant generacions pendents:`, existingError);
        return NextResponse.json(
          { success: false, error: 'Error buscant generacions pendents' },
          { status: 500 }
        );
      }

      if (!existing || existing.length === 0) {
        console.log(`🧪 [Test-Final] No hi ha generacions pendents, creant 3 per al test batch`);

        // Crear 3 generacions per al test batch
        const testData = project.excel_data?.slice(0, 3) || [
          { nom: 'Batch Test 1', camp1: 'valor1' },
          { nom: 'Batch Test 2', camp1: 'valor2' },
          { nom: 'Batch Test 3', camp1: 'valor3' }
        ];

        for (let i = 0; i < testData.length; i++) {
          const { data: newGen, error: createError } = await serviceClient
            .from('generations')
            .insert({
              project_id: projectId,
              row_data: testData[i],
              excel_row_index: i + 1,
              status: 'pending',
              created_at: new Date().toISOString()
            })
            .select('id')
            .single();

          if (!createError) {
            targetGenerations.push(newGen.id);
            console.log(`✅ [Test-Final] Generació batch ${i + 1} creada: ${newGen.id}`);
          }
        }
      } else {
        targetGenerations = existing.map(g => g.id);
        console.log(`🧪 [Test-Final] Utilitzant ${existing.length} generacions pendents existents`);
      }
    }

    if (targetGenerations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No s\'han pogut crear ni trobar generacions per al test' },
        { status: 500 }
      );
    }

    console.log(`🧪 [Test-Final] ${targetGenerations.length} generacions preparades per al test ${mode}`);

    // 4. Cridar l'API de generació asíncrona
    const apiUrl = `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}/api/reports/generate-smart-enhanced`;
    
    const apiPayload = {
      projectId: projectId,
      mode: mode,
      testUserId: project.user_id,
      ...(mode === 'individual' && { generationIds: targetGenerations })
    };

    console.log(`🧪 [Test-Final] Cridant API: ${apiUrl}`);

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Test-Auth': process.env.WORKER_SECRET_TOKEN!
      },
      body: JSON.stringify(apiPayload)
    });

    const apiResult = await apiResponse.json();

    console.log(`🧪 [Test-Final] Resposta API:`, {
      status: apiResponse.status,
      success: apiResult.success,
      tasksStarted: apiResult.tasksStarted,
      message: apiResult.message
    });

    // 5. Esperar uns segons i comprovar l'estat
    console.log(`🧪 [Test-Final] Esperant 15 segons per comprovar el progres...`);
    
    await new Promise(resolve => setTimeout(resolve, 15000));

    const { data: finalStates, error: stateError } = await serviceClient
      .from('generations')
      .select('id, status, error_message, updated_at')
      .in('id', targetGenerations);

    if (stateError) {
      console.error(`❌ [Test-Final] Error consultant estats finals:`, stateError);
    } else {
      console.log(`🧪 [Test-Final] Estats finals:`, finalStates);
    }

    const stateCounts = finalStates?.reduce((acc: any, gen: any) => {
      acc[gen.status] = (acc[gen.status] || 0) + 1;
      return acc;
    }, {}) || {};

    const totalTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      mode: mode,
      projectId: projectId,
      projectName: project.project_name,
      generationsCreated: targetGenerations.length,
      apiResponse: {
        status: apiResponse.status,
        success: apiResult.success,
        tasksStarted: apiResult.tasksStarted,
        tasksFailed: apiResult.tasksFailed
      },
      finalStates: stateCounts,
      generationDetails: finalStates,
      testTimeMs: totalTime,
      workerSystemStatus: targetGenerations.length > 0 && stateCounts.processing === 0 ? 'ROBUST' : 'PROCESSING',
      verdict: apiResult.success && targetGenerations.length > 0 ? 'TEST PASSED ✅' : 'TEST NEEDS REVIEW ⚠️'
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [Test-Final] Error crític:`, error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error en test final',
        details: error instanceof Error ? error.message : 'Error desconegut',
        testTimeMs: totalTime,
      },
      { status: 500 }
    );
  }
}
