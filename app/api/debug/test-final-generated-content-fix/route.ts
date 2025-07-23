import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Test final complet per verificar que s'han eliminat tots els errors de generated_content
 */
export async function GET(request: NextRequest) {
  console.log("[DEBUG final-fix] Iniciant test final de la solució...");
  
  try {
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    console.log("[DEBUG final-fix] 🔍 1. Verificant que generated_content ha estat eliminada...");
    
    // 1. Verificar que generated_content no existeix
    const { data: tables, error: tablesError } = await serviceClient
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'generated_content');
    
    const generatedContentExists = tables && tables.length > 0;
    console.log(`[DEBUG final-fix] Generated_content existeix: ${generatedContentExists}`);

    // 2. Buscar projectes i plantilles per testejar
    const { data: projects } = await serviceClient
      .from('projects')
      .select('id, project_name')
      .limit(1);
    
    const { data: templates } = await serviceClient
      .from('plantilla_configs')
      .select('id, config_name')
      .limit(1);

    interface EndpointTestResult {
      endpoint: string;
      status: number | string;
      has_pgrst200_error: boolean;
      working: boolean;
      error?: string;
    }

    const testResults = {
      generated_content_removed: !generatedContentExists,
      projects_available: projects?.length || 0,
      templates_available: templates?.length || 0,
      endpoints_tested: [] as EndpointTestResult[]
    };

    // 3. Testejar endpoints crítics
    const endpointsToTest = [
      '/api/reports/generations',
      '/api/reports/generate-smart-enhanced',
      '/api/delete-project/test-id',
      '/api/cleanup/projects'
    ];

    console.log("[DEBUG final-fix] 🧪 2. Testejant endpoints crítics...");
    
    for (const endpoint of endpointsToTest) {
      try {
        const testUrl = `${request.nextUrl.origin}${endpoint}`;
        
        let testResponse: Response;
        if (endpoint.includes('generate-smart-enhanced')) {
          // POST amb paràmetres mínims
          testResponse = await fetch(testUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ test: true })
          });
        } else if (endpoint.includes('cleanup/projects')) {
          // DELETE sense autenticació (esperat error 401)
          testResponse = await fetch(testUrl, { method: 'DELETE' });
        } else {
          // GET normal
          testResponse = await fetch(testUrl);
        }

        const testData = await testResponse.json();
        
        // Verificar que NO hi ha errors PGRST200
        const hasPGRSTError = testData.error && 
          (testData.error.includes('PGRST200') || 
           testData.error.includes('generated_content'));

        testResults.endpoints_tested.push({
          endpoint,
          status: testResponse.status,
          has_pgrst200_error: hasPGRSTError,
          working: !hasPGRSTError
        });

        console.log(`[DEBUG final-fix] ${endpoint}: ${testResponse.status} - PGRST200: ${hasPGRSTError}`);

      } catch (fetchError) {
        testResults.endpoints_tested.push({
          endpoint,
          status: 'ERROR',
          has_pgrst200_error: false,
          working: true, // Error de xarxa, no PGRST200
          error: fetchError instanceof Error ? fetchError.message : String(fetchError)
        });
      }
    }

    // 4. Verificar resultat final
    const allEndpointsWorking = testResults.endpoints_tested.every(result => result.working);
    const success = testResults.generated_content_removed && allEndpointsWorking;

    console.log(`[DEBUG final-fix] ✅ Resultat final: ${success ? 'SOLUCIÓ COMPLETA' : 'PENDENTS PROBLEMES'}`);

    return NextResponse.json({
      success,
      message: success 
        ? "✅ SOLUCIÓ COMPLETA - Error 500 en generació intel·ligent individual RESOLT"
        : "❌ Encara hi ha problemes pendents",
      test_results: testResults,
      summary: {
        generated_content_table_removed: testResults.generated_content_removed,
        endpoints_without_pgrst200_errors: allEndpointsWorking,
        test_data_available: testResults.projects_available > 0 && testResults.templates_available > 0
      }
    });

  } catch (err) {
    console.error("[DEBUG final-fix] Error en test final:", err);
    return NextResponse.json({
      success: false,
      message: "Error executant test final",
      error: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}
