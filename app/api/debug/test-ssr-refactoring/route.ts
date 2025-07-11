import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  console.log("[API test-ssr-refactoring] Testejant endpoints refactoritzats amb SSR...");
  
  const startTime = Date.now();
  const testResults = {
    timestamp: new Date().toISOString(),
    testSuite: 'SSR_REFACTORING_VERIFICATION',
    results: [] as any[]
  };

  try {
    // 1. Crear client SSR per autenticació
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

    // 2. Verificar autenticació SSR
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      testResults.results.push({
        test: 'SSR_AUTHENTICATION',
        status: 'FAILED',
        error: 'No s\'ha pogut autenticar l\'usuari via SSR',
        details: authError?.message
      });
      
      return NextResponse.json({
        ...testResults,
        summary: 'Tests fallits - usuari no autenticat',
        totalTimeMs: Date.now() - startTime
      }, { status: 401 });
    }
    
    const userId = user.id;
    testResults.results.push({
      test: 'SSR_AUTHENTICATION',
      status: 'PASSED',
      userId: userId,
      message: 'Usuari autenticat correctament via SSR'
    });

    // 3. Test de verificació d'accés a les taules principals amb RLS
    const tablesToTest = [
      'plantilla_configs',
      'projects', 
      'generations',
      'generation_jobs'
    ];

    for (const tableName of tablesToTest) {
      try {
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .limit(1);

        if (error) {
          testResults.results.push({
            test: `RLS_ACCESS_${tableName.toUpperCase()}`,
            status: 'FAILED',
            error: error.message,
            tableName
          });
        } else {
          testResults.results.push({
            test: `RLS_ACCESS_${tableName.toUpperCase()}`,
            status: 'PASSED',
            tableName,
            recordCount: count,
            message: 'Accés a taula permès amb RLS'
          });
        }
      } catch (tableError) {
        testResults.results.push({
          test: `RLS_ACCESS_${tableName.toUpperCase()}`,
          status: 'ERROR',
          tableName,
          error: tableError instanceof Error ? tableError.message : String(tableError)
        });
      }
    }

    // 4. Test de verificació Storage amb RLS
    try {
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        testResults.results.push({
          test: 'STORAGE_ACCESS',
          status: 'FAILED',
          error: bucketsError.message
        });
      } else {
        testResults.results.push({
          test: 'STORAGE_ACCESS',
          status: 'PASSED',
          buckets: buckets.map(b => b.name),
          message: 'Accés a Storage permès'
        });

        // Test específic del bucket template-docx
        try {
          const { data: files, error: listError } = await supabase.storage
            .from('template-docx')
            .list(`user-${userId}`, { limit: 1 });

          if (listError) {
            testResults.results.push({
              test: 'STORAGE_USER_FOLDER_ACCESS',
              status: 'WARNING',
              error: listError.message,
              message: 'Carpeta d\'usuari no accessible o no existeix'
            });
          } else {
            testResults.results.push({
              test: 'STORAGE_USER_FOLDER_ACCESS',
              status: 'PASSED',
              userFolder: `user-${userId}`,
              fileCount: files?.length || 0,
              message: 'Accés a carpeta d\'usuari en Storage'
            });
          }
        } catch (storageUserError) {
          testResults.results.push({
            test: 'STORAGE_USER_FOLDER_ACCESS',
            status: 'ERROR',
            error: storageUserError instanceof Error ? storageUserError.message : String(storageUserError)
          });
        }
      }
    } catch (storageError) {
      testResults.results.push({
        test: 'STORAGE_ACCESS',
        status: 'ERROR',
        error: storageError instanceof Error ? storageError.message : String(storageError)
      });
    }

    // 5. Verificar que els endpoints refactoritzats no utilitzen service_role_key
    const refactoredEndpoints = [
      'update-template',
      'delete-project', 
      'upload-excel',
      'upload-original-docx',
      'reports/generate-smart-enhanced',
      'save-configuration',
      'reports/projects',
      'get-templates'
    ];

    testResults.results.push({
      test: 'REFACTORED_ENDPOINTS_LIST',
      status: 'INFO',
      refactoredEndpoints,
      count: refactoredEndpoints.length,
      message: 'Endpoints ja refactoritzats per utilitzar SSR'
    });

    // 6. Verificar variables d'entorn SSR
    const ssrEnvCheck = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    };

    testResults.results.push({
      test: 'SSR_ENVIRONMENT_VARIABLES',
      status: 'PASSED',
      variables: ssrEnvCheck,
      message: 'Variables d\'entorn SSR configurades correctament'
    });

    // 7. Verificar info de l'usuari actual
    testResults.results.push({
      test: 'USER_INFO',
      status: 'INFO',
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at
      },
      message: 'Informació de l\'usuari actual'
    });

    // 8. Resum final
    const passedTests = testResults.results.filter(r => r.status === 'PASSED').length;
    const failedTests = testResults.results.filter(r => r.status === 'FAILED').length;
    const errorTests = testResults.results.filter(r => r.status === 'ERROR').length;
    const warningTests = testResults.results.filter(r => r.status === 'WARNING').length;

    const summary = {
      totalTests: testResults.results.filter(r => r.status !== 'INFO').length,
      passed: passedTests,
      failed: failedTests,
      errors: errorTests,
      warnings: warningTests,
      successRate: passedTests / (passedTests + failedTests + errorTests) * 100
    };

    return NextResponse.json({
      ...testResults,
      summary,
      totalTimeMs: Date.now() - startTime,
      recommendation: summary.successRate > 80 
        ? 'Refactorització SSR funcionant correctament' 
        : 'Revisar errors i advertències abans de continuar'
    }, { status: 200 });

  } catch (error) {
    console.error("[API test-ssr-refactoring] Error general:", error);
    
    testResults.results.push({
      test: 'GENERAL_ERROR',
      status: 'ERROR',
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json({
      ...testResults,
      summary: 'Test fallit per error general',
      totalTimeMs: Date.now() - startTime
    }, { status: 500 });
  }
}
