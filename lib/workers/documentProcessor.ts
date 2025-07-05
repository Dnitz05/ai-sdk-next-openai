import { createClient } from '@supabase/supabase-js';
import { 
  CONTENT_GENERATION_PROMPT,
  MISTRAL_CONFIG
} from '@/lib/ai/system-prompts';
import { JobConfig } from '@/app/types';
import { getDocxTextContent } from '@/util/docx/readDocxFromStorage';
import { applyFinalSubstitutions } from '@/util/docx/applyFinalSubstitutions';

// Verificar variables d'entorn del worker
console.log(`[DocumentProcessor] Verificant variables d'entorn del worker...`);
console.log(`[DocumentProcessor] NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'PRESENT' : 'MISSING'}`);
console.log(`[DocumentProcessor] SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'PRESENT' : 'MISSING'}`);
console.log(`[DocumentProcessor] MISTRAL_API_KEY: ${process.env.MISTRAL_API_KEY ? 'PRESENT' : 'MISSING'}`);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('[DocumentProcessor] NEXT_PUBLIC_SUPABASE_URL no està definida en les variables d\'entorn del worker');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('[DocumentProcessor] SUPABASE_SERVICE_ROLE_KEY no està definida en les variables d\'entorn del worker');
}

if (!process.env.MISTRAL_API_KEY) {
  throw new Error('[DocumentProcessor] MISTRAL_API_KEY no està definida en les variables d\'entorn del worker');
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log(`[DocumentProcessor] ✅ Client Supabase del worker creat correctament`);

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
      let config = jobData.job_config as JobConfig;
      const generation = jobData.generation;

      if (!generation) {
        throw new Error(`No s'ha trobat la 'generation' associada al job ${jobId}`);
      }

      // 🔥 FALLBACK: Convertir configuracions antigues a la nova arquitectura
      if (!config.context_document_path || !config.template_document_path) {
        console.log(`[Worker] 🔄 MIGRANT configuració antiga per al job ${jobId}`);
        
        // Obtenir la configuració de la plantilla per construir els paths
        const { data: templateData, error: templateError } = await this.supabase
          .from('plantilla_configs')
          .select('base_docx_storage_path, placeholder_docx_storage_path, indexed_docx_storage_path')
          .eq('id', config.template_id)
          .single();

        if (templateError || !templateData) {
          throw new Error(`Error obtenint configuració de plantilla ${config.template_id}: ${templateError?.message}`);
        }

        // Assignar context_document_path
        if (!config.context_document_path) {
          if (templateData.base_docx_storage_path) {
            config.context_document_path = templateData.base_docx_storage_path;
            console.log(`[Worker] ✅ Context document assignat: ${config.context_document_path}`);
          } else {
            throw new Error(`[Worker] No s'ha pogut determinar context_document_path per al job ${jobId}. La plantilla ${config.template_id} no té base_docx_storage_path.`);
          }
        }

        // Assignar template_document_path amb fallbacks
        if (!config.template_document_path) {
          if (templateData.placeholder_docx_storage_path) {
            config.template_document_path = templateData.placeholder_docx_storage_path;
            console.log(`[Worker] ✅ Template document assignat (placeholder): ${config.template_document_path}`);
          } else if (templateData.indexed_docx_storage_path) {
            config.template_document_path = templateData.indexed_docx_storage_path;
            console.log(`[Worker] ✅ Template document assignat (indexed): ${config.template_document_path}`);
          } else {
            config.template_document_path = config.context_document_path;
            console.log(`[Worker] ⚠️ Template document assignat (base com a fallback): ${config.template_document_path}`);
          }
        }

        // Actualitzar la configuració del job a la base de dades per futures execucions
        await this.supabase
          .from('generation_jobs')
          .update({ job_config: config })
          .eq('id', jobId);

        console.log(`[Worker] ✅ Configuració del job ${jobId} migrada i actualitzada`);
      }

      const rowData = config.excel_data?.[0];
      if (!rowData) {
        throw new Error('El job_config no conté files de dades (excel_data) per processar.');
      }

      const prompts = config.prompts || [];
      if (prompts.length === 0) {
        throw new Error('La configuració del job no conté prompts.');
      }

      // 🔥 NOVA ARQUITECTURA: Utilitzar context_document_path per obtenir context per la IA
      console.log(`[Worker] NOVA ARQUITECTURA - Obtenint context des de: ${config.context_document_path}`);
      console.log(`[Worker] Document plantilla per substitucions: ${config.template_document_path}`);
      
      if (!config.context_document_path) {
        throw new Error(`[Worker] context_document_path és null o undefined per al job ${jobId}. No es pot continuar.`);
      }
      
      if (!config.template_document_path) {
        throw new Error(`[Worker] template_document_path és null o undefined per al job ${jobId}. No es pot continuar.`);
      }
      
      let fullDocumentText;
      try {
        // FASE 1: Llegir document original per obtenir context ric per la IA
        console.log(`[Worker] 🔍 DIAGNÒSTIC COMPLET - Intentant llegir document de context...`);
        console.log(`[Worker] Path del document de context: "${config.context_document_path}"`);
        console.log(`[Worker] Variables d'entorn disponibles al worker:`, {
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30)}...` : 'MISSING',
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 30)}...` : 'MISSING',
          NODE_ENV: process.env.NODE_ENV,
          VERCEL: process.env.VERCEL,
          VERCEL_ENV: process.env.VERCEL_ENV
        });
        
        fullDocumentText = await getDocxTextContent(config.context_document_path);
        console.log(`[Worker] ✅ Context del document original obtingut per al job ${jobId}. Longitud: ${fullDocumentText?.length}`);
        console.log(`[Worker] Primeres 200 caràcters del document:`, fullDocumentText?.substring(0, 200));
      } catch (docError: any) {
        console.error(`[Worker] ❌ ERROR CRÍTIC obtenint context del document per al job ${jobId}`);
        console.error(`[Worker] Path problemàtic: "${config.context_document_path}"`);
        console.error(`[Worker] Tipus d'error: ${docError.constructor.name}`);
        console.error(`[Worker] Missatge d'error: ${docError.message}`);
        console.error(`[Worker] Stack trace complet:`, docError.stack);
        console.error(`[Worker] Error complet serialitzat:`, JSON.stringify(docError, Object.getOwnPropertyNames(docError), 2));
        
        // Intentar diagnòstic addicional
        try {
          console.log(`[Worker] 🔧 Intentant diagnòstic addicional del client Supabase...`);
          const { data: buckets, error: bucketsError } = await this.supabase.storage.listBuckets();
          if (bucketsError) {
            console.error(`[Worker] Error llistant buckets:`, bucketsError);
          } else {
            console.log(`[Worker] Buckets disponibles des del worker:`, buckets?.map(b => b.name));
          }
        } catch (diagError) {
          console.error(`[Worker] Error en diagnòstic addicional:`, diagError);
        }
        
        throw new Error(`Error obtenint el document de context: ${docError.message}`);
      }
      
      if (!fullDocumentText) {
        throw new Error(`[Worker] El contingut del document de context llegit des de ${config.context_document_path} és buit o invàlid per al job ${jobId}.`);
      }

      let completedCount = 0;
      let hasErrors = false;

      console.log(`[Worker] Iniciant bucle de prompts per al job ${jobId}. Total prompts: ${prompts.length}`);
      for (const prompt of prompts) {
        try {
          console.log(`[Worker] Processant prompt object per al job ${jobId}:`, JSON.stringify(prompt, null, 2));
          console.log(`[Worker] Utilitzant rowData per al job ${jobId}:`, JSON.stringify(rowData, null, 2));

          const mistralPrompt = CONTENT_GENERATION_PROMPT(
            prompt.prompt,
            rowData,
            fullDocumentText
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
          console.log(`[Worker] Resposta de Mistral AI per al job ${jobId} (prompt ${prompt.paragraphId}):`, JSON.stringify(mistralData, null, 2));
          const fullGeneratedText = mistralData.choices?.[0]?.message?.content;

          if (!fullGeneratedText) {
            console.error(`[Worker] Contingut generat per Mistral AI és buit o invàlid per al job ${jobId} (prompt ${prompt.paragraphId}). Resposta completa:`, JSON.stringify(mistralData, null, 2));
            throw new Error('Mistral AI ha retornat contingut buit');
          }

          // MILLORA: Usar el context original que ja tenim, no llegir el template de nou
          const paragraphs = fullGeneratedText.split('\n\n');
          const originalParagraphs = fullDocumentText.split('\n\n');
          const promptIndex = originalParagraphs.findIndex(p => p.includes(prompt.originalParagraphText));
          
          const generatedContent = paragraphs[promptIndex] || fullGeneratedText;

          console.log(`[Worker] Contingut generat per Mistral AI per al job ${jobId} (prompt ${prompt.paragraphId}): "${generatedContent.trim()}"`);

          const { error: upsertError } = await this.supabase.from('generated_content').upsert({
            generation_id: generation.id,
            placeholder_id: prompt.paragraphId, // Assegura't que prompt.paragraphId és el correcte i existeix a la plantilla
            final_content: generatedContent.trim(),
            is_refined: false,
          }, { onConflict: 'generation_id,placeholder_id' });
          
          if (upsertError) {
            console.error(`[Worker] Error desant contingut a generated_content per al job ${jobId} (prompt ${prompt.paragraphId}):`, JSON.stringify(upsertError, null, 2));
            throw new Error(`Error desant contingut: ${upsertError.message}`);
          } else {
            console.log(`[Worker] ✅ Contingut desat correctament a generated_content per al job ${jobId} (prompt ${prompt.paragraphId})`);
          }

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

      // 🔥 FASE 2: Aplicar substitucions finals al document plantilla
      console.log(`[Worker] 🔄 FASE 2: Iniciant substitucions finals per al job ${jobId}`);
      
      try {
        // Recollir tot el contingut generat per aquest job
        const { data: generatedContentData, error: fetchError } = await this.supabase
          .from('generated_content')
          .select('placeholder_id, final_content')
          .eq('generation_id', generation.id);

        if (fetchError) {
          throw new Error(`Error recollint contingut generat: ${fetchError.message}`);
        }

        // Crear mapa de placeholder_id -> contingut
        const generatedContentMap = generatedContentData?.reduce((acc, item) => {
          acc[item.placeholder_id] = item.final_content || '';
          return acc;
        }, {} as { [key: string]: string }) || {};

        console.log(`[Worker] Contingut generat recollit per substitucions:`, Object.keys(generatedContentMap));

        // Aplicar substitucions al document plantilla
        const finalDocumentBuffer = await applyFinalSubstitutions(
          config.template_document_path,
          generatedContentMap,
          rowData
        );

        // TODO: Desar el document final a Supabase Storage
        // Per ara, només registrem que s'ha generat correctament
        console.log(`[Worker] ✅ Document final generat correctament. Mida: ${finalDocumentBuffer.length} bytes`);

      } catch (substitutionError: any) {
        console.error(`[Worker] Error en substitucions finals per al job ${jobId}:`, substitutionError.message);
        // No fallem el job sencer, però registrem l'error
        console.warn(`[Worker] Continuant amb el job tot i l'error de substitucions.`);
      }

      await this.updateJobStatus(jobId, 'completed', { completed_at: new Date().toISOString() });
      await this.updateGenerationStatus(generation.id, 'generated');
      console.log(`[Worker] ✅ Job ${jobId} finalitzat amb èxit amb nova arquitectura.`);

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
