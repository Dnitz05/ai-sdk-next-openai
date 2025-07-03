import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { JobConfig } from '@/app/types';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  
  if (process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://your-supabase-project.supabase.co') {
    return NextResponse.json({ 
      error: 'Supabase no configurat', 
      details: 'Credencials de Supabase són valors de placeholder' 
    }, { status: 500 });
  }

  try {
    console.log(`[FIX] Intentant reparar job: ${jobId}`);

    // 1. Obtenir el job actual
    const { data: job, error: jobError } = await supabaseAdmin
      .from('generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job no trobat', details: jobError }, { status: 404 });
    }

    // 2. Obtenir el projecte associat
    if (!job.project_id) {
      return NextResponse.json({ error: 'Job no té project_id associat' }, { status: 400 });
    }

    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*, template:plantilla_configs(*)')
      .eq('id', job.project_id)
      .single();

    if (projectError || !project || !project.template) {
      return NextResponse.json({ 
        error: 'Projecte o plantilla no trobats', 
        details: projectError 
      }, { status: 404 });
    }

    // 3. Verificar i reconstruir template_document_path
    const template = project.template;
    let newTemplateDocumentPath = null;

    // Prioritzar placeholder_docx_storage_path si existeix i és vàlid
    if (template.placeholder_docx_storage_path && template.placeholder_docx_storage_path.trim() !== '') {
      newTemplateDocumentPath = template.placeholder_docx_storage_path;
    } 
    // Sinó, usar base_docx_storage_path si existeix i és vàlid
    else if (template.base_docx_storage_path && template.base_docx_storage_path.trim() !== '') {
      newTemplateDocumentPath = template.base_docx_storage_path;
    }
    // Finalment, intentar indexed_docx_storage_path com a últim recurs
    else if (template.indexed_docx_storage_path && template.indexed_docx_storage_path.trim() !== '') {
      newTemplateDocumentPath = template.indexed_docx_storage_path;
    }

    if (!newTemplateDocumentPath) {
      return NextResponse.json({ 
        error: 'No es pot reparar el job', 
        details: 'La plantilla no té cap ruta de document vàlida configurada',
        template_paths: {
          placeholder_docx_storage_path: template.placeholder_docx_storage_path,
          base_docx_storage_path: template.base_docx_storage_path,
          indexed_docx_storage_path: template.indexed_docx_storage_path
        }
      }, { status: 400 });
    }

    // 4. Reconstruir el job_config
    const currentJobConfig = job.job_config as JobConfig;
    const fixedJobConfig: JobConfig = {
      ...currentJobConfig,
      template_document_path: newTemplateDocumentPath,
      // Assegurar-se que altres camps crítics estan presents
      template_id: currentJobConfig.template_id || template.id,
      project_id: currentJobConfig.project_id || project.id,
    };

    // 5. Actualitzar el job amb la configuració reparada
    const { data: updatedJob, error: updateError } = await supabaseAdmin
      .from('generation_jobs')
      .update({ 
        job_config: fixedJobConfig,
        status: 'pending', // Reset status to pending so it can be processed again
        error_message: null, // Clear previous error message
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ 
        error: 'Error actualitzant el job', 
        details: updateError 
      }, { status: 500 });
    }

    console.log(`[FIX] ✅ Job ${jobId} reparat amb èxit`);

    return NextResponse.json({
      success: true,
      message: 'Job reparat amb èxit',
      job_id: jobId,
      changes: {
        old_template_document_path: currentJobConfig.template_document_path,
        new_template_document_path: newTemplateDocumentPath,
        status_reset: 'pending',
        error_cleared: true
      },
      updated_job: updatedJob
    });

  } catch (error: any) {
    console.error(`[FIX] Error reparant job ${jobId}:`, error);
    return NextResponse.json({ 
      error: 'Error inesperat', 
      details: error.message 
    }, { status: 500 });
  }
}

// GET per veure què es faria sense aplicar canvis
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  
  if (process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://your-supabase-project.supabase.co') {
    return NextResponse.json({ 
      error: 'Supabase no configurat', 
      details: 'Credencials de Supabase són valors de placeholder' 
    }, { status: 500 });
  }

  try {
    // Same logic as POST but without actually updating
    const { data: job, error: jobError } = await supabaseAdmin
      .from('generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job no trobat', details: jobError }, { status: 404 });
    }

    if (!job.project_id) {
      return NextResponse.json({ error: 'Job no té project_id associat' }, { status: 400 });
    }

    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*, template:plantilla_configs(*)')
      .eq('id', job.project_id)
      .single();

    if (projectError || !project || !project.template) {
      return NextResponse.json({ 
        error: 'Projecte o plantilla no trobats', 
        details: projectError 
      }, { status: 404 });
    }

    const template = project.template;
    const currentJobConfig = job.job_config as JobConfig;
    
    let proposedPath = null;
    let pathSource = '';

    if (template.placeholder_docx_storage_path && template.placeholder_docx_storage_path.trim() !== '') {
      proposedPath = template.placeholder_docx_storage_path;
      pathSource = 'placeholder_docx_storage_path';
    } else if (template.base_docx_storage_path && template.base_docx_storage_path.trim() !== '') {
      proposedPath = template.base_docx_storage_path;
      pathSource = 'base_docx_storage_path';
    } else if (template.indexed_docx_storage_path && template.indexed_docx_storage_path.trim() !== '') {
      proposedPath = template.indexed_docx_storage_path;
      pathSource = 'indexed_docx_storage_path';
    }

    return NextResponse.json({
      job_id: jobId,
      current_status: job.status,
      problem_detected: !currentJobConfig.template_document_path,
      current_template_document_path: currentJobConfig.template_document_path,
      proposed_fix: {
        new_template_document_path: proposedPath,
        path_source: pathSource,
        can_fix: !!proposedPath
      },
      template_paths_available: {
        placeholder_docx_storage_path: template.placeholder_docx_storage_path,
        base_docx_storage_path: template.base_docx_storage_path,
        indexed_docx_storage_path: template.indexed_docx_storage_path
      },
      instructions: proposedPath 
        ? "Utilitza POST a aquest endpoint per aplicar la reparació"
        : "No es pot reparar - la plantilla no té cap ruta vàlida"
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Error durant la previsualització', 
      details: error.message 
    }, { status: 500 });
  }
}
