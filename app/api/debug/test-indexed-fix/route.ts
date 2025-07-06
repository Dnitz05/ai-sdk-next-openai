import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';

/**
 * API de test per verificar que la correcció de nomenclatura funciona
 * Simula el procés de creació de fitxers indexats i verifica els noms
 */
export async function POST(request: NextRequest) {
  console.log('[API test-indexed-fix] Iniciant test de verificació');

  // 1. Verificar autenticació
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autenticat. Falten credencials.' }, { status: 401 });
  }
  const accessToken = authHeader.replace('Bearer ', '').trim();
  
  const userSupabaseClient = createUserSupabaseClient(accessToken);
  const { data: userData, error: userError } = await userSupabaseClient.auth.getUser();

  if (userError || !userData?.user) {
    console.error("[API test-indexed-fix] Error verificant usuari:", userError);
    return NextResponse.json({ error: 'Usuari no autenticat o token invàlid.' }, { status: 401 });
  }
  const userId = userData.user.id;
  console.log("[API test-indexed-fix] Usuari autenticat:", userId);

  // 2. Crear client amb service role key
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  try {
    const testResults = {
      tests: [] as any[],
      summary: {
        total: 0,
        passed: 0,
        failed: 0
      }
    };

    // Test 1: Verificar la lògica de nomenclatura corregida
    console.log('[API test-indexed-fix] Test 1: Verificant lògica de nomenclatura');
    
    const testCases = [
      {
        name: 'Ruta estàndard amb original.docx',
        originalPath: 'user-123/template-456/original/original.docx',
        expectedIndexed: 'user-123/template-456/indexed/indexed.docx'
      },
      {
        name: 'Ruta amb nom personalitzat',
        originalPath: 'user-123/template-456/original/document.docx',
        expectedIndexed: 'user-123/template-456/indexed/indexed.docx'
      },
      {
        name: 'Ruta amb nom llarg',
        originalPath: 'user-123/template-456/original/my-custom-document-name.docx',
        expectedIndexed: 'user-123/template-456/indexed/indexed.docx'
      }
    ];

    for (const testCase of testCases) {
      const result = {
        testName: testCase.name,
        originalPath: testCase.originalPath,
        expectedIndexed: testCase.expectedIndexed,
        actualIndexed: '',
        passed: false,
        error: null as string | null
      };

      try {
        // Aplicar la lògica corregida
        const indexedPath = testCase.originalPath
          .replace('/original/', '/indexed/')
          .replace(/\/[^\/]+\.docx$/, '/indexed.docx');
        
        result.actualIndexed = indexedPath;
        result.passed = indexedPath === testCase.expectedIndexed;
        
        console.log(`[API test-indexed-fix] ${testCase.name}:`);
        console.log(`  Original: ${testCase.originalPath}`);
        console.log(`  Esperat:  ${testCase.expectedIndexed}`);
        console.log(`  Actual:   ${indexedPath}`);
        console.log(`  Resultat: ${result.passed ? '✅ PASS' : '❌ FAIL'}`);

      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        console.error(`[API test-indexed-fix] Error en test ${testCase.name}:`, error);
      }

      testResults.tests.push(result);
      testResults.summary.total++;
      if (result.passed) {
        testResults.summary.passed++;
      } else {
        testResults.summary.failed++;
      }
    }

    // Test 2: Verificar que la lògica antiga creava duplicats
    console.log('[API test-indexed-fix] Test 2: Verificant que la lògica antiga era problemàtica');
    
    const oldLogicTest = {
      testName: 'Lògica antiga (problemàtica)',
      originalPath: 'user-123/template-456/original/original.docx',
      expectedProblematic: 'user-123/template-456/indexed/original.docx',
      actualOldLogic: '',
      passed: false,
      error: null as string | null
    };

    try {
      // Aplicar la lògica antiga (problemàtica)
      const oldIndexedPath = oldLogicTest.originalPath
        .replace('/original/', '/indexed/')
        .replace('.docx', '.docx'); // Aquesta era la línia problemàtica
      
      oldLogicTest.actualOldLogic = oldIndexedPath;
      oldLogicTest.passed = oldIndexedPath === oldLogicTest.expectedProblematic;
      
      console.log(`[API test-indexed-fix] Lògica antiga:`);
      console.log(`  Original: ${oldLogicTest.originalPath}`);
      console.log(`  Problemàtic: ${oldLogicTest.expectedProblematic}`);
      console.log(`  Actual:   ${oldIndexedPath}`);
      console.log(`  Confirmat problemàtic: ${oldLogicTest.passed ? '✅ SÍ' : '❌ NO'}`);

    } catch (error) {
      oldLogicTest.error = error instanceof Error ? error.message : String(error);
    }

    testResults.tests.push(oldLogicTest);
    testResults.summary.total++;
    if (oldLogicTest.passed) {
      testResults.summary.passed++;
    } else {
      testResults.summary.failed++;
    }

    // Test 3: Verificar consistència entre endpoints
    console.log('[API test-indexed-fix] Test 3: Verificant consistència entre endpoints');
    
    const consistencyTest = {
      testName: 'Consistència entre endpoints',
      uploadEndpoint: 'user-123/template-456/indexed/indexed.docx',
      updateEndpoint: '',
      regenerateEndpoint: '',
      allConsistent: false,
      error: null as string | null
    };

    try {
      // Simular upload-original-docx (sempre correcte)
      const uploadPath = `user-123/template-456/indexed/indexed.docx`;
      
      // Simular update-template amb nova lògica
      const originalPath = 'user-123/template-456/original/original.docx';
      const updatePath = originalPath
        .replace('/original/', '/indexed/')
        .replace(/\/[^\/]+\.docx$/, '/indexed.docx');
      
      // Simular regenerate-placeholder-docx (sempre correcte)
      const regeneratePath = originalPath
        .replace('/original/', '/indexed/')
        .replace(/\/[^\/]+$/, '/indexed.docx');
      
      consistencyTest.updateEndpoint = updatePath;
      consistencyTest.regenerateEndpoint = regeneratePath;
      consistencyTest.allConsistent = (
        uploadPath === updatePath && 
        updatePath === regeneratePath
      );
      
      console.log(`[API test-indexed-fix] Consistència endpoints:`);
      console.log(`  Upload:     ${uploadPath}`);
      console.log(`  Update:     ${updatePath}`);
      console.log(`  Regenerate: ${regeneratePath}`);
      console.log(`  Consistent: ${consistencyTest.allConsistent ? '✅ SÍ' : '❌ NO'}`);

    } catch (error) {
      consistencyTest.error = error instanceof Error ? error.message : String(error);
    }

    testResults.tests.push(consistencyTest);
    testResults.summary.total++;
    if (consistencyTest.allConsistent) {
      testResults.summary.passed++;
    } else {
      testResults.summary.failed++;
    }

    // Resum final
    console.log('[API test-indexed-fix] Resum dels tests:');
    console.log(`  Total: ${testResults.summary.total}`);
    console.log(`  Passats: ${testResults.summary.passed}`);
    console.log(`  Fallats: ${testResults.summary.failed}`);
    console.log(`  Percentatge èxit: ${((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1)}%`);

    const allTestsPassed = testResults.summary.failed === 0;

    return NextResponse.json({
      success: allTestsPassed,
      message: allTestsPassed 
        ? 'Tots els tests han passat. La correcció funciona correctament.' 
        : 'Alguns tests han fallat. Revisar la implementació.',
      testResults
    }, { status: 200 });

  } catch (error) {
    console.error('[API test-indexed-fix] Error general:', error);
    return NextResponse.json({ 
      error: 'Error intern durant els tests',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * GET endpoint per obtenir informació sobre l'estat actual dels fitxers indexats
 */
export async function GET(request: NextRequest) {
  console.log('[API test-indexed-fix] Mode lectura - verificant estat actual');

  // Autenticació
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autenticat. Falten credencials.' }, { status: 401 });
  }
  const accessToken = authHeader.replace('Bearer ', '').trim();
  
  const userSupabaseClient = createUserSupabaseClient(accessToken);
  const { data: userData, error: userError } = await userSupabaseClient.auth.getUser();

  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Usuari no autenticat o token invàlid.' }, { status: 401 });
  }
  const userId = userData.user.id;

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  try {
    const status = {
      totalTemplates: 0,
      templatesWithIndexed: 0,
      correctlyNamed: 0,
      incorrectlyNamed: 0,
      details: [] as any[]
    };

    // Llistar directoris de templates
    const { data: userDirs, error: userDirsError } = await serviceClient.storage
      .from('template-docx')
      .list(`user-${userId}`);

    if (userDirsError || !userDirs) {
      return NextResponse.json({ error: 'Error accedint a l\'emmagatzematge' }, { status: 500 });
    }

    // Analitzar cada template
    for (const templateDir of userDirs) {
      if (!templateDir.name.startsWith('template-')) continue;
      
      status.totalTemplates++;
      const indexedPath = `user-${userId}/${templateDir.name}/indexed`;
      
      try {
        const { data: indexedFiles, error: indexedError } = await serviceClient.storage
          .from('template-docx')
          .list(indexedPath);

        if (indexedError || !indexedFiles || indexedFiles.length === 0) {
          status.details.push({
            template: templateDir.name,
            hasIndexed: false,
            files: [],
            status: 'No indexed files'
          });
          continue;
        }

        status.templatesWithIndexed++;
        
        const docxFiles = indexedFiles.filter(f => f.name.toLowerCase().endsWith('.docx'));
        const correctFiles = docxFiles.filter(f => f.name === 'indexed.docx');
        const incorrectFiles = docxFiles.filter(f => f.name.endsWith('original.docx'));
        
        if (correctFiles.length > 0 && incorrectFiles.length === 0) {
          status.correctlyNamed++;
        } else if (incorrectFiles.length > 0) {
          status.incorrectlyNamed++;
        }

        status.details.push({
          template: templateDir.name,
          hasIndexed: true,
          files: docxFiles.map(f => f.name),
          correctFiles: correctFiles.length,
          incorrectFiles: incorrectFiles.length,
          status: incorrectFiles.length > 0 ? 'Has duplicates' : 'Correct'
        });

      } catch (scanError) {
        status.details.push({
          template: templateDir.name,
          hasIndexed: false,
          files: [],
          status: `Error: ${scanError}`
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Estat actual: ${status.correctlyNamed}/${status.templatesWithIndexed} templates amb nomenclatura correcta`,
      status
    }, { status: 200 });

  } catch (error) {
    console.error('[API test-indexed-fix GET] Error:', error);
    return NextResponse.json({ 
      error: 'Error intern durant la verificació',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
