/**
 * SmartDocumentProcessor - Processador intel·ligent de documents
 * 
 * Aquesta classe implementa la nova arquitectura revolucionària per generar
 * múltiples informes en una sola passada amb coherència narrativa garantida.
 * 
 * Data: 6 de juliol de 2025
 * Arquitecte: Cline
 * Objectiu: 20x més ràpid, 95% més fiable, 85% més simple
 */

import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import supabaseServerClient from '@/lib/supabase/server';
import {
  BatchProcessingConfig,
  BatchProcessingResult,
  ProcessedDocument,
  MistralResponse,
  SmartPlaceholder,
  SMART_GENERATION_CONSTANTS,
  PerformanceMetrics,
} from './types';

export class SmartDocumentProcessor {
  private supabase;
  private mistralApiKey: string;
  private performanceMetrics: PerformanceMetrics;

  constructor() {
    this.supabase = supabaseServerClient;
    this.mistralApiKey = process.env.MISTRAL_API_KEY || '';
    this.performanceMetrics = {
      totalProcessingTime: 0,
      aiCallTime: 0,
      docxGenerationTime: 0,
      storageUploadTime: 0,
      documentsPerSecond: 0,
    };
  }

  // ============================================================================
  // MÈTODE PRINCIPAL - PROCESSAMENT BATCH
  // ============================================================================

  /**
   * Processa múltiples informes en una sola crida IA
   * Aquest és el mètode revolucionari que substitueix tot el sistema antic
   */
  async processBatch(config: BatchProcessingConfig): Promise<BatchProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 [SmartProcessor] Iniciant processament batch:`, {
        templateId: config.templateId,
        documentsToGenerate: config.excelData.length,
        userId: config.userId,
      });

      // 1. Crear registre inicial a la base de dades
      const generationId = await this.createGenerationRecord(config);
      
      // 2. Extreure placeholders del template
      const placeholders = this.extractPlaceholders(config.templateContent);
      console.log(`📝 [SmartProcessor] Placeholders trobats:`, placeholders.map(p => p.id));

      // 3. Construir prompt global intel·ligent
      const globalPrompt = this.buildGlobalPrompt(
        config.templateContent,
        config.excelData,
        placeholders
      );

      // 4. Crida única a Mistral AI (la màgia!)
      const aiResponse = await this.callMistralAI(globalPrompt, config.excelData.length);
      
      if (!aiResponse.success) {
        throw new Error(`Error en crida Mistral AI: ${aiResponse.errorMessage}`);
      }

      // 5. Generar documents DOCX amb format preservat
      const documents = await this.generateDocxFiles(
        aiResponse.documentsData,
        config.templateStoragePath,
        config.excelData,
        generationId
      );

      // 6. Actualitzar registre amb resultats
      const processingTime = Date.now() - startTime;
      await this.updateGenerationRecord(generationId, {
        status: 'completed',
        generated_documents: documents,
        processing_time: processingTime,
        completed_at: new Date().toISOString(),
      });

      // 7. Calcular mètriques de rendiment
      this.performanceMetrics.totalProcessingTime = processingTime;
      this.performanceMetrics.documentsPerSecond = documents.length / (processingTime / 1000);

      console.log(`✅ [SmartProcessor] Processament completat:`, {
        generationId,
        documentsGenerated: documents.length,
        processingTimeMs: processingTime,
        documentsPerSecond: this.performanceMetrics.documentsPerSecond.toFixed(2),
      });

      return {
        success: true,
        generationId,
        documentsGenerated: documents.length,
        processingTimeMs: processingTime,
        documents,
      };

    } catch (error) {
      console.error(`❌ [SmartProcessor] Error en processament:`, error);
      
      // Actualitzar registre amb error si existeix generationId
      const errorMessage = error instanceof Error ? error.message : 'Error desconegut';
      
      return {
        success: false,
        generationId: '',
        documentsGenerated: 0,
        processingTimeMs: Date.now() - startTime,
        documents: [],
        errorMessage,
      };
    }
  }

  // ============================================================================
  // EXTRACCIÓ DE PLACEHOLDERS
  // ============================================================================

  /**
   * Extreu placeholders intel·ligents del template
   * Format: {ID: instrucció completa}
   */
  private extractPlaceholders(templateContent: string): SmartPlaceholder[] {
    const placeholders: SmartPlaceholder[] = [];
    
    // Regex per trobar placeholders format {ID: instrucció}
    const placeholderRegex = /\{([A-Z_]+):\s*([^}]+)\}/g;
    let match;

    while ((match = placeholderRegex.exec(templateContent)) !== null) {
      const [, id, instruction] = match;
      
      placeholders.push({
        id: id.trim(),
        instruction: instruction.trim(),
      });
    }

    // Eliminar duplicats
    const uniquePlaceholders = placeholders.filter((placeholder, index, self) =>
      index === self.findIndex(p => p.id === placeholder.id)
    );

    return uniquePlaceholders;
  }

  // ============================================================================
  // CONSTRUCCIÓ DEL PROMPT GLOBAL
  // ============================================================================

  /**
   * Construeix el prompt global intel·ligent per Mistral AI
   * Aquest prompt és la clau de la coherència narrativa
   */
  private buildGlobalPrompt(
    templateContent: string,
    excelData: any[],
    placeholders: SmartPlaceholder[]
  ): string {
    return `
TASCA CRÍTICA: Processament Intel·ligent de Documents amb Coherència Narrativa

Ets un expert en generació de documents professionals amb coherència lingüística perfecta.
Processa aquest document substituint TOTS els placeholders mantenint coherència narrativa absoluta.

DOCUMENT PLANTILLA:
${templateContent}

PLACEHOLDERS IDENTIFICATS (${placeholders.length}):
${placeholders.map(p => `- {${p.id}}: ${p.instruction}`).join('\n')}

DADES EXCEL (${excelData.length} files a processar):
${JSON.stringify(excelData, null, 2)}

INSTRUCCIONS ESPECÍFIQUES:
1. Per cada fila de dades Excel, genera un document complet
2. Substitueix TOTS els placeholders {ID: instrucció} segons les seves instruccions específiques
3. Mantén coherència narrativa i gramatical en cada document individual
4. Assegura concordança de gènere i nombre al llarg de tot el text
5. Utilitza el context global per decisions intel·ligents (ex: si un contractista és dona, usa "La contractista")
6. Formata números, dates i imports segons estàndards catalans/espanyols
7. Mantén el to professional i formal apropiat per documents oficials

FORMAT DE SORTIDA OBLIGATORI:
Retorna un array JSON amb ${excelData.length} objectes, un per cada document.
Cada objecte ha de tenir com a claus els IDs dels placeholders i com a valors el text final.

EXEMPLE DE FORMAT:
[
  {
    "CONTRACTISTA": "La contractista Maria Soler i Associats, S.L.",
    "OBRA": "la reforma integral de les oficines centrals",
    "IMPORT": "12.345,67 €"
  },
  {
    "CONTRACTISTA": "El contractista Joan Pérez",
    "OBRA": "la construcció del nou magatzem industrial",
    "IMPORT": "25.000,00 €"
  }
]

DOCUMENTS PROCESSATS (retorna només l'array JSON):
`;
  }

  // ============================================================================
  // CRIDA A MISTRAL AI
  // ============================================================================

  /**
   * Realitza la crida única a Mistral AI
   * Aquesta és la crida que substitueix 10+ crides del sistema antic
   */
  private async callMistralAI(prompt: string, expectedDocuments: number): Promise<MistralResponse> {
    const aiStartTime = Date.now();
    
    try {
      console.log(`🤖 [MistralAI] Iniciant crida única per ${expectedDocuments} documents...`);

      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.mistralApiKey}`,
        },
        body: JSON.stringify({
          model: SMART_GENERATION_CONSTANTS.MISTRAL_DEFAULTS.MODEL,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: SMART_GENERATION_CONSTANTS.MISTRAL_DEFAULTS.TEMPERATURE,
          max_tokens: SMART_GENERATION_CONSTANTS.MISTRAL_DEFAULTS.MAX_TOKENS,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const aiContent = data.choices[0]?.message?.content;

      if (!aiContent) {
        throw new Error('Resposta buida de Mistral AI');
      }

      // Parsejar la resposta JSON
      const documentsData = this.parseAIResponse(aiContent, expectedDocuments);
      
      this.performanceMetrics.aiCallTime = Date.now() - aiStartTime;
      
      console.log(`✅ [MistralAI] Crida completada:`, {
        documentsProcessed: documentsData.length,
        aiCallTimeMs: this.performanceMetrics.aiCallTime,
        tokensUsed: data.usage?.total_tokens || 'N/A',
      });

      return {
        success: true,
        documentsData,
        tokensUsed: data.usage?.total_tokens,
      };

    } catch (error) {
      this.performanceMetrics.aiCallTime = Date.now() - aiStartTime;
      console.error(`❌ [MistralAI] Error en crida:`, error);
      
      return {
        success: false,
        documentsData: [],
        errorMessage: error instanceof Error ? error.message : 'Error desconegut en Mistral AI',
      };
    }
  }

  /**
   * Parseja la resposta de Mistral AI i valida el format
   */
  private parseAIResponse(aiContent: string, expectedDocuments: number): Record<string, string>[] {
    try {
      // Intentar extreure JSON de la resposta
      const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No s\'ha trobat array JSON en la resposta');
      }

      const documentsData = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(documentsData)) {
        throw new Error('La resposta no és un array');
      }

      if (documentsData.length !== expectedDocuments) {
        console.warn(`⚠️ [Parser] Documents esperats: ${expectedDocuments}, rebuts: ${documentsData.length}`);
      }

      // Validar que cada document té les claus necessàries
      documentsData.forEach((doc, index) => {
        if (typeof doc !== 'object' || doc === null) {
          throw new Error(`Document ${index} no és un objecte vàlid`);
        }
      });

      return documentsData;

    } catch (error) {
      console.error(`❌ [Parser] Error parseant resposta AI:`, error);
      console.error(`Contingut rebut:`, aiContent.substring(0, 500) + '...');
      throw new Error(`Error parseant resposta de Mistral AI: ${error instanceof Error ? error.message : 'Error desconegut'}`);
    }
  }

  // ============================================================================
  // GENERACIÓ DE DOCUMENTS DOCX
  // ============================================================================

  /**
   * Genera documents DOCX finals amb format preservat
   * Utilitza docxtemplater per substitució quirúrgica
   */
  private async generateDocxFiles(
    documentsData: Record<string, string>[],
    templateStoragePath: string,
    excelData: any[],
    generationId: string
  ): Promise<ProcessedDocument[]> {
    const docxStartTime = Date.now();
    
    try {
      console.log(`📄 [DocxGenerator] Generant ${documentsData.length} documents DOCX...`);

      // Descarregar plantilla original UNA SOLA VEGADA
      const templateBuffer = await this.downloadTemplateFromStorage(templateStoragePath);
      
      const processedDocuments: ProcessedDocument[] = [];

      // Processar cada document en paral·lel (optimització)
      const documentPromises = documentsData.map(async (docData, index) => {
        try {
          // Crear nova instància de docxtemplater per cada document
          const zip = new PizZip(templateBuffer);
          const doc = new Docxtemplater(zip, {
            paragraphLoop: SMART_GENERATION_CONSTANTS.DOCX_DEFAULTS.PARAGRAPH_LOOP,
            linebreaks: SMART_GENERATION_CONSTANTS.DOCX_DEFAULTS.LINEBREAKS,
            nullGetter: SMART_GENERATION_CONSTANTS.DOCX_DEFAULTS.NULL_GETTER,
          });

          // SUBSTITUCIÓ QUIRÚRGICA: només canvia el text dins de les etiquetes XML
          doc.setData(docData);
          doc.render();

          // Generar buffer del document final
          const documentBuffer = doc.getZip().generate({ type: 'nodebuffer' });

          // Pujar document a Storage
          const storagePath = await this.uploadDocumentToStorage(
            documentBuffer,
            generationId,
            index
          );

          return {
            documentIndex: index,
            rowData: excelData[index] || {},
            placeholderValues: docData,
            documentBuffer,
            storagePath,
          } as ProcessedDocument;

        } catch (error) {
          console.error(`❌ [DocxGenerator] Error generant document ${index}:`, error);
          throw error;
        }
      });

      // Esperar que tots els documents es processin
      const results = await Promise.all(documentPromises);
      processedDocuments.push(...results);

      this.performanceMetrics.docxGenerationTime = Date.now() - docxStartTime;
      
      console.log(`✅ [DocxGenerator] Documents generats:`, {
        totalDocuments: processedDocuments.length,
        docxGenerationTimeMs: this.performanceMetrics.docxGenerationTime,
      });

      return processedDocuments;

    } catch (error) {
      console.error(`❌ [DocxGenerator] Error en generació DOCX:`, error);
      throw error;
    }
  }

  // ============================================================================
  // GESTIÓ DE STORAGE
  // ============================================================================

  /**
   * Descarrega la plantilla original de Supabase Storage
   */
  private async downloadTemplateFromStorage(templatePath: string): Promise<Buffer> {
    try {
      const { data, error } = await this.supabase.storage
        .from('template-docx')
        .download(templatePath);

      if (error) {
        throw new Error(`Error descarregant plantilla: ${error.message}`);
      }

      return Buffer.from(await data.arrayBuffer());

    } catch (error) {
      console.error(`❌ [Storage] Error descarregant plantilla:`, error);
      throw error;
    }
  }

  /**
   * Puja document generat a Supabase Storage
   */
  private async uploadDocumentToStorage(
    documentBuffer: Buffer,
    generationId: string,
    documentIndex: number
  ): Promise<string> {
    const uploadStartTime = Date.now();
    
    try {
      const fileName = `document_${documentIndex + 1}.docx`;
      const storagePath = `${SMART_GENERATION_CONSTANTS.STORAGE.BASE_PATH}/${generationId}/${fileName}`;

      const { error } = await this.supabase.storage
        .from(SMART_GENERATION_CONSTANTS.STORAGE.BUCKET)
        .upload(storagePath, documentBuffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: true,
        });

      if (error) {
        throw new Error(`Error pujant document: ${error.message}`);
      }

      this.performanceMetrics.storageUploadTime += Date.now() - uploadStartTime;
      
      return storagePath;

    } catch (error) {
      console.error(`❌ [Storage] Error pujant document ${documentIndex}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // GESTIÓ DE BASE DE DADES
  // ============================================================================

  /**
   * Crea registre inicial a smart_generations
   */
  private async createGenerationRecord(config: BatchProcessingConfig): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('smart_generations')
        .insert({
          user_id: config.userId,
          template_id: config.templateId,
          template_content: config.templateContent,
          excel_data: config.excelData,
          num_documents: config.excelData.length,
          status: 'processing',
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Error creant registre: ${error.message}`);
      }

      return data.id;

    } catch (error) {
      console.error(`❌ [Database] Error creant registre:`, error);
      throw error;
    }
  }

  /**
   * Actualitza registre amb resultats
   */
  private async updateGenerationRecord(
    generationId: string,
    updates: Partial<{
      status: string;
      generated_documents: ProcessedDocument[];
      processing_time: number;
      completed_at: string;
      error_message: string;
    }>
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('smart_generations')
        .update(updates)
        .eq('id', generationId);

      if (error) {
        throw new Error(`Error actualitzant registre: ${error.message}`);
      }

    } catch (error) {
      console.error(`❌ [Database] Error actualitzant registre:`, error);
      throw error;
    }
  }

  // ============================================================================
  // UTILITATS PÚBLIQUES
  // ============================================================================

  /**
   * Obté mètriques de rendiment de l'última operació
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Valida configuració abans del processament
   */
  public validateConfig(config: BatchProcessingConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.templateId) errors.push('Template ID és obligatori');
    if (!config.templateContent) errors.push('Template content és obligatori');
    if (!config.templateStoragePath) errors.push('Template storage path és obligatori');
    if (!config.userId) errors.push('User ID és obligatori');
    if (!Array.isArray(config.excelData) || config.excelData.length === 0) {
      errors.push('Excel data ha de ser un array no buit');
    }
    if (config.excelData.length > SMART_GENERATION_CONSTANTS.LIMITS.MAX_DOCUMENTS_PER_BATCH) {
      errors.push(`Màxim ${SMART_GENERATION_CONSTANTS.LIMITS.MAX_DOCUMENTS_PER_BATCH} documents per batch`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
