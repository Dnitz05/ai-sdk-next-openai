import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  console.log("[API reports/jobs-status] Rebuda petició GET per estat de jobs amb SSR...");

  try {
    // 1. Crear client SSR per autenticació automàtica amb RLS
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

    // 2. Verificar autenticació SSR
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[API reports/jobs-status] Error d'autenticació SSR:", authError);
      return NextResponse.json({ 
        error: 'Usuari no autenticat',
        details: authError?.message 
      }, { status: 401 });
    }
    
    const userId = user.id;
    console.log("[API reports/jobs-status] Usuari autenticat via SSR:", userId);

    // 3. Obtenir paràmetres
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    
    if (!projectId) {
      return NextResponse.json({
        success: false,
        error: 'projectId és obligatori'
      }, { status: 400 })
    }

    console.log(`[API reports/jobs-status] Consultant jobs per projecte: ${projectId}`);

    // 4. Verificar que el projecte existeix i pertany a l'usuari (RLS automàtic)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, project_name, user_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      console.error(`❌ [API reports/jobs-status] Projecte ${projectId} no trobat o no autoritzat:`, projectError)
      
      // Obtenir projectes disponibles de l'usuari (RLS automàtic)
      const { data: availableProjects } = await supabase
        .from('projects')
        .select('id, project_name, created_at')
        .order('created_at', { ascending: false })
        .limit(5)

      const suggestions = availableProjects?.map(p => `${p.project_name} (${p.id})`) || []
      
      return NextResponse.json({
        success: false,
        error: `Projecte amb ID "${projectId}" no existeix o no està autoritzat`,
        suggestions: suggestions.length > 0 ? suggestions : ['No hi ha projectes disponibles'],
        available_projects: availableProjects || []
      }, { status: 404 })
    }

    console.log(`✅ [API reports/jobs-status] Projecte trobat: ${project.project_name} (${project.id})`)
    
    // 5. Obtenir tots els jobs del projecte amb RLS automàtic
    // RLS assegurarà que només s'obtenen jobs de projectes de l'usuari
    const { data: jobs, error: jobsError } = await supabase
      .from('generation_jobs')
      .select(`
        *,
        generation:generations(
          id,
          excel_row_index,
          row_data,
          status
        )
      `)
      .eq('job_config->>project_id', projectId)
      .order('created_at', { ascending: true })

    if (jobsError) {
      console.error('[API reports/jobs-status] Error obtenint jobs:', jobsError);
      return NextResponse.json({
        success: false,
        error: `Error obtenint jobs: ${jobsError.message}`,
        details: jobsError
      }, { status: 500 });
    }

    console.log(`📊 [API reports/jobs-status] Trobats ${jobs.length} jobs per al projecte ${projectId}`)

    // 6. Calcular estadístiques globals
    const totalJobs = jobs.length
    const completedJobs = jobs.filter(job => job.status === 'completed').length
    const failedJobs = jobs.filter(job => job.status === 'failed').length
    const processingJobs = jobs.filter(job => job.status === 'processing').length
    const pendingJobs = jobs.filter(job => job.status === 'pending').length

    // Calcular progrés global
    const totalProgress = jobs.reduce((sum, job) => sum + (job.progress || 0), 0)
    const averageProgress = totalJobs > 0 ? totalProgress / totalJobs : 0

    // 7. Preparar resposta amb detalls de cada job
    const jobsDetails = jobs.map(job => ({
      id: job.id,
      generation_id: job.generation_id,
      status: job.status,
      progress: job.progress,
      total_placeholders: job.total_placeholders,
      completed_placeholders: job.completed_placeholders,
      error_message: job.error_message,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      generation: {
        excel_row_index: job.generation?.excel_row_index,
        row_data: job.generation?.row_data,
        generation_status: job.generation?.status
      },
      // Calcular temps estimat restant
      estimated_remaining: calculateEstimatedTime(job)
    }))

    return NextResponse.json({
      success: true,
      project_id: projectId,
      summary: {
        total_jobs: totalJobs,
        completed_jobs: completedJobs,
        failed_jobs: failedJobs,
        processing_jobs: processingJobs,
        pending_jobs: pendingJobs,
        overall_progress: Math.round(averageProgress * 100) / 100,
        overall_status: getOverallStatus(completedJobs, failedJobs, processingJobs, pendingJobs, totalJobs)
      },
      jobs: jobsDetails
    })
    
  } catch (error) {
    console.error('❌ [API reports/jobs-status] Error obtenint estat dels jobs:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 })
  }
}

// Endpoint per cancel·lar jobs amb SSR i RLS
export async function DELETE(request: NextRequest) {
  console.log("[API reports/jobs-status] Rebuda petició DELETE per cancel·lar jobs amb SSR...");

  try {
    // 1. Crear client SSR per autenticació automàtica amb RLS
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

    // 2. Verificar autenticació SSR
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[API reports/jobs-status] Error d'autenticació SSR:", authError);
      return NextResponse.json({ 
        error: 'Usuari no autenticat',
        details: authError?.message 
      }, { status: 401 });
    }
    
    const userId = user.id;
    console.log("[API reports/jobs-status] Usuari autenticat via SSR per cancel·lació:", userId);

    // 3. Obtenir paràmetres
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const projectId = searchParams.get('projectId')
    
    if (jobId) {
      // Cancel·lar un job específic (RLS automàtic)
      console.log(`[API reports/jobs-status] Cancel·lant job específic: ${jobId}`);
      
      const { error } = await supabase
        .from('generation_jobs')
        .update({ 
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId)
        .in('status', ['pending', 'processing'])
      
      if (error) {
        console.error('[API reports/jobs-status] Error cancel·lant job específic:', error);
        return NextResponse.json({
          success: false,
          error: `Error cancel·lant job: ${error.message}`,
          details: error
        }, { status: 500 });
      }
      
      console.log(`✅ [API reports/jobs-status] Job ${jobId} cancel·lat correctament`);
      
      return NextResponse.json({
        success: true,
        message: 'Job cancel·lat correctament'
      })
      
    } else if (projectId) {
      // Cancel·lar tots els jobs pendents del projecte
      console.log(`[API reports/jobs-status] Cancel·lant tots els jobs del projecte: ${projectId}`);
      
      // Primer verificar que el projecte pertany a l'usuari
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .single()

      if (projectError || !project) {
        console.error('[API reports/jobs-status] Projecte no trobat o no autoritzat:', projectError);
        return NextResponse.json({
          success: false,
          error: 'Projecte no trobat o no autoritzat'
        }, { status: 404 });
      }
      
      const { error } = await supabase
        .from('generation_jobs')
        .update({ 
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .eq('job_config->>project_id', projectId)
        .in('status', ['pending', 'processing'])
      
      if (error) {
        console.error('[API reports/jobs-status] Error cancel·lant jobs del projecte:', error);
        return NextResponse.json({
          success: false,
          error: `Error cancel·lant jobs del projecte: ${error.message}`,
          details: error
        }, { status: 500 });
      }
      
      console.log(`✅ [API reports/jobs-status] Tots els jobs del projecte ${projectId} cancel·lats`);
      
      return NextResponse.json({
        success: true,
        message: 'Tots els jobs del projecte cancel·lats'
      })
      
    } else {
      return NextResponse.json({
        success: false,
        error: 'jobId o projectId és obligatori per cancel·lar'
      }, { status: 400 })
    }
    
  } catch (error) {
    console.error('❌ [API reports/jobs-status] Error cancel·lant jobs:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 })
  }
}

// Funció per calcular temps estimat restant
function calculateEstimatedTime(job: any): string | null {
  if (job.status === 'completed' || job.status === 'failed') {
    return null
  }
  
  if (!job.started_at || job.progress <= 0) {
    return 'Calculant...'
  }
  
  const startTime = new Date(job.started_at).getTime()
  const currentTime = new Date().getTime()
  const elapsedMinutes = (currentTime - startTime) / (1000 * 60)
  
  if (job.progress >= 100) {
    return 'Finalitzant...'
  }
  
  const estimatedTotalMinutes = (elapsedMinutes / job.progress) * 100
  const remainingMinutes = estimatedTotalMinutes - elapsedMinutes
  
  if (remainingMinutes < 1) {
    return 'Menys d\'1 minut'
  } else if (remainingMinutes < 60) {
    return `${Math.round(remainingMinutes)} minuts`
  } else {
    const hours = Math.floor(remainingMinutes / 60)
    const minutes = Math.round(remainingMinutes % 60)
    return `${hours}h ${minutes}m`
  }
}

// Funció per determinar l'estat global del projecte
function getOverallStatus(completed: number, failed: number, processing: number, pending: number, total: number): string {
  if (completed === total) {
    return 'completed'
  } else if (failed === total) {
    return 'failed'
  } else if (processing > 0) {
    return 'processing'
  } else if (pending > 0) {
    return 'pending'
  } else if (completed > 0 && failed > 0) {
    return 'partial'
  } else {
    return 'unknown'
  }
}
