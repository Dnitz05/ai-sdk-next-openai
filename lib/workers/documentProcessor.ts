// COPIAR I ENGANXAR AQUEST CODI COMPLET A: src/lib/workers/documentProcessor.ts

import { createClient } from '@supabase/supabase-js'; // Afegit import
import pLimit from 'p-limit'; // Corregit import
// Importa altres dependències que necessitis (com la de Mistral AI, etc.)

// Client de Supabase amb permisos de servei per operar en segon pla (definit localment)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class DocumentProcessor {
  private supabase = supabaseAdmin; // Ara utilitza el supabaseAdmin definit localment
  // private mistral = new MistralClient(...); // Assegura't que el client de Mistral estigui inicialitzat

  constructor() {
    // Inicialització si és necessària
  }

  private async getJobData(jobId: string) {
    console.log(`[Worker] Obtenint dades per al job ${jobId}`);
    const { data: job, error } = await this.supabase
      .from('generation_jobs')
      .select('id, status, job_config') // <-- CONSULTA FINAL I MÍNIMA
      .eq('id', jobId)
      .single();

    if (error || !job) {
      throw new Error(`Error obtenint dades del job: ${error?.message}`);
    }

    if (!job.job_config) {
      throw new Error(`El job_config per al job ${jobId} és null.`);
    }

    console.log(`[Worker] Dades del job ${jobId} obtingudes correctament.`);
    return job as any;
  }

  private async updateJobStatus(jobId: string, status: string, data: object = {}) {
    await this.supabase.from('generation_jobs').update({ status, ...data }).eq('id', jobId);
  }
  
  // Aquesta funció ara accepta el total per fer el càlcul
  private async updateProgress(jobId: string, completedCount: number, totalCount: number) {
    const progress = Math.round((completedCount / totalCount) * 100);
    await this.supabase.from('generation_jobs').update({ progress, completed_placeholders: completedCount }).eq('id', jobId);
  }

  public async processJob(jobId: string): Promise<void> {
    try {
      console.log(`[Worker] Iniciant processament real per al job: ${jobId}`);
      await this.updateJobStatus(jobId, 'processing', { started_at: new Date().toISOString() });

      const jobData = await this.getJobData(jobId);
      const config = jobData.job_config as any; // El nostre objecte de configuració

      // Calculem el total directament des del config
      const totalRows = config.excel_data?.length || 0; 
      if (totalRows === 0) {
        throw new Error('El job_config no conté files de dades (excel_data) per processar.');
      }
      
      // ... Aquí aniria la teva lògica per descarregar la plantilla .docx ...
      // const templateBuffer = await this.downloadTemplate(config.template_document_path);

      let completedCount = 0;
      
      // Bucle per processar cada fila de l'excel
      for (const [index, rowData] of config.excel_data.entries()) {
        console.log(`[Worker] Processant fila ${index + 1} de ${totalRows}`);
        
        // ... La teva lògica per generar el text amb la IA ...
        // ... La teva lògica per reemplaçar placeholders al docx ...
        
        completedCount++;
        await this.updateProgress(jobId, completedCount, totalRows);
      }
      
      // ... La teva lògica per guardar el document final o documents finals ...

      console.log(`[Worker] Job ${jobId} finalitzat amb èxit.`);
      await this.updateJobStatus(jobId, 'completed', { completed_at: new Date().toISOString() });

    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error(`[Worker] Error catastròfic processant el job ${jobId}:`, errorMessage);
      await this.updateJobStatus(jobId, 'failed', {
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      });
    }
  }
}

export const documentProcessor = new DocumentProcessor();
