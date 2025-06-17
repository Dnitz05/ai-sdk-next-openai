/**
 * DocumentProcessor - Worker MVP Real
 * Orquestrador que processa jobs de generació de documents utilitzant Mistral AI
 */

import * as JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { createClient } from '@supabase/supabase-js';
import { CONTENT_GENERATION_PROMPT, MISTRAL_CONFIG } from '@/lib/ai/system-prompts';

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
      if (!jobData || !jobData.generation) {
        throw new Error(`No s'han trobat dades completes per al job ${jobId}`);
      }

      console.log(`[Worker] Dades del job carregades:`, {
        generationId: jobData.generation.id,
        templatePath: jobData.generation.template_document_path,
        placeholdersCount: jobData.generation.template_placeholders?.length || 0
      });

      const templateBuffer = await this.downloadTemplateDocx(jobData.generation.template_document_path);

      // --- LÒGICA MVP: PROCESSAR NOMÉS EL PRIMER PLACEHOLDER ---
      const firstPlaceholderConfig = jobData.generation.template_placeholders?.[0];
      if (!firstPlaceholderConfig || !firstPlaceholderConfig.paragraphId) {
        throw new Error("La plantilla no conté cap placeholder vàlid per processar.");
      }

      console.log(`[Worker] Processant el primer placeholder:`, {
        paragraphId: firstPlaceholderConfig.paragraphId,
        prompt: firstPlaceholderConfig.prompt?.substring(0, 100) + '...'
      });

      const aiContent = await this.generateAiContent(
        firstPlaceholderConfig, 
        jobData.generation.row_data
      );
      
      console.log(`[Worker] Contingut generat per Mistral (${aiContent.length} chars):`, 
        aiContent.substring(0, 200) + '...'
      );

      const modifiedBuffer = await this.modifyDocumentInMemory(
        templateBuffer, 
        firstPlaceholderConfig.paragraphId, 
        aiContent
      );

      const finalDocumentPath = `public/generated_reports/${jobId}_final.docx`;
      await this.uploadFinalDocx(finalDocumentPath, modifiedBuffer);

      await this.updateJobStatus(jobId, 'completed', {
        progress: 100,
        completed_placeholders: 1,
        final_document_path: finalDocumentPath,
        completed_at: new Date().toISOString()
      });

      console.log(`[Worker] Job ${jobId} completat amb èxit. Document final: ${finalDocumentPath}`);
    } catch (error: any) {
      console.error(`[Worker] Error catastròfic processant el job ${jobId}:`, error);
      await this.updateJobStatus(jobId, 'failed', { 
        error_message: error.message,
        completed_at: new Date().toISOString()
      });
      throw error; // Re-llançar per a debugging
    }
  }

  /**
   * Obté les dades completes del job incloent la generació associada
   */
  private async getJobData(jobId: string) {
    console.log(`[Worker] Carregant dades del job: ${jobId}`);
    const { data: job, error } = await supabaseAdmin
      .from('generation_jobs')
      .select(`
        *,
        generation:generations(
          id,
          template_document_path,
          template_placeholders,
          row_data,
          project_id
        )
      `)
      .eq('id', jobId)
      .single();

    if (error) {
      throw new Error(`Error obtenint dades del job: ${error.message}`);
    }

    if (!job.generation) {
      throw new Error(`No s'ha trobat la generació associada al job ${jobId}`);
    }

    return job;
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
  private async generateAiContent(placeholderConfig: any, excelData: any): Promise<string> {
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
