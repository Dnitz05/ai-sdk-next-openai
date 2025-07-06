/**
 * Types i interfaces per al nou sistema de generació intel·ligent d'informes
 * Data: 6 de juliol de 2025
 * Arquitecte: Cline
 */

// ============================================================================
// INTERFACES PRINCIPALS
// ============================================================================

/**
 * Placeholder intel·ligent amb instruccions específiques
 */
export interface SmartPlaceholder {
  id: string;           // Identificador únic (ex: "CONTRACTISTA")
  instruction: string;  // Instrucció completa per la IA
  example?: string;     // Exemple opcional per guiar la IA
}

/**
 * Document processat amb tots els placeholders substituïts
 */
export interface ProcessedDocument {
  documentIndex: number;        // Índex del document (0, 1, 2...)
  rowData: any;                // Dades Excel originals per aquest document
  placeholderValues: Record<string, string>; // Valors finals per cada placeholder
  documentBuffer?: Buffer;      // Buffer del document DOCX final
  storagePath?: string;        // Path on s'ha desat el document
}

/**
 * Configuració per al processament batch
 */
export interface BatchProcessingConfig {
  templateId: string;          // ID de la plantilla
  templateContent: string;     // Contingut de la plantilla amb placeholders
  templateStoragePath: string; // Path del DOCX original a Supabase Storage
  excelData: any[];           // Array amb totes les files de dades Excel
  userId: string;             // ID de l'usuari que fa la petició
}

/**
 * Resultat del processament batch
 */
export interface BatchProcessingResult {
  success: boolean;
  generationId: string;        // ID de la generació a smart_generations
  documentsGenerated: number;
  processingTimeMs: number;
  documents: ProcessedDocument[];
  errorMessage?: string;
}

/**
 * Estat de la generació (simplificat)
 */
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Record de la taula smart_generations
 */
export interface SmartGeneration {
  id: string;
  user_id: string;
  template_id?: string;
  template_content: string;
  excel_data: any[];
  generated_documents?: ProcessedDocument[];
  processing_time?: number;
  status: GenerationStatus;
  error_message?: string;
  num_documents: number;
  created_at: string;
  completed_at?: string;
}

// ============================================================================
// CONFIGURACIÓ MISTRAL AI
// ============================================================================

/**
 * Configuració per la crida a Mistral AI
 */
export interface MistralConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  apiKey: string;
}

/**
 * Resposta esperada de Mistral AI
 */
export interface MistralResponse {
  success: boolean;
  documentsData: Record<string, string>[]; // Array d'objectes amb placeholders substituïts
  errorMessage?: string;
  tokensUsed?: number;
}

// ============================================================================
// UTILITATS I HELPERS
// ============================================================================

/**
 * Configuració per docxtemplater
 */
export interface DocxTemplaterConfig {
  paragraphLoop: boolean;
  linebreaks: boolean;
  nullGetter: () => string;
  errorLogging: boolean;
}

/**
 * Mètriques de rendiment
 */
export interface PerformanceMetrics {
  totalProcessingTime: number;
  aiCallTime: number;
  docxGenerationTime: number;
  storageUploadTime: number;
  documentsPerSecond: number;
}

/**
 * Configuració de Storage
 */
export interface StorageConfig {
  bucketName: string;
  basePath: string;
  publicUrl: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const SMART_GENERATION_CONSTANTS = {
  // Estats possibles
  STATUS: {
    PENDING: 'pending' as const,
    PROCESSING: 'processing' as const,
    COMPLETED: 'completed' as const,
    FAILED: 'failed' as const,
  },
  
  // Configuració Mistral AI per defecte
  MISTRAL_DEFAULTS: {
    MODEL: 'mistral-large-latest',
    TEMPERATURE: 0.1, // Baixa per consistència
    MAX_TOKENS: 8000,
  },
  
  // Configuració docxtemplater
  DOCX_DEFAULTS: {
    PARAGRAPH_LOOP: true,
    LINEBREAKS: true,
    NULL_GETTER: () => '',
    ERROR_LOGGING: true,
  },
  
  // Storage
  STORAGE: {
    BUCKET: 'documents',
    BASE_PATH: 'smart-generations',
  },
  
  // Límits
  LIMITS: {
    MAX_DOCUMENTS_PER_BATCH: 100,
    MAX_EXCEL_ROWS: 1000,
    MAX_TEMPLATE_SIZE_MB: 10,
    TIMEOUT_MS: 300000, // 5 minuts
  },
} as const;

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Verifica si un objecte és un SmartPlaceholder vàlid
 */
export function isSmartPlaceholder(obj: any): obj is SmartPlaceholder {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.instruction === 'string' &&
    (obj.example === undefined || typeof obj.example === 'string')
  );
}

/**
 * Verifica si un estat és vàlid
 */
export function isValidGenerationStatus(status: string): status is GenerationStatus {
  return Object.values(SMART_GENERATION_CONSTANTS.STATUS).includes(status as any);
}

/**
 * Verifica si les dades Excel són vàlides
 */
export function isValidExcelData(data: any): data is any[] {
  return Array.isArray(data) && data.length > 0 && data.length <= SMART_GENERATION_CONSTANTS.LIMITS.MAX_EXCEL_ROWS;
}
