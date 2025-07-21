import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 [Test] Iniciant test de fix individual smart generation');

    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId és obligatori per al test' },
        { status: 400 }
      );
    }

    // Crear client SSR per llegir cookies de la sessió
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => {
            return request.cookies.getAll().map(cookie => ({
              name: cookie.name,
              value: cookie.value,
            }))
          },
          setAll: () => {
            // No necessitem setAll en aquest context
          }
        }
      }
    );

    // Obtenir userId de la sessió
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ [Test] Error d\'autenticació:', authError);
      return NextResponse.json(
        { success: false, error: 'Usuari no autenticat' },
        { status: 401 }
      );
    }

    console.log(`👤 [Test] Usuari autenticat: ${user.id}`);

    // 1. Obtenir generacions pendents del projecte
    console.log(`📋 [Test] Buscant generacions pendents per projecte: ${projectId}`);
    
    const { data: pendingGenerations, error: genError } = await supabase
      .from('generations')
      .select('id, excel_row_index, status, row_data')
      .eq('project_id', projectId)
      .eq('status', 'pending')
      .limit(3); // Limitar a 3 per al test

    if (genError) {
      console.error('❌ [Test] Error obtenint generacions:', genError);
      return NextResponse.json(
        { success: false, error: 'Error obtenint generacions pendents' },
        { status: 500 }
      );
    }

    if (!pendingGenerations || pendingGenerations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hi ha generacions pendents per testejar',
        pendingCount: 0
      });
    }

    console.log(`🎯 [Test] Trobades ${pendingGenerations.length} generacions pendents`);

    // 2. Simular la crida a l'API de generació individual (la que estava fallant)
    const generationIds = pendingGenerations.map(g => g.id);
    
    console.log(`🚀 [Test] Simulant crida a generate-smart-enhanced amb mode individual`);
    console.log(`📝 [Test] GenerationIds: ${generationIds.join(', ')}`);

    const testStartTime = Date.now();

    // Cridar l'API real per testejar
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: 'Error obtenint sessió' },
        { status: 401 }
      );
    }

    const generateResponse = await fetch(`${request.nextUrl.origin}/api/reports/generate-smart-enhanced`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || ''
      },
      body: JSON.stringify({
        projectId: projectId,
        mode: 'individual',
        generationIds: generationIds
      })
    });

    const generateResult = await generateResponse.json();
    const testEndTime = Date.now();

    console.log(`📊 [Test] Resposta de l'API:`, generateResult);

    // 3. Verificar que l'estat s'ha actualitzat correctament
    console.log(`🔍 [Test] Verificant estat després de la generació...`);
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segons

    const { data: updatedGenerations, error: updateError } = await supabase
      .from('generations')
      .select('id, status, error_message')
      .in('id', generationIds);

    if (updateError) {
      console.error('❌ [Test] Error verificant estat actualitzat:', updateError);
      return NextResponse.json(
        { success: false, error: 'Error verificant estat actualitzat' },
        { status: 500 }
      );
    }

    // 4. Analitzar resultats
    const statusCounts = updatedGenerations.reduce((acc: any, gen: any) => {
      acc[gen.status] = (acc[gen.status] || 0) + 1;
      return acc;
    }, {});

    const allGenerated = updatedGenerations.every((gen: any) => gen.status === 'generated');
    const hasErrors = updatedGenerations.some((gen: any) => gen.status === 'error');

    console.log(`📈 [Test] Recompte d'estats:`, statusCounts);
    console.log(`✅ [Test] Tots generats: ${allGenerated}`);
    console.log(`❌ [Test] Té errors: ${hasErrors}`);

    return NextResponse.json({
      success: true,
      testResults: {
        initialPendingCount: pendingGenerations.length,
        generationIds: generationIds,
        apiResponse: generateResult,
        statusAfterGeneration: statusCounts,
        allSuccessfullyGenerated: allGenerated,
        hasErrors: hasErrors,
        testDurationMs: testEndTime - testStartTime,
        updatedGenerations: updatedGenerations,
        fixWorking: generateResult.success && allGenerated && !hasErrors
      },
      conclusion: generateResult.success && allGenerated && !hasErrors 
        ? '🎉 FIX FUNCIONA! Els documents es generen i l\'estat s\'actualitza correctament.'
        : '⚠️ Hi ha problemes. Revisar els detalls.',
      recommendations: [
        generateResult.success ? '✅ API genera documents correctament' : '❌ API té problemes',
        allGenerated ? '✅ Estat actualitzat a "generated"' : '❌ Estat no s\'actualitza',
        !hasErrors ? '✅ No hi ha errors' : '❌ Hi ha errors en algunes generacions'
      ]
    });

  } catch (error) {
    console.error('❌ [Test] Error crític:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error intern en test',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
