/**
 * DocumentProcessor - Worker MVP Real
 * Orquestrador que processa jobs de generació de documents utilitzant Mistral AI
 */

import * as JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { createClient } from '@supabase/supabase-js';
import { CONTENT_GENERATION_PROMPT, MISTRAL_CONFIG } from '@/lib/ai/system-prompts';
import pLimit from 'p-limit';

// Interfície per als placeholders
interface PlaceholderConfig {
  paragraphId: string;
  prompt: string;
  baseText?: string;
  [key: string]: any; // Per permetre propietats addicionals
}

// Client de Supabase amb permisos de servei per operar en segon pla
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class DocumentProcessor {
  /**
   * Mètode principal que orquestra el processament d'una feina de generació.
   * @param jobId L'ID de la feina a processar.
   */
  public async processJob(jobId: string): Promise<void> {
    try {
      console.log(`[Worker] Iniciant processament real per al job: ${jobId}`);
      await this.updateJobStatus(jobId, 'processing', { started_at: new Date().toISOString() });

      const jobData = await this.getJobData(jobId);
      // getJobData ara llença un error si jobData o jobData.job_config és null/undefined.
      // Assumim que job_config conté els camps necessaris que abans estaven a 'generation'.
      const generationDetails = jobData.job_config as any; // Utilitzem 'as any' per simplicitat com a l'exemple de l'usuari

      if (!generationDetails.template_document_path || !generationDetails.template_placeholders) {
        throw new Error(`job_config per al job ${jobId} no conté template_document_path o template_placeholders.`);
      }
      
      console.log(`[Worker] Dades del job carregades:`, {
        // Si generationDetails (job_config) té un camp 'id' per a la generació:
        // generationId: generationDetails.id, 
        // Si no, potser l'ID del job és suficient o cal ajustar el que es desa a job_config.
        // De moment, comentem generationId si no està clar d'on treure'l des de job_config.
        // generationId: generationDetails.id, // Descomentar si job_config.id és l'ID de la generació
        templatePath: generationDetails.template_document_path,
        placeholdersCount: generationDetails.template_placeholders?.length || 0
      });

      const templateBuffer = await this.downloadTemplateDocx(generationDetails.template_document_path);

      // --- LÒGICA PARAL·LELA: GENERAR CONTINGUT EN PARAL·LEL, APLICAR SEQÜENCIALMENT ---
      const placeholders = generationDetails.template_placeholders || [];
      if (placeholders.length === 0) {
        throw new Error("La plantilla no conté cap placeholder per processar.");
      }

      console.log(`[Worker] Iniciant processament paral·lel de ${placeholders.length} placeholders`);

      // Actualitzar total_placeholders al job
      await this.updateJobStatus(jobId, 'processing', {
        total_placeholders: placeholders.length,
        started_at: new Date().toISOString()
      });

      // FASE 1: GENERAR TOT EL CONTINGUT EN PARAL·LEL
      const concurrencyLimit = pLimit(5); // Límit de 5 crides simultànies a Mistral
      console.log(`[Worker] 🚀 Iniciant generació paral·lela amb límit de concurrència: 5`);

      const aiGenerationTasks = placeholders.map((placeholderConfig: PlaceholderConfig, index: number) =>
        concurrencyLimit(async () => {
          const placeholderIndex = index + 1;
          console.log(`[Worker] Generant contingut per placeholder ${placeholderIndex}/${placeholders.length}: ${placeholderConfig.paragraphId}`);
          
          try {
            const aiContent = await this.generateAiContent(
              placeholderConfig, 
              generationDetails.row_data // Canviat de jobData.generation.row_data
            );
            
            console.log(`[Worker] ✅ Contingut generat per placeholder ${placeholderIndex} (${aiContent.length} chars)`);
            
            return {
              success: true,
              placeholderConfig,
              aiContent,
              index: placeholderIndex
            };
          } catch (error: any) {
            console.error(`[Worker] ❌ Error generant contingut per placeholder ${placeholderIndex}:`, error);
            return {
              success: false,
              placeholderConfig,
              error: error.message,
              index: placeholderIndex
            };
          }
        })
      );

      console.log(`[Worker] Esperant generació paral·lela de ${placeholders.length} continguts...`);
      const generationResults = await Promise.all(aiGenerationTasks);
      
      // Analitzar resultats de la generació paral·lela
      const successfulGenerations = generationResults.filter(result => result.success);
      const failedGenerations = generationResults.filter(result => !result.success);
      
      console.log(`[Worker] Generació paral·lela completada: ${successfulGenerations.length} èxits, ${failedGenerations.length} errors`);
      
      if (failedGenerations.length > 0) {
        console.warn(`[Worker] ⚠️ Errors de generació:`, failedGenerations.map(f => `Placeholder ${f.index}: ${f.error}`));
      }

      // Si totes les generacions han fallat, aturar el processament
      if (successfulGenerations.length === 0) {
        throw new Error("Totes les generacions de contingut han fallat. Revisa la configuració de l'API de Mistral.");
      }

      // FASE 2: APLICAR MODIFICACIONS AL DOCUMENT SEQÜENCIALMENT
      console.log(`[Worker] 📝 Iniciant aplicació seqüencial de ${successfulGenerations.length} modificacions al document`);
      let currentDocumentBuffer = templateBuffer;
      let appliedModifications = 0;

      for (const result of successfulGenerations) {
        if (!result.success) continue; // Saltar els fallits
        
        try {
          console.log(`[Worker] Aplicant modificació ${appliedModifications + 1}/${successfulGenerations.length}: ${result.placeholderConfig.paragraphId}`);
          
          currentDocumentBuffer = await this.modifyDocumentInMemory(
            currentDocumentBuffer, 
            result.placeholderConfig.paragraphId, 
            result.aiContent
          );

          appliedModifications++;
          
          // Actualitzar progrés basant-se en modificacions aplicades
          const progress = (appliedModifications / placeholders.length) * 100;
          await this.updateJobStatus(jobId, 'processing', {
            progress: Math.round(progress * 100) / 100, // 2 decimals
            completed_placeholders: appliedModifications
          });

          console.log(`[Worker] ✅ Modificació aplicada ${appliedModifications}/${successfulGenerations.length} (${progress.toFixed(1)}%)`);

        } catch (modificationError: any) {
          console.error(`[Worker] ❌ Error aplicant modificació per ${result.placeholderConfig.paragraphId}:`, modificationError);
          
          // Registrar error però continuar amb la resta
          await this.updateJobStatus(jobId, 'processing', {
            error_message: `Error aplicant modificació ${result.placeholderConfig.paragraphId}: ${modificationError.message}`,
            completed_placeholders: appliedModifications
          });
        }
      }

      console.log(`[Worker] 🎯 Processament paral·lel completat: ${appliedModifications}/${placeholders.length} placeholders processats correctament`);

      // Pujar document final amb tots els canvis aplicats
      const finalDocumentPath = `public/generated_reports/${jobId}_final.docx`;
      await this.uploadFinalDocx(finalDocumentPath, currentDocumentBuffer);

      await this.updateJobStatus(jobId, 'completed', {
        progress: 100,
        completed_placeholders: placeholders.length,
        final_document_path: finalDocumentPath,
        completed_at: new Date().toISOString()
      });

      console.log(`[Worker] 🎉 Job ${jobId} completat amb èxit! Processats ${placeholders.length} placeholders. Document final: ${finalDocumentPath}`);
    } catch (error: any) {
      console.error(`[Worker] Error catastròfic processant el job ${jobId}:`, error);
      await this.updateJobStatus(jobId, 'failed', { 
        error_message: error.message,
        completed_at: new Date().toISOString()
      });
      throw error; // Re-llançar per a debugging
    }
  }

  private async getJobData(jobId: string) {
    console.log(`[Worker] Obtenint dades per al job ${jobId}`);
    const { data: job, error } = await supabaseAdmin
      .from('generation_jobs')
      .select('id, status, job_config, total_reports') // <-- CONSULTA CORREGIDA I SIMPLIFICADA
      .eq('id', jobId)
      .single();

    if (error || !job) {
      // Aquest throw és el que genera l'error que veiem als logs, la qual cosa és correcte.
      throw new Error(`Error obtenint dades del job: ${error?.message}`);
    }

    // Comprovem que job_config no sigui null
    if (!job.job_config) {
      throw new Error(`El job_config per al job ${jobId} és null.`);
    }

    console.log(`[Worker] Dades del job ${jobId} obtingudes correctament.`);
    return job as any; // Afegim 'as any' per simplicitat de tipat en aquest punt
  }

  /**
   * Descarrega el document plantilla des de Supabase Storage
   */
  private async downloadTemplateDocx(path: string): Promise<Buffer> {
    console.log(`[Worker] Descarregant plantilla des de: ${path}`);
    const { data, error } = await supabaseAdmin.storage
      .from('documents')
      .download(path);

    if (error) {
      throw new Error(`Error descarregant la plantilla: ${error.message}`);
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    console.log(`[Worker] Plantilla descarregada (${buffer.length} bytes)`);
    return buffer;
  }

  /**
   * Puja el document final generat a Supabase Storage
   */
  private async uploadFinalDocx(path: string, buffer: Buffer) {
    console.log(`[Worker] Pujant document final a: ${path} (${buffer.length} bytes)`);
    const { error } = await supabaseAdmin.storage
      .from('documents')
      .upload(path, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      });

    if (error) {
      throw new Error(`Error pujant el document final: ${error.message}`);
    }

    console.log(`[Worker] Document final pujat correctament`);
  }

  /**
   * Genera contingut amb Mistral AI basant-se en la configuració del placeholder
   */
  private async generateAiContent(placeholderConfig: PlaceholderConfig, excelData: any): Promise<string> {
    // Preparar el prompt amb les dades d'Excel substituïdes
    let processedPrompt = placeholderConfig.prompt || 'Genera contingut professional per aquest paràgraf.';
    
    // Substituir placeholders d'Excel al prompt
    if (excelData && typeof excelData === 'object') {
      for (const [key, value] of Object.entries(excelData)) {
        const placeholder = new RegExp(`{{${key}}}`, 'g');
        processedPrompt = processedPrompt.replace(placeholder, String(value));
      }
    }

    // Utilitzar el system prompt professional
    const finalPrompt = CONTENT_GENERATION_PROMPT(
      processedPrompt,
      excelData,
      placeholderConfig.baseText
    );

    console.log(`[Worker] Fent crida a Mistral amb model: ${MISTRAL_CONFIG.model}`);
    console.log(`[Worker] Prompt final (${finalPrompt.length} chars):`, 
      finalPrompt.substring(0, 300) + '...'
    );

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: MISTRAL_CONFIG.model,
        messages: [{ 
          role: 'user', 
          content: finalPrompt 
        }],
        temperature: MISTRAL_CONFIG.temperature,
        max_tokens: MISTRAL_CONFIG.max_tokens,
        top_p: MISTRAL_CONFIG.top_p
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error de l'API de Mistral: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    const generatedContent = result.choices[0].message.content;
    
    console.log(`[Worker] Contingut generat correctament per Mistral`);
    return generatedContent;
  }

  /**
   * Modifica el document DOCX en memòria substituint un placeholder específic
   */
  private async modifyDocumentInMemory(
    templateBuffer: Buffer, 
    placeholderId: string, 
    newContent: string
  ): Promise<Buffer> {
    console.log(`[Worker] Modificant document en memòria - Placeholder: ${placeholderId}`);
    
    const zip = await JSZip.loadAsync(templateBuffer);
    const docFile = zip.file('word/document.xml');
    
    if (!docFile) {
      throw new Error("word/document.xml no trobat dins del .docx");
    }

    const xmlContent = await docFile.async('string');
    const parser = new DOMParser();
    const serializer = new XMLSerializer();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    // Buscar i modificar el placeholder específic
    const sdtElements = Array.from(xmlDoc.getElementsByTagName('w:sdt'));
    let found = false;
    let placeholdersFound = 0;

    console.log(`[Worker] Cercant entre ${sdtElements.length} elements SDT...`);

    for (const sdt of sdtElements) {
      const textElements = sdt.getElementsByTagName('w:t');
      
      for (let i = 0; i < textElements.length; i++) {
        const textContent = textElements[i].textContent || '';
        
        // Verificar si és un placeholder JSON unificat
        if (textContent.includes('{{UNIFIED_PLACEHOLDER:')) {
          placeholdersFound++;
          try {
            // Extreure el JSON del placeholder
            const jsonStart = textContent.indexOf('{{UNIFIED_PLACEHOLDER:') + '{{UNIFIED_PLACEHOLDER:'.length;
            const jsonEnd = textContent.lastIndexOf('}}');
            const jsonString = textContent.substring(jsonStart, jsonEnd);
            const config = JSON.parse(jsonString);
            
            console.log(`[Worker] Placeholder trobat: ${config.paragraphId}`);
            
            if (config.paragraphId === placeholderId) {
              console.log(`[Worker] ✅ Substituint placeholder ${placeholderId}`);
              
              // Substituir tot el contingut amb el nou text generat
              textElements[i].textContent = newContent;
              
              // Netejar altres elements de text del mateix SDT
              for (let j = i + 1; j < textElements.length; j++) {
                textElements[j].textContent = '';
              }
              
              found = true;
              break;
            }
          } catch (e) {
            console.log(`[Worker] Error parsejant placeholder JSON:`, e);
            // Continuar amb el següent element
          }
        }
      }
      
      if (found) break;
    }

    console.log(`[Worker] Placeholders JSON trobats: ${placeholdersFound}`);
    
    if (!found) {
      throw new Error(`Placeholder amb ID ${placeholderId} no trobat al document. Placeholders disponibles: ${placeholdersFound}`);
    }

    // Serialitzar el document modificat
    const finalXml = serializer.serializeToString(xmlDoc);
    zip.file('word/document.xml', finalXml);

    console.log(`[Worker] Document XML modificat i serialitzat`);
    
    return await zip.generateAsync({ type: 'nodebuffer' });
  }

  /**
   * Actualitza l'estat del job a la base de dades
   */
  private async updateJobStatus(
    jobId: string, 
    status: string, 
    additionalData: object = {}
  ): Promise<void> {
    console.log(`[Worker] Actualitzant job ${jobId} a estat: ${status}`, additionalData);
    
    const { error } = await supabaseAdmin
      .from('generation_jobs')
      .update({ 
        status, 
        ...additionalData, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', jobId);

    if (error) {
      console.error(`[Worker] Error actualitzant l'estat del job ${jobId}:`, error);
      throw new Error(`Error actualitzant l'estat del job: ${error.message}`);
    }

    console.log(`[Worker] Job ${jobId} actualitzat correctament`);
  }
}
