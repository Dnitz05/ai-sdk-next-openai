import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId') || '365429f4-25b3-421f-a04e-b646d1e3939d';

    console.log(`🔍 [TemplateDebug] Investigant plantilla: ${templateId}`);

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
          setAll: () => {}
        }
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Usuari no autenticat',
        details: authError?.message
      }, { status: 401 });
    }

    // Service client per bypassar RLS
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const results: any = {
      templateId: templateId,
      userId: user.id,
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // Test 1: Buscar plantilla amb service client (igual que l'API)
    console.log(`🧪 Test 1: Service client query...`);
    const { data: template1, error: error1 } = await serviceClient
      .from('plantilla_configs')
      .select('id, config_name, template_content, docx_storage_path, user_id, created_at')
      .eq('id', templateId)
      .single();

    results.tests.serviceClient = {
      success: !error1,
      data: template1,
      error: error1?.message,
      found: !!template1
    };

    // Test 2: Buscar plantilla amb SSR client (amb RLS)
    console.log(`🧪 Test 2: SSR client query...`);
    const { data: template2, error: error2 } = await supabase
      .from('plantilla_configs')
      .select('id, config_name, template_content, docx_storage_path, user_id, created_at')
      .eq('id', templateId)
      .single();

    results.tests.ssrClient = {
      success: !error2,
      data: template2,
      error: error2?.message,
      found: !!template2
    };

    // Test 3: Buscar totes les plantilles de l'usuari amb service client
    console.log(`🧪 Test 3: Totes les plantilles de l'usuari...`);
    const { data: userTemplates, error: error3 } = await serviceClient
      .from('plantilla_configs')
      .select('id, config_name, user_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    results.tests.userTemplates = {
      success: !error3,
      count: userTemplates?.length || 0,
      data: userTemplates,
      error: error3?.message,
      containsTarget: userTemplates?.some(t => t.id === templateId) || false
    };

    // Test 4: Buscar la plantilla sense filtres d'usuari
    console.log(`🧪 Test 4: Plantilla sense filtres d'usuari...`);
    const { data: templateAny, error: error4 } = await serviceClient
      .from('plantilla_configs')
      .select('id, config_name, user_id, created_at')
      .eq('id', templateId)
      .single();

    results.tests.templateAnyUser = {
      success: !error4,
      data: templateAny,
      error: error4?.message,
      found: !!templateAny,
      ownerUserId: templateAny?.user_id
    };

    // Test 5: Verificar projectes que utilitzen aquesta plantilla
    console.log(`🧪 Test 5: Projectes que utilitzen aquesta plantilla...`);
    const { data: projects, error: error5 } = await serviceClient
      .from('projects')
      .select('id, project_name, template_id, user_id, created_at')
      .eq('template_id', templateId)
      .limit(5);

    results.tests.projectsUsingTemplate = {
      success: !error5,
      count: projects?.length || 0,
      data: projects,
      error: error5?.message
    };

    // Resum de l'anàlisi
    results.analysis = {
      templateExists: !!template1 || !!templateAny,
      accessibleToUser: !!template2,
      ownedByUser: templateAny?.user_id === user.id,
      usedByProjects: (projects?.length || 0) > 0,
      possibleIssues: []
    };

    if (!template1 && !templateAny) {
      results.analysis.possibleIssues.push('Plantilla no existeix a la base de dades');
    } else if (template1 && !template2) {
      results.analysis.possibleIssues.push('Plantilla existeix però RLS bloqueja accés a l\'usuari');
    } else if (templateAny && templateAny.user_id !== user.id) {
      results.analysis.possibleIssues.push('Plantilla pertany a un altre usuari');
    } else if (!template1?.template_content || !template1?.docx_storage_path) {
      results.analysis.possibleIssues.push('Plantilla incompleta (falta contingut o document)');
    }

    console.log(`📋 [TemplateDebug] Anàlisi completada:`, {
      templateExists: results.analysis.templateExists,
      accessibleToUser: results.analysis.accessibleToUser,
      issues: results.analysis.possibleIssues
    });

    return NextResponse.json({
      success: true,
      ...results
    });

  } catch (error) {
    console.error(`❌ [TemplateDebug] Error:`, error);
    return NextResponse.json({
      success: false,
      error: 'Error investigant plantilla',
      details: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 });
  }
}
