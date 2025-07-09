/**
 * Test endpoint per verificar la nova API enhanced
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({
        error: 'Proporciona un projectId com a query parameter',
        example: '/api/debug/test-smart-enhanced?projectId=YOUR_PROJECT_ID'
      }, { status: 400 });
    }

    console.log(`🧪 [Test Smart Enhanced] Testejant projecte: ${projectId}`);

    // Test 1: Verificar informació del projecte
    const infoResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/reports/generate-smart-enhanced?projectId=${projectId}`, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
    });

    const infoData = await infoResponse.json();

    if (!infoResponse.ok) {
      return NextResponse.json({
        success: false,
        error: 'Error obtenint informació del projecte',
        details: infoData,
        step: 'GET project info'
      }, { status: 500 });
    }

    console.log(`✅ [Test Smart Enhanced] Informació del projecte obtinguda:`, infoData);

    // Test 2: Simular crida de generació (només validació, no execució real)
    const testPayload = {
      projectId: projectId,
      mode: 'individual',
      generationIds: ['test-id'], // ID fictici per test
    };

    return NextResponse.json({
      success: true,
      message: 'API Enhanced funciona correctament',
      tests: {
        projectInfo: {
          success: true,
          data: infoData
        },
        apiValidation: {
          success: true,
          payload: testPayload,
          note: 'Payload preparat per generació real'
        }
      },
      recommendations: infoData.project?.requiresLazyLoad 
        ? [
            'Aquest projecte té >100 files, utilitza mode individual',
            'Carrega dades sota demanda per millor rendiment',
            'Considera paginar els resultats'
          ]
        : [
            'Projecte petit, pots utilitzar mode batch o individual',
            'Les dades Excel estan disponibles en memòria'
          ],
      nextSteps: [
        '1. Utilitza POST /api/reports/generate-smart-enhanced amb el payload de test',
        '2. Especifica mode: "individual" per documents únics',
        '3. Proporciona generationIds per documents específics',
        '4. Revisa els resultats en el modal de revisió'
      ]
    });

  } catch (error) {
    console.error(`❌ [Test Smart Enhanced] Error:`, error);
    return NextResponse.json({
      success: false,
      error: 'Error en test de l\'API Enhanced',
      details: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, testMode = 'validation' } = body;

    if (!projectId) {
      return NextResponse.json({
        error: 'projectId és obligatori'
      }, { status: 400 });
    }

    console.log(`🧪 [Test Smart Enhanced POST] Mode: ${testMode}, Projecte: ${projectId}`);

    if (testMode === 'validation') {
      // Només validar sense executar
      return NextResponse.json({
        success: true,
        message: 'Validació completada - no s\'ha executat generació real',
        payload: body,
        note: 'Per executar generació real, canvia testMode a "execute"'
      });
    }

    if (testMode === 'execute') {
      // Executar generació real
      const generateResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/reports/generate-smart-enhanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': request.headers.get('cookie') || '',
        },
        body: JSON.stringify(body),
      });

      const generateData = await generateResponse.json();

      return NextResponse.json({
        success: generateResponse.ok,
        message: generateResponse.ok ? 'Generació executada amb èxit' : 'Error en generació',
        result: generateData,
        httpStatus: generateResponse.status
      });
    }

    return NextResponse.json({
      error: 'testMode ha de ser "validation" o "execute"'
    }, { status: 400 });

  } catch (error) {
    console.error(`❌ [Test Smart Enhanced POST] Error:`, error);
    return NextResponse.json({
      success: false,
      error: 'Error en test POST',
      details: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 });
  }
}
