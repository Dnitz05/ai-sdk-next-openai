import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/serverClient'
import { documentProcessor } from '@/lib/workers/documentProcessor' // Canviat DocumentProcessor a documentProcessor
import { readExcelFromStorage } from '@/util/excel/readExcelFromStorage'; // Pas 1: Importar la Utilitat de Lectura

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
        template:plantilla_configs(id, config_name, base_docx_name, docx_storage_path, excel_file_name, excel_headers, link_mappings, ai_instructions, final_html, base_docx_storage_path, user_id, placeholder_docx_storage_path, indexed_docx_storage_path, paragraph_mappings, excel_storage_path, created_at, updated_at)
      `)
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      throw new Error(`Projecte no trobat: ${projectError?.message}`)
    }

    // Pas 2: NOU BLOC DE CODI PER LLEGIR L'EXCEL
    console.log('[API /reports/generate-async] Llegint Excel des de la configuració de la plantilla...');
    const excelPath = project.template?.excel_storage_path;
    if (!excelPath) {
      return NextResponse.json({ error: 'La plantilla del projecte no té un fitxer Excel configurat.' }, { status: 400 });
    }

    const excelDataFromStorage = await readExcelFromStorage(excelPath);
    if (!excelDataFromStorage || excelDataFromStorage.rows.length === 0) { // Corregit: excelDataFromStorage.rows.length
      return NextResponse.json({ error: 'No s\'han trobat dades a l\'Excel o el fitxer està buit.' }, { status: 400 });
    }
    console.log(`[API /reports/generate-async] ${excelDataFromStorage.rows.length} files llegides de l'Excel.`); // Corregit: excelDataFromStorage.rows.length
    // FI DEL NOU BLOC

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
        excel_data: excelDataFromStorage, // Pas 3: Utilitzar les Dades Correctes
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
    // const processor = new DocumentProcessor() // Eliminat - utilitzem la instància importada
    const processingPromises = createdJobs.map(job => 
      documentProcessor.processJob(job.id).catch(error => { // Canviat processor a documentProcessor
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
