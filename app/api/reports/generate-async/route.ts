import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/serverClient'
import { DocumentProcessor } from '@/lib/workers/documentProcessor'

export async function POST(request: NextRequest) {
  console.log('🚀 Iniciant generació asíncrona d\'informes...')
  
  try {
    const { projectId } = await request.json()
    
    if (!projectId) {
      return NextResponse.json({
        success: false,
        error: 'projectId és obligatori'
      }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    
    // Obtenir informació del projecte
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        *,
        template:plantilla_configs(*)
      `)
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      throw new Error(`Projecte no trobat: ${projectError?.message}`)
    }

    // Obtenir totes les generacions del projecte
    const { data: generations, error: generationsError } = await supabase
      .from('generations')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'pending')

    if (generationsError) {
      throw new Error(`Error obtenint generacions: ${generationsError.message}`)
    }

    if (!generations || generations.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hi ha generacions pendents per processar'
      }, { status: 400 })
    }

    // Comptar placeholders per calcular el progrés total
    const totalPlaceholders = project.template?.prompts?.length || 0
    const totalGenerations = generations.length
    const totalTasks = totalPlaceholders * totalGenerations

    // Crear job de generació per cada generation
    const jobsToCreate = generations.map(generation => ({
      generation_id: generation.id,
      user_id: project.user_id,
      status: 'pending',
      progress: 0.00,
      total_placeholders: totalPlaceholders,
      completed_placeholders: 0,
      job_config: {
        project_id: projectId,
        template_id: project.template_id,
        excel_data: project.excel_data,
        prompts: project.template?.prompts || []
      }
    }))

    // Inserir els jobs a la base de dades
    const { data: createdJobs, error: jobsError } = await supabase
      .from('generation_jobs')
      .insert(jobsToCreate)
      .select('*')

    if (jobsError) {
      throw new Error(`Error creant jobs: ${jobsError.message}`)
    }

    // Iniciar processament REAL en background per cada job
    const processor = new DocumentProcessor()
    const processingPromises = createdJobs.map(job => 
      processor.processJob(job.id).catch(error => {
        console.error(`Error processant job ${job.id}:`, error)
      })
    )

    // No esperem que acabin - processament asíncron real
    Promise.all(processingPromises).catch(error => {
      console.error('Error en processament asíncron real:', error)
    })

    console.log(`✅ ${createdJobs.length} jobs creats i iniciats`)

    return NextResponse.json({
      success: true,
      message: `${createdJobs.length} jobs de generació iniciats`,
      jobs: createdJobs.map(job => ({
        id: job.id,
        generation_id: job.generation_id,
        status: job.status,
        progress: job.progress
      }))
    })
    
  } catch (error) {
    console.error('❌ Error iniciant generació asíncrona:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 })
  }
}

// Ara utilitza el DocumentProcessor real per processar els jobs
// Les funcions de simulació han estat eliminades perquè el Worker MVP real està implementat
