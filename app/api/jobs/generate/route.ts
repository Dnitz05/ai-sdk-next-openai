/**
 * Jobs Generation Endpoint
 * Crea jobs de generació a la base de dades per ser processats automàticament pel webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/serverClient';

export async function POST(request: NextRequest) {
  console.log('🚀 Iniciant creació de jobs per a processament automàtic...');
  
  try {
    const { projectId } = await request.json();
    
    if (!projectId) {
      return NextResponse.json({
        success: false,
        error: 'projectId és obligatori'
      }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    
    // Obtenir informació del projecte amb la plantilla
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        user_id,
        template_id,
        excel_data,
        template:plantilla_configs(
          id,
          name,
          prompts,
          template_document_path
        )
      `)
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('Error obtenint projecte:', projectError);
      throw new Error(`Projecte no trobat: ${projectError?.message}`);
    }

    if (!project.template) {
      throw new Error('El projecte no té una plantilla assignada');
    }

    console.log(`Projecte carregat: ${project.name} (${project.id})`);
    console.log(`Plantilla: ${project.template.name} amb ${project.template.prompts?.length || 0} prompts`);

    // Obtenir totes les generacions pendents del projecte
    const { data: generations, error: generationsError } = await supabase
      .from('generations')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'pending');

    if (generationsError) {
      console.error('Error obtenint generacions:', generationsError);
      throw new Error(`Error obtenint generacions: ${generationsError.message}`);
    }

    if (!generations || generations.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hi ha generacions pendents per processar. Assegura\'t que hi hagi files d\'Excel carregades.'
      }, { status: 400 });
    }

    console.log(`Trobades ${generations.length} generacions pendents per processar`);

    // Preparar dades per als jobs
    const totalPlaceholders = project.template.prompts?.length || 0;
    
    if (totalPlaceholders === 0) {
      throw new Error('La plantilla no conté cap prompt/placeholder configurat');
    }

    // Crear un job per cada generació
    const jobsToCreate = generations.map(generation => ({
      generation_id: generation.id,
      user_id: project.user_id,
      status: 'pending' as const,
      progress: 0.00,
      total_placeholders: totalPlaceholders,
      completed_placeholders: 0,
      job_config: {
        project_id: projectId,
        template_id: project.template_id,
        template_document_path: project.template.template_document_path,
        prompts: project.template.prompts || []
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    console.log(`Creant ${jobsToCreate.length} jobs...`);

    // Inserir els jobs a la base de dades
    // Això triggerarà automàticament el webhook que iniciarà el processament
    const { data: createdJobs, error: jobsError } = await supabase
      .from('generation_jobs')
      .insert(jobsToCreate)
      .select('id, generation_id, status, total_placeholders, created_at');

    if (jobsError) {
      console.error('Error creant jobs:', jobsError);
      throw new Error(`Error creant jobs: ${jobsError.message}`);
    }

    console.log(`✅ ${createdJobs.length} jobs creats correctament`);
    console.log('🎯 Els jobs seran processats automàticament pel webhook del sistema');

    // Marcar el projecte com a 'processing' si no ho està ja
    await supabase
      .from('projects')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString() 
      })
      .eq('id', projectId);

    return NextResponse.json({
      success: true,
      message: `${createdJobs.length} jobs de generació creats correctament`,
      projectId: projectId,
      jobsCreated: createdJobs.length,
      totalPlaceholders: totalPlaceholders,
      jobs: createdJobs.map(job => ({
        id: job.id,
        generation_id: job.generation_id,
        status: job.status,
        total_placeholders: job.total_placeholders,
        created_at: job.created_at
      })),
      webhook_info: {
        message: 'Els jobs seran processats automàticament pel sistema',
        estimated_time: `~${Math.ceil((totalPlaceholders * createdJobs.length) / 5)} segons amb processament paral·lel`
      }
    });
    
  } catch (error) {
    console.error('❌ Error creant jobs de generació:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconegut creant jobs',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * GET - Obtenir informació sobre l'estat dels jobs d'un projecte
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    
    if (!projectId) {
      return NextResponse.json({
        success: false,
        error: 'projectId és obligatori'
      }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    
    // Obtenir tots els jobs del projecte
    const { data: jobs, error } = await supabase
      .from('generation_jobs')
      .select(`
        id,
        generation_id,
        status,
        progress,
        total_placeholders,
        completed_placeholders,
        created_at,
        started_at,
        completed_at,
        error_message,
        generation:generations(
          excel_row_index,
          row_data
        )
      `)
      .eq('job_config->project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error obtenint jobs: ${error.message}`);
    }

    // Calcular estadístiques
    const totalJobs = jobs.length;
    const completedJobs = jobs.filter(job => job.status === 'completed').length;
    const processingJobs = jobs.filter(job => job.status === 'processing').length;
    const pendingJobs = jobs.filter(job => job.status === 'pending').length;
    const failedJobs = jobs.filter(job => job.status === 'failed').length;

    const overallProgress = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

    return NextResponse.json({
      success: true,
      projectId: projectId,
      summary: {
        total_jobs: totalJobs,
        completed_jobs: completedJobs,
        processing_jobs: processingJobs,
        pending_jobs: pendingJobs,
        failed_jobs: failedJobs,
        overall_progress: Math.round(overallProgress * 100) / 100
      },
      jobs: jobs
    });

  } catch (error) {
    console.error('Error obtenint informació dels jobs:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 });
  }
}
