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
  id: string;
  paragraphId: string;
  originalParagraphText: string;
  status: 'saved' | 'editing';
  order: number;
  // Els dos camps que defineixen la instrucció
  prompt: string;
  useExistingText: boolean;
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
  excel_storage_path?: string; // Nova columna per emmagatzemar la ruta del fitxer Excel complet
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

/**
 * Interfícies per al Mòdul de Generació d'Informes
 */

/**
 * Interfície per a un projecte de generació d'informes
 */
export interface Project {
  id: string;
  user_id: string;
  template_id: string;
  project_name: string;
  excel_filename: string;
  excel_data?: any; // JSONB
  total_rows?: number;
  created_at: string;
  updated_at: string;
}

/**
 * Interfície per a l'estat d'una generació (fila de l'Excel)
 */
export interface Generation {
  id: string;
  project_id: string;
  excel_row_index: number;
  row_data?: any; // JSONB - dades específiques de la fila
  status: 'pending' | 'generated' | 'reviewed' | 'completed' | 'error';
  error_message?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Interfície per al contingut generat per la IA
 */
export interface GeneratedContent {
  id: string;
  generation_id: string;
  placeholder_id: string; // Correspon al 'paragraphId' del placeholder
  final_content?: string;
  is_refined: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Interfície per a un projecte amb estadístiques incloses
 */
export interface ProjectWithStats extends Omit<Project, 'excel_data'> {
  template_name: string;
  template_docx_name?: string;
  stats: {
    total: number;
    completed: number;
    pending: number;
    errors: number;
    progress: number; // Percentatge (0-100)
  };
}

/**
 * Interfície per a la resposta de l'API de projectes
 */
export interface ProjectsResponse {
  projects: ProjectWithStats[];
}

/**
 * Interfície per a crear un nou projecte
 */
export interface CreateProjectRequest {
  template_id: string;
  project_name: string;
  excel_filename: string;
  excel_data: any[];
  total_rows?: number;
}

/**
 * Interfície per al contingut individual de cada secció
 */
export interface Content {
  id: string;
  generation_id: string;
  placeholder_id: string;
  ai_instructions?: string;
  generated_text?: string;
  status: 'pending' | 'generated' | 'refined' | 'error';
  error_message?: string;
  created_at: string;
  updated_at: string;
}
