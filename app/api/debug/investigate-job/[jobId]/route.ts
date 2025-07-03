import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  try {
    console.log(`[DEBUG] Investigating job: ${jobId}`);

    // 1. Consultar el job específic
    const { data: job, error: jobError } = await supabaseAdmin
      .from('generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError) {
      console.error('[DEBUG] Error fetching job:', jobError);
      return NextResponse.json({ error: 'Job not found', details: jobError }, { status: 404 });
    }

    // 2. Consultar el projecte associat
    let project = null;
    let projectError = null;
    if (job.project_id) {
      const projectResult = await supabaseAdmin
        .from('projects')
        .select('*')
        .eq('id', job.project_id)
        .single();
      
      project = projectResult.data;
      projectError = projectResult.error;
    }

    // 3. Consultar la plantilla associada
    let template = null;
    let templateError = null;
    
    // Intentar obtenir template_id del job_config primer
    let templateId = job.job_config?.template_id;
    
    // Si no està al job_config, intentar del projecte
    if (!templateId && project) {
      templateId = project.template_id;
    }

    if (templateId) {
      const templateResult = await supabaseAdmin
        .from('plantilla_configs')
        .select('*')
        .eq('id', templateId)
        .single();
      
      template = templateResult.data;
      templateError = templateResult.error;
    }

    // 4. Analitzar la configuració del job
    const jobConfig = job.job_config;
    const templateDocumentPath = jobConfig?.template_document_path;

    // 5. Preparar informe de diagnòstic
    const diagnosis = {
      job_exists: !!job,
      job_id: jobId,
      job_status: job?.status,
      job_error: job?.error_message,
      project_exists: !!project,
      project_id: job?.project_id,
      template_exists: !!template,
      template_id: templateId,
      
      // Analisi dels camps crítics
      template_document_path: templateDocumentPath,
      template_document_path_valid: !!(templateDocumentPath && templateDocumentPath.trim() !== ''),
      
      // Camps de la plantilla
      template_base_docx_storage_path: template?.base_docx_storage_path,
      template_placeholder_docx_storage_path: template?.placeholder_docx_storage_path,
      template_indexed_docx_storage_path: template?.indexed_docx_storage_path,
      
      // Comprovacions de validesa
      base_path_valid: !!(template?.base_docx_storage_path && template.base_docx_storage_path.trim() !== ''),
      placeholder_path_valid: !!(template?.placeholder_docx_storage_path && template.placeholder_docx_storage_path.trim() !== ''),
      
      // Errors trobats
      errors: {
        job_error: jobError,
        project_error: projectError,
        template_error: templateError
      }
    };

    // 6. Determinar el problema
    let problem_analysis = '';
    if (!diagnosis.template_document_path_valid) {
      if (!diagnosis.placeholder_path_valid && !diagnosis.base_path_valid) {
        problem_analysis = 'ERROR: Ni placeholder_docx_storage_path ni base_docx_storage_path són vàlids a la plantilla.';
      } else if (!diagnosis.placeholder_path_valid) {
        problem_analysis = 'ERROR: placeholder_docx_storage_path no és vàlid, però base_docx_storage_path sí. El job s\'hauria d\'haver creat amb base_docx_storage_path.';
      } else {
        problem_analysis = 'ERROR: template_document_path és invàlid tot i que la plantilla sembla tenir rutes vàlides.';
      }
    } else {
      problem_analysis = 'OK: template_document_path sembla vàlid.';
    }

    return NextResponse.json({
      diagnosis,
      problem_analysis,
      raw_data: {
        job,
        project,
        template
      }
    });

  } catch (error: any) {
    console.error('[DEBUG] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Unexpected error during investigation', 
      details: error.message 
    }, { status: 500 });
  }
}
