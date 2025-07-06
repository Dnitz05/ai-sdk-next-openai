import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { documentProcessor } from '@/lib/workers/documentProcessor';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'projectId és obligatori' }, { status: 400 });
    }

    console.log(`[Test Worker Fix] Iniciant test per projecte: ${projectId}`);

    // 1. CREAR UN JOB DE TEST
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*, template:plantilla_configs(*)')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ 
        error: 'Projecte no trobat',
        details: projectError?.message 
      }, { status: 404 });
    }

    // 2. CREAR JOB CONFIG AMB NOVA ARQUITECTURA
    const jobConfig = {
      template_id: project.template.id,
      project_id: project.id,
      context_document_path: project.template.base_docx_storage_path,
      template_document_path: project.template.placeholder_docx_storage_path || project.template.indexed_docx_storage_path || project.template.base_docx_storage_path,
      excel_data: project.excel_data?.slice(0, 1) || [], // Només primera fila per test
      prompts: project.template.ai_instructions || []
    };

    console.log(`[Test Worker Fix] Job config creat:`, {
      context_document_path: jobConfig.context_document_path,
      template_document_path: jobConfig.template_document_path,
      excel_rows: jobConfig.excel_data.length,
      prompts_count: jobConfig.prompts.length
    });

    // 3. CREAR JOB A LA BASE DE DADES
    const { data: testJob, error: jobError } = await supabaseAdmin
      .from('generation_jobs')
      .insert({
        user_id: 'test-user',
        project_id: projectId,
        status: 'pending',
        progress: 0,
        job_config: jobConfig
      })
      .select()
      .single();

    if (jobError) {
      return NextResponse.json({ 
        error: 'Error creant job de test',
        details: jobError.message 
      }, { status: 500 });
    }

    console.log(`[Test Worker Fix] Job de test creat: ${testJob.id}`);

    // 4. CREAR GENERATION ASSOCIADA
    const { data: testGeneration, error: generationError } = await supabaseAdmin
      .from('generations')
      .insert({
        project_id: projectId,
        excel_row_index: 0,
        row_data: jobConfig.excel_data[0] || {},
        status: 'pending'
      })
      .select()
      .single();

    if (generationError) {
      return NextResponse.json({ 
        error: 'Error creant generation de test',
        details: generationError.message 
      }, { status: 500 });
    }

    // 5. ACTUALITZAR JOB AMB GENERATION_ID
    await supabaseAdmin
      .from('generation_jobs')
      .update({ generation: testGeneration })
      .eq('id', testJob.id);

    console.log(`[Test Worker Fix] Generation de test creada: ${testGeneration.id}`);

    // 6. EXECUTAR WORKER AMB MILLORES
    try {
      console.log(`[Test Worker Fix] Executant worker millorat...`);
      await documentProcessor.processJob(testJob.id);
      
      // 7. VERIFICAR RESULTATS
      const { data: updatedJob, error: checkError } = await supabaseAdmin
        .from('generation_jobs')
        .select('*')
        .eq('id', testJob.id)
        .single();

      if (checkError) {
        throw new Error(`Error verificant resultats: ${checkError.message}`);
      }

      const { data: generatedContent, error: contentError } = await supabaseAdmin
        .from('generated_content')
        .select('*')
        .eq('generation_id', testGeneration.id);

      if (contentError) {
        console.warn(`[Test Worker Fix] Error obtenint contingut generat:`, contentError);
      }

      return NextResponse.json({
        success: true,
        message: 'Test del worker completat amb èxit',
        results: {
          jobId: testJob.id,
          generationId: testGeneration.id,
          finalStatus: updatedJob.status,
          progress: updatedJob.progress,
          errorMessage: updatedJob.error_message,
          generatedContentCount: generatedContent?.length || 0,
          generatedContent: generatedContent?.map(gc => ({
            placeholder_id: gc.placeholder_id,
            content_length: gc.final_content?.length || 0,
            content_preview: gc.final_content?.substring(0, 100) + '...'
          }))
        },
        diagnostics: {
          projectId,
          templateId: project.template.id,
          templateName: project.template.config_name,
          contextPath: jobConfig.context_document_path,
          templatePath: jobConfig.template_document_path,
          excelRowsProcessed: jobConfig.excel_data.length,
          promptsConfigured: jobConfig.prompts.length
        }
      }, { status: 200 });

    } catch (workerError: any) {
      console.error(`[Test Worker Fix] Error executant worker:`, workerError);
      
      // Obtenir detalls de l'error del job
      const { data: failedJob } = await supabaseAdmin
        .from('generation_jobs')
        .select('*')
        .eq('id', testJob.id)
        .single();

      return NextResponse.json({
        success: false,
        error: 'Worker ha fallat durant el test',
        details: workerError.message,
        jobStatus: failedJob?.status,
        jobError: failedJob?.error_message,
        diagnostics: {
          projectId,
          templateId: project.template.id,
          contextPath: jobConfig.context_document_path,
          templatePath: jobConfig.template_document_path
        }
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[Test Worker Fix] Error general:', error);
    return NextResponse.json({
      error: 'Error intern del test',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/debug/test-worker-fix',
    description: 'Test del worker amb les correccions aplicades',
    usage: 'POST amb { "projectId": "uuid" }',
    timestamp: new Date().toISOString()
  });
}
