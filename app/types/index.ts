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
 * Interfície per a els mappings de paràgrafs amb IDs
 */
export interface ParagraphMapping {
  id: string; // ID del SDT (ex: "docproof_pid_123")
  text: string; // Contingut del paràgraf
  numericId: number; // ID numèric seqüencial
  originalIndex?: number; // Índex original al document
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
 * Actualitzada per reflectir l'esquema real de plantilla_configs
 */
export interface Template {
  id: string;
  user_id: string;
  config_name: string;
  base_docx_name?: string;
  base_docx_storage_path?: string;
  placeholder_docx_storage_path?: string;
  indexed_docx_storage_path?: string;
  paragraph_mappings?: ParagraphMapping[];
  docx_storage_path?: string;
  excel_file_name?: string;
  excel_headers?: string[];
  link_mappings?: ExcelLinkMapping[];
  ai_instructions?: AIInstruction[];
  final_html?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Interfície per compatibilitat amb l'antiga estructura
 * @deprecated Usar Template en lloc d'aquesta interfície
 */
export interface LegacyTemplate {
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
