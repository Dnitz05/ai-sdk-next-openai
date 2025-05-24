/**
 * Definicions de tipus utilitzats a l'aplicació
 * Aquest fitxer centralitza les interfícies comunes que s'utilitzen en múltiples components
 */

/**
 * Interfície per a les associacions Excel
 */
export interface ExcelLinkMapping {
  id: string;
  paragraphId?: string;
  selectedText?: string;
  excelHeader?: string;
  cellRange?: string;
}

/**
 * Interfície per a les instruccions IA
 */
export interface AIInstruction {
  id?: string;
  paragraphId?: string;
  content?: string;
  prompt?: string;
  originalParagraphText?: string;
}

/**
 * Interfície per a la configuració completa d'una plantilla
 */
export interface TemplateConfiguration {
  linkMappings: ExcelLinkMapping[];
  aiInstructions: AIInstruction[];
  docxPath?: string;
  title?: string;
  description?: string;
}

/**
 * Interfície per a una plantilla de la base de dades
 */
export interface Template {
  id: string;
  title: string;
  description: string;
  configuration: TemplateConfiguration;
  docx_path: string;
  placeholder_path: string;
  indexed_docx_path?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}
