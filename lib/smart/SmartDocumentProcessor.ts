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
      console.log(`🚀 [TIMING] ========== PROCESSAMENT INICIAT ==========`);
      console.log(`🚀 [TIMING] Hora d'inici: ${new Date().toISOString()}`);
      console.log(`📊 [TIMING] Dades Excel rebudes: ${Object.keys(rowData).length} camps`);
      console.log(`📊 [TIMING] Camps Excel:`, Object.keys(rowData));

      // 1. Descarregar plantilla DOCX - AMB TIMING DETALLAT
      console.log(`📥 [TIMING] ========== INICI DESCÀRREGA PLANTILLA ==========`);
      const downloadStartTime = Date.now();
      const templateBuffer = await this.downloadTemplateFromStorage(templateStoragePath);
      const downloadEndTime = Date.now();
      const downloadTime = downloadEndTime - downloadStartTime;
      console.log(`📥 [TIMING] Descàrrega completada en: ${downloadTime}ms`);
      console.log(`📥 [TIMING] Mida del buffer de plantilla: ${templateBuffer.length} bytes (${(templateBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
      
      // 2. Preparar dades per substitució directa - AMB TIMING DETALLAT
      console.log(`📝 [TIMING] ========== INICI PREPARACIÓ DADES ==========`);
      const prepareStartTime = Date.now();
      const templateData = this.prepareTemplateData(rowData);
      const prepareEndTime = Date.now();
      const prepareTime = prepareEndTime - prepareStartTime;
      console.log(`📝 [TIMING] Preparació dades completada en: ${prepareTime}ms`);
      console.log(`📝 [TIMING] Nombre de placeholders preparats: ${Object.keys(templateData).length}`);
      console.log(`📝 [TIMING] Placeholders:`, Object.keys(templateData));

      // 3. Aplicar substitucions amb docxtemplater - AMB TIMING DETALLAT
      console.log(`📄 [TIMING] ========== INICI GENERACIÓ DOCX ==========`);
      const docxStartTime = Date.now();
      const documentBuffer = await this.generateSimpleDocx(templateBuffer, templateData);
      const docxEndTime = Date.now();
      const docxTime = docxEndTime - docxStartTime;
      console.log(`📄 [TIMING] Generació DOCX completada en: ${docxTime}ms`);
      console.log(`📄 [TIMING] Mida del document generat: ${documentBuffer.length} bytes (${(documentBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

      // 4. Calcular mètriques DETALLADES
      const processingTime = Date.now() - startTime;
      this.performanceMetrics.totalProcessingTime = processingTime;
      this.performanceMetrics.documentsPerSecond = 1 / (processingTime / 1000);

      // RESUM FINAL DE TIMING
      console.log(`✅ [TIMING] ========== PROCESSAMENT COMPLETAT ==========`);
      console.log(`✅ [TIMING] Temps total: ${processingTime}ms`);
      console.log(`✅ [TIMING] Breakdown detallat:`);
      console.log(`   📥 Descàrrega plantilla: ${downloadTime}ms (${((downloadTime / processingTime) * 100).toFixed(1)}%)`);
      console.log(`   📝 Preparació dades: ${prepareTime}ms (${((prepareTime / processingTime) * 100).toFixed(1)}%)`);
      console.log(`   📄 Generació DOCX: ${docxTime}ms (${((docxTime / processingTime) * 100).toFixed(1)}%)`);
      console.log(`   🔧 Overhead/altres: ${processingTime - downloadTime - prepareTime - docxTime}ms`);
      console.log(`✅ [TIMING] Documents per segon: ${this.performanceMetrics.documentsPerSecond.toFixed(2)}`);

      return {
        success: true,
        generationId: `simple_${Date.now()}`,
        documentsGenerated: 1,
        processingTimeMs: processingTime,
        documentBuffer,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconegut';
      const totalTime = Date.now() - startTime;
      console.error(`❌ [TIMING] ========== ERROR EN PROCESSAMENT ==========`);
      console.error(`❌ [TIMING] Error després de: ${totalTime}ms`);
      console.error(`❌ [TIMING] Missatge d'error: ${errorMessage}`);
      console.error(`❌ [TIMING] Stack trace:`, error);
      
      return {
        success: false,
        generationId: '',
        documentsGenerated: 0,
        processingTimeMs: totalTime,
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
   * INCLOU: Preprocessador robust per netejar placeholders trencats per edició
   */
  private async generateSimpleDocx(
    templateBuffer: Buffer,
    templateData: Record<string, string>
  ): Promise<Buffer> {
    const docxStartTime = Date.now();
    
    try {
      console.log(`📄 [DocxGenerator-Simple] Generant document amb ${Object.keys(templateData).length} substitucions...`);

      // FASE 1: Preprocessar per netejar placeholders trencats
      const cleanedBuffer = await this.cleanBrokenPlaceholders(templateBuffer);

      // FASE 2: Crear instància de docxtemplater amb configuració simple
      const zip = new PizZip(cleanedBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => '', // Retornar string buit per placeholders no trobats
        errorLogging: false, // Desactivar logging d'errors per simplicitat
      });

      // FASE 3: Aplicar substitucions directes
      doc.setData(templateData);
      doc.render();

      // FASE 4: Generar buffer del document final
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

  /**
   * Preprocessador ultra-robust per netejar placeholders trencats per edició manual
   * Soluciona el problema quan Word divideix placeholders en múltiples nodes XML
   * VERSIÓ MILLORADA: Gestiona casos específics com "{{NOM_" i "NOM_}}"
   */
  private async cleanBrokenPlaceholders(templateBuffer: Buffer): Promise<Buffer> {
    const cleaningStartTime = Date.now();
    
    try {
      console.log(`🧹 [TIMING] ========== INICI NETEJA PLACEHOLDERS ==========`);
      console.log(`🧹 [TIMING] Hora d'inici neteja: ${new Date().toISOString()}`);
      
      const zip = new PizZip(templateBuffer);
      let content = zip.file('word/document.xml')?.asText() || '';
      
      if (!content) {
        console.warn(`⚠️ [TIMING] No s'ha trobat document.xml - retornant buffer original`);
        return templateBuffer;
      }
      
      // Guardar l'original per comparació
      const originalContent = content;
      const originalLength = content.length;
      
      console.log(`📊 [TIMING] Document original: ${originalLength} caràcters (${(originalLength / 1024).toFixed(2)} KB)`);
      
      // FASE 1: Detectar i mostrar tots els fragments de placeholders
      const detectionStartTime = Date.now();
      const brokenPlaceholderFragments = content.match(/\{\{[^}]*|[^{]*\}\}/g) || [];
      const detectionTime = Date.now() - detectionStartTime;
      console.log(`🔍 [TIMING] Detecció fragments: ${detectionTime}ms - ${brokenPlaceholderFragments.length} fragments trobats`);
      
      // FASE 2: Neteja ultra-agressiva iterativa
      const iterationStartTime = Date.now();
      let iterations = 0;
      let previousContent = '';
      const maxIterations = 20;
      
      console.log(`🔄 [TIMING] Iniciant bucle de neteja (màxim ${maxIterations} iteracions)`);
      
      while (iterations < maxIterations && content !== previousContent) {
        const iterStartTime = Date.now();
        previousContent = content;
        const contentLengthBefore = content.length;
        
        // 2.1: Eliminar TOTS els tags XML dins de qualsevol cosa que sembli un placeholder
        const xmlMatches = content.match(/(\{\{[^}]*?)(<[^>]*>)+([^}]*?\}\})/g) || [];
        content = content.replace(
          /(\{\{[^}]*?)(<[^>]*>)+([^}]*?\}\})/g,
          (match, start, xmlTags, end) => {
            const cleaned = start + end;
            return cleaned;
          }
        );
        
        // 2.2: Reunificar placeholders dividits per tags de format
        const closeTagMatches = content.match(/(\{\{[^}]*?)(<\/[^>]*>)([^}]*?\}\})/g) || [];
        content = content.replace(
          /(\{\{[^}]*?)(<\/[^>]*>)([^}]*?\}\})/g,
          (match, start, closeTag, end) => {
            const cleaned = start + end;
            return cleaned;
          }
        );
        
        // 2.3: Netejar tags d'obertura dins de placeholders
        const openTagMatches = content.match(/(\{\{[^}]*?)(<[^>]*>)([^}]*?\}\})/g) || [];
        content = content.replace(
          /(\{\{[^}]*?)(<[^>]*>)([^}]*?\}\})/g,
          (match, start, openTag, end) => {
            const cleaned = start + end;
            return cleaned;
          }
        );
        
        // 2.4: Eliminar text embebut entre tags dins de placeholders
        const embeddedMatches = content.match(/(\{\{[^}]*?)(<[^>]*>[^<]*<\/[^>]*>)+([^}]*?\}\})/g) || [];
        content = content.replace(
          /(\{\{[^}]*?)(<[^>]*>[^<]*<\/[^>]*>)+([^}]*?\}\})/g,
          (match, start, xmlContent, end) => {
            // Extreure només el text, eliminant tots els tags
            const textOnly = xmlContent.replace(/<[^>]*>/g, '');
            const cleaned = start + textOnly + end;
            return cleaned;
          }
        );
        
        // 2.5: Casos específics problemàtics detectats als logs
        // Arreglar "{{NOM_" sense tancament
        const incompleteOpen = content.match(/\{\{([A-Z_]+)(?!.*\}\})/g) || [];
        content = content.replace(/\{\{([A-Z_]+)(?!.*\}\})/g, '{{$1}}');
        
        // Arreglar "NOM_}}" sense obertura
        const incompleteClose = content.match(/(?<!\{\{.*)([A-Z_]+)\}\}/g) || [];
        content = content.replace(/(?<!\{\{.*)([A-Z_]+)\}\}/g, '{{$1}}');
        
        // 2.6: Eliminar duplicacions de claus
        const doubleBraces = content.match(/\{\{\{\{|\}\}\}\}/g) || [];
        content = content.replace(/\{\{\{\{/g, '{{');
        content = content.replace(/\}\}\}\}/g, '}}');
        
        const iterTime = Date.now() - iterStartTime;
        const contentLengthAfter = content.length;
        const bytesChanged = Math.abs(contentLengthAfter - contentLengthBefore);
        
        console.log(`🔄 [TIMING] Iteració ${iterations + 1}: ${iterTime}ms`);
        console.log(`   📊 Canvis: ${bytesChanged} bytes, ${xmlMatches.length + closeTagMatches.length + openTagMatches.length + embeddedMatches.length + incompleteOpen.length + incompleteClose.length + doubleBraces.length} patrons corregits`);
        
        iterations++;
      }
      
      const totalIterationTime = Date.now() - iterationStartTime;
      console.log(`🔄 [TIMING] Bucle completat: ${iterations} iteracions en ${totalIterationTime}ms (${(totalIterationTime / iterations).toFixed(1)}ms/iteració)`);
      
      if (iterations >= maxIterations) {
        console.warn(`⚠️ [TIMING] ATENCIÓ: S'ha arribat al màxim d'iteracions (${maxIterations}) - possible bucle infinit evitat`);
      }
      
      // FASE 3: Neteja final de format
      const finalCleaningStartTime = Date.now();
      console.log(`🧽 [TIMING] ========== INICI NETEJA FINAL ==========`);
      
      // 3.1: Eliminar espais extra dins placeholders
      const spacesMatches = content.match(/\{\{\s*([^}]+?)\s*\}\}/g) || [];
      content = content.replace(/\{\{\s*([^}]+?)\s*\}\}/g, '{{$1}}');
      
      // 3.2: Normalitzar noms de placeholders
      const normalizationMatches = content.match(/\{\{([^}]+)\}\}/g) || [];
      content = content.replace(/\{\{([^}]+)\}\}/g, (match, placeholder) => {
        const normalized = placeholder.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        if (normalized !== placeholder) {
          console.log(`🔧 [Normalize] ${placeholder} → ${normalized}`);
        }
        return `{{${normalized}}}`;
      });
      
      const finalCleaningTime = Date.now() - finalCleaningStartTime;
      console.log(`🧽 [TIMING] Neteja final completada en: ${finalCleaningTime}ms`);
      console.log(`   📊 Espais corregits: ${spacesMatches.length}, Normalitzacions: ${normalizationMatches.length}`);
      
      // FASE 4: Validació exhaustiva
      const validationStartTime = Date.now();
      const finalPlaceholders = content.match(/\{\{[^}]+\}\}/g) || [];
      const cleanedCount = finalPlaceholders.length;
      
      console.log(`📊 [TIMING] Validació: ${Date.now() - validationStartTime}ms - ${cleanedCount} placeholders finals`);
      
      // Mostrar tots els placeholders trobats (només si són pocs per evitar spam)
      if (finalPlaceholders.length > 0 && finalPlaceholders.length <= 20) {
        console.log(`📝 [TIMING] Placeholders detectats:`);
        finalPlaceholders.forEach((placeholder, idx) => {
          console.log(`  ${idx + 1}. ${placeholder}`);
        });
      } else if (finalPlaceholders.length > 20) {
        console.log(`📝 [TIMING] ${finalPlaceholders.length} placeholders detectats (massa per mostrar tots)`);
      }
      
      // FASE 5: Detectar problemes residuals
      const problemDetectionStartTime = Date.now();
      const problematicPatterns = [
        { pattern: /\{\{[^}]*\{\{/g, name: 'Doble obertura {{{{' },
        { pattern: /\}\}[^{]*\}\}/g, name: 'Doble tancament }}}}' },
        { pattern: /\{\{[^}]{100,}\}\}/g, name: 'Placeholder massa llarg' },
        { pattern: /\{\{[^A-Z0-9_{}]*\}\}/g, name: 'Caràcters invàlids' },
        { pattern: /\{\{.*<.*\}\}/g, name: 'Tags XML residuals' },
      ];
      
      let hasProblems = false;
      let totalProblems = 0;
      problematicPatterns.forEach(({ pattern, name }) => {
        const matches = content.match(pattern);
        if (matches) {
          console.warn(`⚠️ [TIMING] ${name}: ${matches.length} ocurrències`);
          totalProblems += matches.length;
          hasProblems = true;
          // Només mostrar els primers 3 exemples per evitar spam
          matches.slice(0, 3).forEach(match => console.warn(`    ${match.substring(0, 80)}...`));
          if (matches.length > 3) {
            console.warn(`    ... i ${matches.length - 3} més`);
          }
        }
      });
      
      const problemDetectionTime = Date.now() - problemDetectionStartTime;
      console.log(`🔍 [TIMING] Detecció problemes: ${problemDetectionTime}ms - ${totalProblems} problemes trobats`);
      
      // FASE 6: Estadístiques finals i generació del ZIP
      const zipGenerationStartTime = Date.now();
      const finalLength = content.length;
      const sizeDiff = originalLength - finalLength;
      const totalCleaningTime = Date.now() - cleaningStartTime;
      
      // Actualitzar el ZIP amb el contingut netejat
      zip.file('word/document.xml', content);
      const finalBuffer = zip.generate({ type: 'nodebuffer' });
      const zipGenerationTime = Date.now() - zipGenerationStartTime;
      
      // RESUM FINAL DE TIMING DE NETEJA
      console.log(`✅ [TIMING] ========== NETEJA PLACEHOLDERS COMPLETADA ==========`);
      console.log(`✅ [TIMING] Temps total de neteja: ${totalCleaningTime}ms`);
      console.log(`✅ [TIMING] Breakdown de neteja:`);
      console.log(`   🔍 Detecció fragments: ${detectionTime}ms`);
      console.log(`   🔄 Iteracions de neteja: ${totalIterationTime}ms (${iterations} iteracions)`);
      console.log(`   🧽 Neteja final: ${finalCleaningTime}ms`);
      console.log(`   📊 Validació: ${Date.now() - validationStartTime}ms`);
      console.log(`   🔍 Detecció problemes: ${problemDetectionTime}ms`);
      console.log(`   📦 Generació ZIP: ${zipGenerationTime}ms`);
      
      if (content !== originalContent) {
        console.log(`📈 [TIMING] Canvis en document: ${originalLength} → ${finalLength} bytes (${sizeDiff > 0 ? '-' : '+'}${Math.abs(sizeDiff)} bytes)`);
        console.log(`📈 [TIMING] Eficiència: ${(sizeDiff / totalCleaningTime * 1000).toFixed(1)} bytes/segon processats`);
      } else {
        console.log(`✅ [TIMING] Document ja estava net - cap canvi necessari`);
      }
      
      if (hasProblems) {
        console.warn(`⚠️ [TIMING] ATENCIÓ: ${totalProblems} patrons problemàtics detectats`);
        console.warn(`🔄 [TIMING] docxtemplater pot fallar amb aquests placeholders`);
      } else {
        console.log(`🎯 [TIMING] Document completament net - docxtemplater hauria de funcionar perfectament`);
      }
      
      return finalBuffer;
      
    } catch (error) {
      const errorTime = Date.now() - cleaningStartTime;
      console.error(`❌ [TIMING] ========== ERROR EN NETEJA PLACEHOLDERS ==========`);
      console.error(`❌ [TIMING] Error després de: ${errorTime}ms de neteja`);
      console.error(`❌ [TIMING] Error crític:`, error);
      console.warn(`🔄 [TIMING] Retornant document original com a fallback`);
      return templateBuffer;
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
    const STORAGE_TIMEOUT_MS = 5000; // 5 segons de timeout (reduït per debug)

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
