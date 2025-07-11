/**
 * Test que simula exactament com la interfície web fa la petició
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import supabaseServerClient from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  console.log(`🔍 [Web-Simulation] Iniciant test de simulació web...`);
  
  try {
    const body = await request.json();
    const { projectId } = body;

    console.log(`📋 [Web-Simulation] ProjectId: ${projectId}`);
    console.log(`🍪 [Web-Simulation] Cookies rebudes:`, request.cookies.getAll());

    // 1. Provar autenticació SSR com fa generate-smart-enhanced
    console.log(`🔐 [Web-Simulation] Test #1: Autenticació SSR amb cookies...`);
    
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error(`❌ [Web-Simulation] Test #1 FALLIT - Error d'autenticació SSR:`, authError);
      
      // 2. Provar accés directe amb service role (com feia abans)
      console.log(`🔐 [Web-Simulation] Test #2: Accés directe amb service role...`);
      
      const { data: project, error: projectError } = await supabaseServerClient
        .from('projects')
        .select('template_id, project_name')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        console.error(`❌ [Web-Simulation] Test #2 FALLIT - Projecte no trobat:`, projectError);
        
        return NextResponse.json({
          success: false,
          error: 'Tots els mètodes han fallat',
          details: {
            sserAuth: authError?.message,
            directAccess: projectError?.message
          }
        }, { status: 500 });
      }
      
      console.log(`✅ [Web-Simulation] Test #2 ÈXIT - Projecte trobat via service role:`, project);
      
      // 3. Obtenir plantilla també via service role
      console.log(`🔍 [Web-Simulation] Test #3: Obtenint plantilla via service role...`);
      
      const { data: template, error: templateError } = await supabaseServerClient
        .from('plantilla_configs')
        .select('id, config_name, template_content, docx_storage_path, user_id')
        .eq('id', project.template_id)
        .single();

      if (templateError || !template) {
        console.error(`❌ [Web-Simulation] Test #3 FALLIT - Plantilla no trobada:`, templateError);
        
        return NextResponse.json({
          success: false,
          error: 'Plantilla no trobada',
          details: templateError?.message
        }, { status: 404 });
      }
      
      console.log(`✅ [Web-Simulation] Test #3 ÈXIT - Plantilla trobada:`, {
        id: template.id,
        name: template.config_name,
        hasContent: !!template.template_content,
        hasDocx: !!template.docx_storage_path,
        userId: template.user_id
      });
      
      return NextResponse.json({
        success: true,
        method: 'service_role_fallback',
        message: 'SSR auth ha fallat, però service role funciona',
        data: {
          project: {
            id: projectId,
            name: project.project_name,
            templateId: project.template_id
          },
          template: {
            id: template.id,
            name: template.config_name,
            userId: template.user_id,
            isComplete: !!(template.template_content && template.docx_storage_path)
          }
        },
        recommendation: 'Implementar sistema híbrid: SSR per validació + Service Role per accés'
      });
    }
    
    console.log(`✅ [Web-Simulation] Test #1 ÈXIT - Usuari autenticat via SSR: ${user.id}`);
    
    // 4. Si SSR funciona, provar accés al projecte
    console.log(`📋 [Web-Simulation] Test #4: Accés al projecte via SSR...`);
    
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('template_id, project_name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error(`❌ [Web-Simulation] Test #4 FALLIT - Projecte no accessible via SSR:`, projectError);
      
      return NextResponse.json({
        success: false,
        error: 'Projecte no accessible via SSR',
        details: projectError?.message,
        userId: user.id
      }, { status: 403 });
    }
    
    console.log(`✅ [Web-Simulation] Test #4 ÈXIT - Projecte accessible via SSR`);
    
    // 5. Provar accés a la plantilla via SSR
    console.log(`🔍 [Web-Simulation] Test #5: Accés a plantilla via SSR...`);
    
    const { data: template, error: templateError } = await supabase
      .from('plantilla_configs')
      .select('id, config_name, template_content, docx_storage_path')
      .eq('id', project.template_id)
      .single();

    if (templateError || !template) {
      console.error(`❌ [Web-Simulation] Test #5 FALLIT - Plantilla no accessible via SSR:`, templateError);
      
      // Provar via service role com a fallback
      console.log(`🔄 [Web-Simulation] Test #5b: Fallback a service role per plantilla...`);
      
      const { data: templateFallback, error: templateFallbackError } = await supabaseServerClient
        .from('plantilla_configs')
        .select('id, config_name, template_content, docx_storage_path, user_id')
        .eq('id', project.template_id)
        .single();

      if (templateFallbackError || !templateFallback) {
        return NextResponse.json({
          success: false,
          error: 'Plantilla no trobada ni via SSR ni via service role',
          details: {
            ssrError: templateError?.message,
            serviceRoleError: templateFallbackError?.message
          }
        }, { status: 404 });
      }
      
      return NextResponse.json({
        success: true,
        method: 'hybrid_ssr_user_service_role_template',
        message: 'SSR per usuari, service role per plantilla',
        data: {
          userId: user.id,
          project: {
            id: projectId,
            name: project.project_name,
            templateId: project.template_id
          },
          template: {
            id: templateFallback.id,
            name: templateFallback.config_name,
            userId: templateFallback.user_id,
            isComplete: !!(templateFallback.template_content && templateFallback.docx_storage_path)
          }
        }
      });
    }
    
    console.log(`✅ [Web-Simulation] Test #5 ÈXIT - Tot funciona via SSR!`);
    
    return NextResponse.json({
      success: true,
      method: 'full_ssr',
      message: 'Tot funciona perfectament via SSR',
      data: {
        userId: user.id,
        project: {
          id: projectId,
          name: project.project_name,
          templateId: project.template_id
        },
        template: {
          id: template.id,
          name: template.config_name,
          isComplete: !!(template.template_content && template.docx_storage_path)
        }
      }
    });

  } catch (error) {
    console.error(`❌ [Web-Simulation] Error crític:`, error);
    
    return NextResponse.json({
      success: false,
      error: 'Error crític en simulació web',
      details: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 });
  }
}
