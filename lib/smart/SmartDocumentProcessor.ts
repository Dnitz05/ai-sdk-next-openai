/**
 * SmartDocumentProcessor - Processador SIMPLE de documents
 * 
 * REFACTORITZACIÓ TOTAL: Sistema simplificat que usa placeholders estàndard {{PLACEHOLDER}}
 * Elimina completament la complexitat legacy de JSON embebits i paragraphId
 * 
 * Data: 7 d'agost de 2025
 * Arquitecte: Cline
 * Objectiu: 100% fiable, ultra-simple, rendiment màxim
 */

import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import supabaseServerClient from '@/lib/supabase/server';
import { withTimeout } from '@/lib/utils/timeout';

// ============================================================================
// INTERFACES SIMPLIFICADES
// ============================================================================

export interface SimpleProcessingResult {
  success: boolean;
  generationId: string;
  documentsGenerated: number;
  processingTimeMs: number;
  documentBuffer?: Buffer;
  errorMessage?: string;
}

export interface PerformanceMetrics {
  totalProcessingTime: number;
  docxGenerationTime: number;
  storageDownloadTime: number;
  documentsPerSecond: number;
}

// ============================================================================
// CLASSE PRINCIPAL SIMPLIFICADA
// ============================================================================

export class SmartDocumentProcessor {
  private supabase;
  private performanceMetrics: PerformanceMetrics;

  constructor() {
    this.supabase = supabaseServerClient;
    this.performanceMetrics = {
      totalProcessingTime: 0,
      docxGenerationTime: 0,
      storageDownloadTime: 0,
      documentsPerSecond: 0,
    };
  }

  // ============================================================================
  // MÈTODE PRINCIPAL - PROCESSAMENT SIMPLE
  // ============================================================================

  /**
   * Processa un únic document amb placeholders simples {{PLACEHOLDER}}
   * ELIMINAT: Tot el sistema complex de IA, JSON embebits, paragraphId
   * AFEGIT: Mapeo directe Excel → Placeholders
   */
  async processSingle(
    templateContent: string,
    templateStoragePath: string,
    rowData: any,
    templateId: string,
    userId: string
  ): Promise<SimpleProcessingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 [SmartProcessor-Simple] Iniciant processament ultra-simple`);
      console.log(`📊 [SmartProcessor-Simple] Dades Excel rebudes:`, Object.keys(rowData));

      // 1. Descarregar plantilla DOCX
      const templateBuffer = await this.downloadTemplateFromStorage(templateStoragePath);
      
      // 2. Preparar dades per substitució directa
      const templateData = this.prepareTemplateData(rowData);
      console.log(`📝 [SmartProcessor-Simple] Placeholders preparats:`, Object.keys(templateData));

      // 3. Aplicar substitucions amb docxtemplater
      const documentBuffer = await this.generateSimpleDocx(templateBuffer, templateData);

      // 4. Calcular mètriques
      const processingTime = Date.now() - startTime;
      this.performanceMetrics.totalProcessingTime = processingTime;
      this.performanceMetrics.documentsPerSecond = 1 / (processingTime / 1000);

      console.log(`✅ [SmartProcessor-Simple] Document generat en ${processingTime}ms`);

      return {
        success: true,
        generationId: `simple_${Date.now()}`,
        documentsGenerated: 1,
        processingTimeMs: processingTime,
        documentBuffer,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconegut';
      console.error(`❌ [SmartProcessor-Simple] Error: ${errorMessage}`, error);
      
      return {
        success: false,
        generationId: '',
        documentsGenerated: 0,
        processingTimeMs: Date.now() - startTime,
        errorMessage,
      };
    }
  }

  // ============================================================================
  // PREPARACIÓ DE DADES SIMPLE
  // ============================================================================

  /**
   * Prepara les dades Excel per substitució directa en placeholders {{PLACEHOLDER}}
   * Mapeja headers Excel a placeholders estàndard
   */
  private prepareTemplateData(rowData: any): Record<string, string> {
    const templateData: Record<string, string> = {};
    
    try {
      // Mapejar directament les dades Excel
      Object.keys(rowData).forEach(key => {
        const value = rowData[key];
        
        // Convertir clau a format placeholder estàndard
        const placeholder = key.toUpperCase().replace(/\s+/g, '_');
        templateData[placeholder] = this.formatValue(value);
        
        // També mantenir la clau original per compatibilitat
        templateData[key] = this.formatValue(value);
      });
      
      // Afegir dades calculades comunes
      templateData['DATA_ACTUAL'] = new Date().toLocaleDateString('ca-ES');
      templateData['ANY_ACTUAL'] = new Date().getFullYear().toString();
      templateData['MES_ACTUAL'] = (new Date().getMonth() + 1).toString().padStart(2, '0');
      templateData['DIA_ACTUAL'] = new Date().getDate().toString().padStart(2, '0');
      
      console.log(`📋 [PrepareData] ${Object.keys(templateData).length} placeholders preparats`);
      
      return templateData;
      
    } catch (error) {
      console.error(`❌ [PrepareData] Error preparant dades:`, error);
      throw new Error(`Error preparant dades per plantilla: ${error instanceof Error ? error.message : 'Error desconegut'}`);
    }
  }

  /**
   * Formata un valor per inserció en el document
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    // Si és un número, formatear segons estàndards catalans
    if (typeof value === 'number') {
      return value.toLocaleString('ca-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    
    // Si és una data, formatear
    if (value instanceof Date) {
      return value.toLocaleDateString('ca-ES');
    }
    
    // Convertir a string i netejar
    return String(value).trim();
  }

  // ============================================================================
  // GENERACIÓ DOCX SIMPLE
  // ============================================================================

  /**
   * Genera document DOCX amb substitució directa de placeholders
   * USA: docxtemplater estàndard amb placeholders {{PLACEHOLDER}}
   * ELIMINA: Tot el sistema complex de parsing JSON
   */
  private async generateSimpleDocx(
    templateBuffer: Buffer,
    templateData: Record<string, string>
  ): Promise<Buffer> {
    const docxStartTime = Date.now();
    
    try {
      console.log(`📄 [DocxGenerator-Simple] Generant document amb ${Object.keys(templateData).length} substitucions...`);

      // Crear instància de docxtemplater amb configuració simple
      const zip = new PizZip(templateBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => '', // Retornar string buit per placeholders no trobats
        errorLogging: false, // Desactivar logging d'errors per simplicitat
      });

      // Aplicar substitucions directes
      doc.setData(templateData);
      doc.render();

      // Generar buffer del document final
      const documentBuffer = doc.getZip().generate({ type: 'nodebuffer' });
      
      this.performanceMetrics.docxGenerationTime = Date.now() - docxStartTime;
      
      console.log(`✅ [DocxGenerator-Simple] Document generat en ${this.performanceMetrics.docxGenerationTime}ms`);

      return documentBuffer;

    } catch (error) {
      console.error(`❌ [DocxGenerator-Simple] Error generant document:`, error);
      
      // Si és un error de docxtemplater, proporcionar informació útil
      if (error instanceof Error && 'properties' in error) {
        const docxError = error as any;
        console.error(`❌ [DocxGenerator-Simple] Error detallat:`, {
          message: docxError.message,
          properties: docxError.properties,
        });
      }
      
      throw new Error(`Error generant document DOCX: ${error instanceof Error ? error.message : 'Error desconegut'}`);
    }
  }

  // ============================================================================
  // GESTIÓ DE STORAGE SIMPLIFICADA
  // ============================================================================

  /**
   * Descarrega la plantilla original de Supabase Storage
   */
  private async downloadTemplateFromStorage(templatePath: string): Promise<Buffer> {
    const downloadStartTime = Date.now();
    const STORAGE_TIMEOUT_MS = 30000; // 30 segons de timeout

    const downloadOperation = async () => {
      console.log(`📥 [Storage] Descarregant plantilla: ${templatePath}`);
      
      const { data, error } = await this.supabase.storage
        .from('template-docx')
        .download(templatePath);

      if (error) {
        throw new Error(`Error descarregant plantilla de Storage: ${error.message}`);
      }
      
      if (!data) {
        throw new Error('No s\'han rebut dades de la plantilla de Storage');
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      console.log(`✅ [Storage] Plantilla descarregada: ${buffer.length} bytes`);
      
      return buffer;
    };

    try {
      const timeoutMessage = `Timeout de descàrrega de plantilla '${templatePath}' després de ${STORAGE_TIMEOUT_MS / 1000} segons`;
      const buffer = await withTimeout(downloadOperation(), STORAGE_TIMEOUT_MS, timeoutMessage);
      
      this.performanceMetrics.storageDownloadTime = Date.now() - downloadStartTime;
      
      return buffer;
      
    } catch (error) {
      console.error(`❌ [Storage] Error en la descàrrega de la plantilla:`, error);
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
   * Valida que les dades Excel són vàlides per processament
   */
  public validateExcelData(rowData: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!rowData || typeof rowData !== 'object') {
      errors.push('Les dades Excel han de ser un objecte vàlid');
    } else {
      const keys = Object.keys(rowData);
      if (keys.length === 0) {
        errors.push('Les dades Excel no poden estar buides');
      }
      
      // Verificar que hi ha almenys algunes dades útils
      const hasValidData = keys.some(key => {
        const value = rowData[key];
        return value !== null && value !== undefined && String(value).trim() !== '';
      });
      
      if (!hasValidData) {
        errors.push('Les dades Excel han de contenir almenys un valor vàlid');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Extreu placeholders del contingut de la plantilla (per debug)
   */
  public extractPlaceholdersFromTemplate(templateContent: string): string[] {
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const placeholders: string[] = [];
    let match;

    while ((match = placeholderRegex.exec(templateContent)) !== null) {
      const placeholder = match[1].trim();
      if (!placeholders.includes(placeholder)) {
        placeholders.push(placeholder);
      }
    }

    return placeholders;
  }
}
