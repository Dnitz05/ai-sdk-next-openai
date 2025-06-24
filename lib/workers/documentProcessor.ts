import { createClient } from '@supabase/supabase-js';
import { 
  CONTENT_GENERATION_PROMPT,
  MISTRAL_CONFIG
} from '@/lib/ai/system-prompts';
import { JobConfig } from '@/app/types';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class DocumentProcessor {
  private supabase = supabaseAdmin;

  private async getJobData(jobId: string) {
    const { data: job, error } = await this.supabase
      .from('generation_jobs')
      .select('*, generation:generations(*)')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      throw new Error(`Error obtenint dades del job: ${error?.message}`);
    }
    if (!job.job_config) {
      throw new Error(`El job_config per al job ${jobId} és null.`);
    }
    return job;
  }

  private async updateJobStatus(jobId: string, status: 'processing' | 'completed' | 'failed', data: object = {}) {
    await this.supabase.from('generation_jobs').update({ status, ...data }).eq('id', jobId);
  }

  private async updateGenerationStatus(generationId: string, status: 'generated' | 'error', errorMessage?: string) {
    await this.supabase.from('generations').update({ status, error_message: errorMessage }).eq('id', generationId);
  }

  private async updateProgress(jobId: string, completedCount: number, totalCount: number) {
    const progress = Math.round((completedCount / totalCount) * 100);
    await this.supabase.from('generation_jobs').update({ progress, completed_placeholders: completedCount }).eq('id', jobId);
  }

  public async processJob(jobId: string): Promise<void> {
    console.log(`[Worker] Iniciant processament per al job: ${jobId}`);
    let jobData;
    try {
      await this.updateJobStatus(jobId, 'processing', { started_at: new Date().toISOString() });

      jobData = await this.getJobData(jobId);
      const config = jobData.job_config as JobConfig;
      const generation = jobData.generation;

      if (!generation) {
        throw new Error(`No s'ha trobat la 'generation' associada al job ${jobId}`);
      }

      const rowData = config.excel_data?.[0];
      if (!rowData) {
        throw new Error('El job_config no conté files de dades (excel_data) per processar.');
      }

      const prompts = config.prompts || [];
      if (prompts.length === 0) {
        throw new Error('La configuració del job no conté prompts.');
      }

      let completedCount = 0;
      let hasErrors = false;

      for (const prompt of prompts) {
        try {
          const mistralPrompt = CONTENT_GENERATION_PROMPT(
            prompt.prompt,
            rowData,
            prompt.useExistingText ? prompt.originalParagraphText : undefined
          );

          const mistralResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
            },
            body: JSON.stringify({
              model: MISTRAL_CONFIG.model,
              messages: [{ role: 'user', content: mistralPrompt }],
              temperature: MISTRAL_CONFIG.temperature,
              max_tokens: MISTRAL_CONFIG.max_tokens,
              top_p: MISTRAL_CONFIG.top_p
            })
          });

          if (!mistralResponse.ok) {
            const errorText = await mistralResponse.text();
            throw new Error(`Error de Mistral AI: ${mistralResponse.status} - ${errorText}`);
          }

          const mistralData = await mistralResponse.json();
          const generatedContent = mistralData.choices?.[0]?.message?.content;

          if (!generatedContent) {
            throw new Error('Mistral AI ha retornat contingut buit');
          }

          await this.supabase.from('generated_content').upsert({
            generation_id: generation.id,
            placeholder_id: prompt.paragraphId,
            final_content: generatedContent.trim(),
            is_refined: false,
          }, { onConflict: 'generation_id,placeholder_id' });

          completedCount++;
          await this.updateProgress(jobId, completedCount, prompts.length);

        } catch (promptError: any) {
          console.error(`[Worker] Error processant prompt ${prompt.paragraphId} per al job ${jobId}:`, promptError.message);
          hasErrors = true;
          // No aturem el bucle, continuem amb els altres prompts
        }
      }

      if (hasErrors) {
        throw new Error(`El job ha finalitzat amb errors en ${prompts.length - completedCount} de ${prompts.length} prompts.`);
      }

      await this.updateJobStatus(jobId, 'completed', { completed_at: new Date().toISOString() });
      await this.updateGenerationStatus(generation.id, 'generated');
      console.log(`[Worker] ✅ Job ${jobId} finalitzat amb èxit.`);

    } catch (error: any) {
      console.error(`[Worker] Error catastròfic processant el job ${jobId}:`, error.message);
      await this.updateJobStatus(jobId, 'failed', {
        error_message: error.message,
        completed_at: new Date().toISOString(),
      });
      if (jobData?.generation?.id) {
        await this.updateGenerationStatus(jobData.generation.id, 'error', error.message);
      }
    }
  }
}

export const documentProcessor = new DocumentProcessor();
