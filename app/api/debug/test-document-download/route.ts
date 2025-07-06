import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/debug/test-document-download
 * Test per verificar que el sistema de descàrrega de documents funciona correctament
 */
export async function GET(request: NextRequest) {
  console.log("[DEBUG test-document-download] Iniciant test del sistema de descàrrega");
  
  try {
    // Client amb service role key
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    
    const results = {
      timestamp: new Date().toISOString(),
      tests: [] as any[],
      summary: {
        total: 0,
        passed: 0,
        failed: 0
      }
    };
    
    // TEST 1: Verificar jobs amb final_document_path
    console.log("[DEBUG] Test 1: Verificant jobs amb final_document_path...");
    try {
      const { data: jobsWithPath, error: jobsError } = await serviceClient
        .from('generation_jobs')
        .select('id, generation_id, final_document_path, status')
        .not('final_document_path', 'is', null)
        .eq('status', 'completed')
        .limit(5);
      
      if (jobsError) throw jobsError;
      
      results.tests.push({
        name: "Jobs amb final_document_path",
        status: "PASS",
        details: `Trobats ${jobsWithPath?.length || 0} jobs amb document final desat`,
        data: jobsWithPath
      });
      results.summary.passed++;
    } catch (error) {
      results.tests.push({
        name: "Jobs amb final_document_path",
        status: "FAIL",
        error: error instanceof Error ? error.message : String(error)
      });
      results.summary.failed++;
    }
    results.summary.total++;
    
    // TEST 2: Verificar jobs sense final_document_path (problema)
    console.log("[DEBUG] Test 2: Verificant jobs sense final_document_path...");
    try {
      const { data: jobsWithoutPath, error: jobsError2 } = await serviceClient
        .from('generation_jobs')
        .select('id, generation_id, final_document_path, status, created_at')
        .is('final_document_path', null)
        .eq('status', 'completed')
        .limit(10);
      
      if (jobsError2) throw jobsError2;
      
      const hasProblematicJobs = (jobsWithoutPath?.length || 0) > 0;
      
      results.tests.push({
        name: "Jobs sense final_document_path (problemàtics)",
        status: hasProblematicJobs ? "WARNING" : "PASS",
        details: hasProblematicJobs 
          ? `⚠️ Trobats ${jobsWithoutPath?.length} jobs completats sense document final`
          : "✅ Tots els jobs completats tenen document final",
        data: jobsWithoutPath
      });
      
      if (!hasProblematicJobs) {
        results.summary.passed++;
      } else {
        results.summary.failed++;
      }
    } catch (error) {
      results.tests.push({
        name: "Jobs sense final_document_path",
        status: "FAIL",
        error: error instanceof Error ? error.message : String(error)
      });
      results.summary.failed++;
    }
    results.summary.total++;
    
    // TEST 3: Verificar existència de documents a Storage
    console.log("[DEBUG] Test 3: Verificant documents a Storage...");
    try {
      const { data: jobsToCheck, error: jobsError3 } = await serviceClient
        .from('generation_jobs')
        .select('id, final_document_path')
        .not('final_document_path', 'is', null)
        .limit(3);
      
      if (jobsError3) throw jobsError3;
      
      let documentsFound = 0;
      let documentsNotFound = 0;
      const storageResults = [];
      
      for (const job of jobsToCheck || []) {
        try {
          const { data: fileData, error: downloadError } = await serviceClient.storage
            .from('documents')
            .download(job.final_document_path);
          
          if (downloadError || !fileData) {
            documentsNotFound++;
            storageResults.push({
              job_id: job.id,
              path: job.final_document_path,
              status: "NOT_FOUND",
              error: downloadError?.message
            });
          } else {
            documentsFound++;
            storageResults.push({
              job_id: job.id,
              path: job.final_document_path,
              status: "FOUND",
              size: fileData.size
            });
          }
        } catch (error) {
          documentsNotFound++;
          storageResults.push({
            job_id: job.id,
            path: job.final_document_path,
            status: "ERROR",
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      results.tests.push({
        name: "Documents a Storage",
        status: documentsNotFound === 0 ? "PASS" : "WARNING",
        details: `${documentsFound} trobats, ${documentsNotFound} no trobats`,
        data: storageResults
      });
      
      if (documentsNotFound === 0) {
        results.summary.passed++;
      } else {
        results.summary.failed++;
      }
    } catch (error) {
      results.tests.push({
        name: "Documents a Storage",
        status: "FAIL",
        error: error instanceof Error ? error.message : String(error)
      });
      results.summary.failed++;
    }
    results.summary.total++;
    
    // TEST 4: Verificar estructura de la BD
    console.log("[DEBUG] Test 4: Verificant estructura de la BD...");
    try {
      const { data: tableInfo, error: tableError } = await serviceClient
        .from('generation_jobs')
        .select('final_document_path')
        .limit(1);
      
      if (tableError) throw tableError;
      
      results.tests.push({
        name: "Estructura BD (columna final_document_path)",
        status: "PASS",
        details: "✅ Columna final_document_path existeix i és accessible"
      });
      results.summary.passed++;
    } catch (error) {
      results.tests.push({
        name: "Estructura BD",
        status: "FAIL",
        error: error instanceof Error ? error.message : String(error)
      });
      results.summary.failed++;
    }
    results.summary.total++;
    
    // TEST 5: Verificar permisos de Storage
    console.log("[DEBUG] Test 5: Verificant permisos de Storage...");
    try {
      const { data: buckets, error: bucketsError } = await serviceClient.storage.listBuckets();
      
      if (bucketsError) throw bucketsError;
      
      const documentsBucket = buckets?.find(b => b.name === 'documents');
      
      results.tests.push({
        name: "Permisos Storage",
        status: documentsBucket ? "PASS" : "FAIL",
        details: documentsBucket 
          ? "✅ Bucket 'documents' accessible"
          : "❌ Bucket 'documents' no trobat",
        data: { buckets: buckets?.map(b => b.name) }
      });
      
      if (documentsBucket) {
        results.summary.passed++;
      } else {
        results.summary.failed++;
      }
    } catch (error) {
      results.tests.push({
        name: "Permisos Storage",
        status: "FAIL",
        error: error instanceof Error ? error.message : String(error)
      });
      results.summary.failed++;
    }
    results.summary.total++;
    
    // Generar resum final
    const successRate = Math.round((results.summary.passed / results.summary.total) * 100);
    
    console.log(`[DEBUG] Test completat: ${results.summary.passed}/${results.summary.total} tests passats (${successRate}%)`);
    
    return NextResponse.json({
      success: true,
      message: `Test del sistema de descàrrega completat: ${successRate}% èxit`,
      results,
      recommendations: generateRecommendations(results)
    });
    
  } catch (err) {
    console.error("[DEBUG test-document-download] Error general:", err);
    return NextResponse.json(
      { 
        success: false,
        error: 'Error executant test del sistema de descàrrega',
        details: err instanceof Error ? err.message : String(err) 
      },
      { status: 500 }
    );
  }
}

function generateRecommendations(results: any): string[] {
  const recommendations = [];
  
  // Analitzar resultats i generar recomanacions
  const failedTests = results.tests.filter((t: any) => t.status === 'FAIL');
  const warningTests = results.tests.filter((t: any) => t.status === 'WARNING');
  
  if (failedTests.length === 0 && warningTests.length === 0) {
    recommendations.push("🎉 Sistema funcionant perfectament! Tots els tests han passat.");
  }
  
  if (failedTests.some((t: any) => t.name.includes('final_document_path'))) {
    recommendations.push("🔧 Executar jobs nous per verificar que el worker actualitzat desa documents correctament.");
  }
  
  if (warningTests.some((t: any) => t.name.includes('problemàtics'))) {
    recommendations.push("⚠️ Hi ha jobs antics sense document final. Considera re-executar-los o marcar-los com a obsolets.");
  }
  
  if (failedTests.some((t: any) => t.name.includes('Storage'))) {
    recommendations.push("🗄️ Verificar configuració de Supabase Storage i permisos del bucket 'documents'.");
  }
  
  if (results.summary.passed === results.summary.total) {
    recommendations.push("✅ El sistema està llest per a producció. Els usuaris poden descarregar documents.");
  }
  
  return recommendations;
}
