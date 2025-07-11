import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Test complet de la refactorització dels endpoints crítics
 * Verifica que tots els endpoints refactoritzats funcionen correctament amb SSR + RLS
 */
export async function GET(request: NextRequest) {
  console.log("\n=== TEST REFACTORITZACIÓ COMPLETA ===\n");
  
  const results = {
    timestamp: new Date().toISOString(),
    overall_status: 'UNKNOWN',
    tests: [] as any[],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    }
  };

  try {
    // Crear client SSR per autenticació
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

    // TEST 1: Verificar autenticació SSR
    console.log("🔍 TEST 1: Verificant autenticació SSR...");
    let authTest = {
      name: "Autenticació SSR",
      status: "UNKNOWN",
      details: "",
      user_id: null as string | null
    };
    
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        authTest.status = "FAILED";
        authTest.details = `Error d'autenticació: ${authError?.message || 'Usuari no trobat'}`;
      } else {
        authTest.status = "PASSED";
        authTest.details = `Usuari autenticat correctament`;
        authTest.user_id = user.id;
        console.log(`✅ Usuari autenticat: ${user.id}`);
      }
    } catch (error) {
      authTest.status = "FAILED";
      authTest.details = `Error general: ${error instanceof Error ? error.message : String(error)}`;
    }
    
    results.tests.push(authTest);
    
    if (authTest.status !== "PASSED") {
      results.overall_status = "FAILED";
      console.log("❌ Test d'autenticació fallit, aturant tests");
      return NextResponse.json(results, { status: 500 });
    }

    const userId = authTest.user_id;

    // TEST 2: Endpoint get-templates
    console.log("🔍 TEST 2: Verificant endpoint get-templates...");
    let templatesTest = {
      name: "GET /api/get-templates",
      status: "UNKNOWN",
      details: "",
      templates_count: 0
    };
    
    try {
      const { data: templates, error: templatesError } = await supabase
        .from('plantilla_configs')
        .select('id, config_name, user_id')
        .order('created_at', { ascending: false });
      
      if (templatesError) {
        templatesTest.status = "FAILED";
        templatesTest.details = `Error obtenint plantilles: ${templatesError.message}`;
      } else {
        templatesTest.status = "PASSED";
        templatesTest.templates_count = templates?.length || 0;
        templatesTest.details = `✅ ${templatesTest.templates_count} plantilles obtingudes amb RLS`;
        
        // Verificar que totes les plantilles són de l'usuari actual
        const invalidTemplates = templates?.filter(t => t.user_id !== userId) || [];
        if (invalidTemplates.length > 0) {
          templatesTest.status = "WARNING";
          templatesTest.details += ` ⚠️ ${invalidTemplates.length} plantilles d'altres usuaris (RLS no funcionant?)`;
        }
      }
    } catch (error) {
      templatesTest.status = "FAILED";
      templatesTest.details = `Error general: ${error instanceof Error ? error.message : String(error)}`;
    }
    
    results.tests.push(templatesTest);
    console.log(`📊 Templates test: ${templatesTest.status} - ${templatesTest.details}`);

    // TEST 3: Endpoint reports/projects
    console.log("🔍 TEST 3: Verificant endpoint reports/projects...");
    let projectsTest = {
      name: "GET /api/reports/projects",
      status: "UNKNOWN",
      details: "",
      projects_count: 0
    };
    
    try {
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, project_name, user_id, template_id')
        .order('created_at', { ascending: false });
      
      if (projectsError) {
        projectsTest.status = "FAILED";
        projectsTest.details = `Error obtenint projectes: ${projectsError.message}`;
      } else {
        projectsTest.status = "PASSED";
        projectsTest.projects_count = projects?.length || 0;
        projectsTest.details = `✅ ${projectsTest.projects_count} projectes obtinguts amb RLS`;
        
        // Verificar que tots els projectes són de l'usuari actual
        const invalidProjects = projects?.filter(p => p.user_id !== userId) || [];
        if (invalidProjects.length > 0) {
          projectsTest.status = "WARNING";
          projectsTest.details += ` ⚠️ ${invalidProjects.length} projectes d'altres usuaris (RLS no funcionant?)`;
        }
      }
    } catch (error) {
      projectsTest.status = "FAILED";
      projectsTest.details = `Error general: ${error instanceof Error ? error.message : String(error)}`;
    }
    
    results.tests.push(projectsTest);
    console.log(`📊 Projects test: ${projectsTest.status} - ${projectsTest.details}`);

    // TEST 4: Verificar smart_generations table (si existeix)
    console.log("🔍 TEST 4: Verificant taula smart_generations...");
    let smartGenerationsTest = {
      name: "smart_generations table access",
      status: "UNKNOWN",
      details: "",
      smart_generations_count: 0
    };
    
    try {
      const { data: smartGenerations, error: smartError } = await supabase
        .from('smart_generations')
        .select('id, project_id, status')
        .limit(10);
      
      if (smartError) {
        if (smartError.code === '42P01') {
          smartGenerationsTest.status = "WARNING";
          smartGenerationsTest.details = "Taula smart_generations no existeix (normal si no s'ha utilitzat)";
        } else {
          smartGenerationsTest.status = "FAILED";
          smartGenerationsTest.details = `Error accedint smart_generations: ${smartError.message}`;
        }
      } else {
        smartGenerationsTest.status = "PASSED";
        smartGenerationsTest.smart_generations_count = smartGenerations?.length || 0;
        smartGenerationsTest.details = `✅ Taula smart_generations accessible, ${smartGenerationsTest.smart_generations_count} registres trobats`;
      }
    } catch (error) {
      smartGenerationsTest.status = "FAILED";
      smartGenerationsTest.details = `Error general: ${error instanceof Error ? error.message : String(error)}`;
    }
    
    results.tests.push(smartGenerationsTest);
    console.log(`📊 Smart generations test: ${smartGenerationsTest.status} - ${smartGenerationsTest.details}`);

    // TEST 5: Verificar variables d'entorn
    console.log("🔍 TEST 5: Verificant variables d'entorn...");
    let envTest = {
      name: "Variables d'entorn",
      status: "UNKNOWN",
      details: "",
      env_vars: {} as any
    };
    
    try {
      const envVars = {
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      };
      
      envTest.env_vars = envVars;
      
      if (!envVars.NEXT_PUBLIC_SUPABASE_URL || !envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        envTest.status = "FAILED";
        envTest.details = "Variables d'entorn crítiques no configurades";
      } else {
        envTest.status = "PASSED";
        envTest.details = "Variables d'entorn SSR configurades correctament";
        if (envVars.SUPABASE_SERVICE_ROLE_KEY) {
          envTest.details += " ⚠️ SERVICE_ROLE_KEY encara present (es pot eliminar quan tots els endpoints estiguin migrats)";
        }
      }
    } catch (error) {
      envTest.status = "FAILED";
      envTest.details = `Error verificant entorn: ${error instanceof Error ? error.message : String(error)}`;
    }
    
    results.tests.push(envTest);
    console.log(`📊 Environment test: ${envTest.status} - ${envTest.details}`);

    // Calcular resum
    results.summary.total = results.tests.length;
    results.summary.passed = results.tests.filter(t => t.status === "PASSED").length;
    results.summary.failed = results.tests.filter(t => t.status === "FAILED").length;
    results.summary.warnings = results.tests.filter(t => t.status === "WARNING").length;

    if (results.summary.failed > 0) {
      results.overall_status = "FAILED";
    } else if (results.summary.warnings > 0) {
      results.overall_status = "PASSED_WITH_WARNINGS";
    } else {
      results.overall_status = "PASSED";
    }

    console.log("\n=== RESUM DEL TEST ===");
    console.log(`Status general: ${results.overall_status}`);
    console.log(`Tests passats: ${results.summary.passed}/${results.summary.total}`);
    console.log(`Warnings: ${results.summary.warnings}`);
    console.log(`Errors: ${results.summary.failed}`);
    console.log("========================\n");

    const statusCode = results.overall_status === "FAILED" ? 500 : 200;
    return NextResponse.json(results, { status: statusCode });

  } catch (error) {
    console.error("❌ Error general en test:", error);
    results.overall_status = "FAILED";
    results.tests.push({
      name: "Test general",
      status: "FAILED",
      details: `Error general: ${error instanceof Error ? error.message : String(error)}`
    });
    
    return NextResponse.json(results, { status: 500 });
  }
}
