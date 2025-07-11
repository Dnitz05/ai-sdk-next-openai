/**
 * Endpoint de testing per verificar la solució de "Plantilla no trobada"
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import supabaseServerClient from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 [Test-Plantilla-Fix] Iniciant test de la solució...');

    const body = await request.json();
    const { templateId, projectId } = body;

    if (!templateId && !projectId) {
      return NextResponse.json({
        success: false,
        error: 'templateId o projectId requerit'
      }, { status: 400 });
    }

    // 1. Crear client SSR per validar usuari
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

    // 2. Validar usuari
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Usuari no autenticat',
        details: authError?.message
      }, { status: 401 });
    }

    console.log(`👤 [Test-Plantilla-Fix] Usuari autenticat: ${user.id}`);

    // 3. Si tenim projectId, validar accés al projecte
    let finalTemplateId = templateId;
    
    if (projectId) {
      console.log(`📋 [Test-Plantilla-Fix] Validant projecte: ${projectId}`);
      
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('template_id')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        return NextResponse.json({
          success: false,
          error: 'Projecte no trobat o accés denegat',
          details: projectError?.message
        }, { status: 403 });
      }

      finalTemplateId = project.template_id;
      console.log(`📋 [Test-Plantilla-Fix] Template del projecte: ${finalTemplateId}`);
    }

    // 4. Provar el mètode ANTIC (problemàtic)
    console.log(`❌ [Test-Plantilla-Fix] Provant mètode ANTIC amb ANON_KEY...`);
    const { data: templateAntigue, error: errorAntigue } = await supabase
      .from('plantilla_configs')
      .select('id, config_name, template_content, docx_storage_path')
      .eq('id', finalTemplateId)
      .single();

    // 5. Provar el mètode NOU (corregit)
    console.log(`✅ [Test-Plantilla-Fix] Provant mètode NOU amb SERVER_CLIENT...`);
    const { data: templateNova, error: errorNou } = await supabaseServerClient
      .from('plantilla_configs')
      .select('id, config_name, template_content, docx_storage_path, user_id')
      .eq('id', finalTemplateId)
      .single();

    // 6. Resultat del test
    const resultat = {
      success: true,
      test_results: {
        template_id: finalTemplateId,
        project_id: projectId,
        user_id: user.id,
        
        antic_method: {
          success: !errorAntigue,
          error: errorAntigue?.message || null,
          found_template: !!templateAntigue,
          template_name: templateAntigue?.config_name || null
        },
        
        nou_method: {
          success: !errorNou,
          error: errorNou?.message || null,
          found_template: !!templateNova,
          template_name: templateNova?.config_name || null,
          template_owner: templateNova?.user_id || null,
          access_granted: templateNova?.user_id === user.id || !!projectId
        },

        conclusions: {
          problem_solved: !!templateNova && !templateAntigue,
          method_comparison: {
            antic: errorAntigue ? 'FALLA' : 'FUNCIONA',
            nou: errorNou ? 'FALLA' : 'FUNCIONA'
          }
        }
      }
    };

    console.log('📊 [Test-Plantilla-Fix] Resultat del test:', resultat.test_results.conclusions);

    return NextResponse.json(resultat);

  } catch (error) {
    console.error('❌ [Test-Plantilla-Fix] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error intern en el test',
      details: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 });
  }
}

// GET per obtenir informació de testing
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const info = searchParams.get('info');

    if (info === 'usage') {
      return NextResponse.json({
        usage: {
          endpoint: '/api/debug/test-plantilla-fix',
          method: 'POST',
          body: {
            templateId: 'ID de la plantilla a provar (opcional si es proporciona projectId)',
            projectId: 'ID del projecte (opcional - obté templateId automàticament)'
          },
          examples: [
            {
              case: 'Test plantilla directa',
              body: { templateId: '939cd2d5-fd5b-410b-9d4c-c1551cec9934' }
            },
            {
              case: 'Test via projecte',
              body: { projectId: 'avorepj' }
            }
          ]
        }
      });
    }

    return NextResponse.json({
      message: 'Endpoint de test per verificar la solució de "Plantilla no trobada"',
      usage_info: 'Afegeix ?info=usage per veure com utilitzar aquest endpoint'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error obtenint informació'
    }, { status: 500 });
  }
}
