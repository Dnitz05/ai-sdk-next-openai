// CODI COMPLET I CORREGIT PER A: src/app/api/reports/generate-async/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/serverClient';
import { createClient } from '@supabase/supabase-js'; // Import per al client admin
import { readExcelFromStorage } from '@/util/excel/readExcelFromStorage';
import { GenerationJob, JobConfig } from '@/app/types';
import { z } from 'zod';

// Creació del client admin de Supabase per a operacions de backend
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const generateJobSchema = z.object({
  projectId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  console.log('🚀 [generate-async] Iniciant creació de job de generació asíncrona...');

  try {
    // 1. Autenticació i validació de l'entrada
    const supabaseUserClient = await createServerSupabaseClient();
    const { data: { user } } = await supabaseUserClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
    }

    const body = await request.json();
    const validation = generateJobSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Dades d\'entrada invàlides', details: validation.error.format() }, { status: 400 });
    }
    const { projectId } = validation.data;
    console.log(`[generate-async] Usuari ${user.id} ha sol·licitat un job per al projecte ${projectId}`);

    // 2. Obtenir la configuració del projecte i la plantilla associada
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*, template:plantilla_configs(*)')
      .eq('id', projectId)
      .single();

    if (projectError || !project || !project.template) {
      throw new Error(`Projecte o plantilla associada no trobats: ${projectError?.message}`);
    }
    console.log(`[generate-async] Configuració de plantilla "${project.template.config_name}" carregada.`);

    // 3. Llegir les dades de l'Excel associat a la plantilla
    const excelPath = project.template.excel_storage_path;
    if (!excelPath) {
      throw new Error('La plantilla no té un fitxer Excel configurat.');
    }
    
    const excelData = await readExcelFromStorage(excelPath);
    if (!excelData || !excelData.rows || excelData.rows.length === 0) {
      throw new Error('No s\'han trobat dades a l\'Excel o el fitxer està buit.');
    }
    console.log(`[generate-async] ${excelData.rows.length} files llegides de l'Excel.`);

    // 4. Preparar UNA ÚNICA configuració de feina (JobConfig)
    const jobConfig: JobConfig = {
      template_id: project.template.id,
      project_id: project.id,
      template_document_path: project.template.placeholder_docx_storage_path || project.template.base_docx_storage_path,
      excel_data: excelData.rows, // <-- CORREGIT: Assignem l'array de files
      prompts: project.template.ai_instructions || [], // <-- CORREGIT: Utilitzem ai_instructions
    };

    if (!jobConfig.template_document_path) {
      throw new Error('La plantilla no té un document DOCX base configurat.');
    }

    // 5. Crear UN ÚNIC registre de job a la taula 'generation_jobs'
    const newJobData: Partial<GenerationJob> = {
      user_id: user.id,
      project_id: project.id,
      status: 'pending',
      progress: 0,
      job_config: jobConfig,
    };

    console.log('[generate-async] Creant nou job a la base de dades...');
    const { data: createdJob, error: createJobError } = await supabaseAdmin
      .from('generation_jobs')
      .insert(newJobData)
      .select()
      .single();

    if (createJobError) {
      throw new Error(`Error creant el job a la base de dades: ${createJobError.message}`);
    }

    console.log(`[generate-async] ✅ Job ${createdJob.id} creat amb èxit. El webhook s'encarregarà de la resta.`);

    return NextResponse.json({
      message: 'Job de generació creat amb èxit. El processament començarà en segon pla.',
      job: createdJob,
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ [generate-async] Error inesperat:', error.message);
    return NextResponse.json({ error: 'Error intern del servidor.', details: error.message }, { status: 500 });
  }
}
