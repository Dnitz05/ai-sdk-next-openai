/**
 * API Endpoint: /api/templates/migrate-to-simple
 * 
 * SISTEMA DE MIGRACIÓ UNIVERSAL - SOLUCIÓ DEFINITIVA
 * Converteix totes les plantilles legacy al format simple {{PLACEHOLDER}}
 * 
 * Data: 7 d'agost de 2025
 * Arquitecte: Cline
 * Objectiu: Eliminar definitivament els placeholders legacy
 */

import { NextRequest, NextResponse } from 'next/server';
import PizZip from 'pizzip';
import { createClient } from '@supabase/supabase-js';
import supabaseServerClient from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minuts per migració massiva

// ============================================================================
// INTERFACES
// ============================================================================

interface MigrationResult {
  templateId: string;
  success: boolean;
  message?: string;
  error?: string;
  stats?: MigrationStats;
  originalPath?: string;
  newPath?: string;
}

interface MigrationStats {
  legacyPlaceholders: number;
  simplePlaceholders: number;
  converted: number;
  malformedTags: number;
  duplicatedTags: number;
}

interface DocumentMigrationResult {
  hasLegacyContent: boolean;
  migratedBuffer: Buffer;
  stats: MigrationStats;
  issues: string[];
}

// ============================================================================
// MAPA DE CONVERSIONS INTEL·LIGENTS
// ============================================================================

const CONVERSION_PATTERNS = new Map([
  // Contractista/Client
  ['contractista', 'CONTRACTISTA'],
  ['client', 'CONTRACTISTA'],
  ['nom_client', 'CONTRACTISTA'],
  ['nom_contractista', 'CONTRACTISTA'],
  
  // Noms
  ['nom', 'NOM'],
  ['name', 'NOM'],
  ['nombre', 'NOM'],
  
  // Imports/Preus
  ['import', 'IMPORT'],
  ['preu', 'IMPORT'],
  ['cost', 'IMPORT'],
  ['precio', 'IMPORT'],
  ['amount', 'IMPORT'],
  
  // Dates
  ['data', 'DATA'],
  ['fecha', 'DATA'],
  ['date', 'DATA'],
  ['data_actual', 'DATA_ACTUAL'],
  
  // Adreces
  ['adreca', 'ADRECA'],
  ['direccio', 'ADRECA'],
  ['address', 'ADRECA'],
  ['adreça', 'ADRECA'],
  
  // Altres comuns
  ['telefon', 'TELEFON'],
  ['email', 'EMAIL'],
  ['dni', 'DNI'],
  ['nif', 'NIF'],
  ['expedient', 'EXPEDIENT'],
  ['referencia', 'REFERENCIA'],
]);

// ============================================================================
// ENDPOINT PRINCIPAL
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log(`🚀 [Migration] Iniciant sistema de migració universal`);

    const body = await request.json();
    const { mode = 'single', templateId, dryRun = false, adminMode = false, force = false } = body;

    // Per operacions administratives, saltar autenticació d'usuari
    if (!adminMode) {
      // Validar autenticació normal
      const { data: authData, error: authError } = await supabaseServerClient.auth.getUser();
      if (authError || !authData.user) {
        return NextResponse.json(
          { success: false, error: 'Usuari no autenticat' },
          { status: 401 }
        );
      }
      console.log(`👤 [Migration] Usuari: ${authData.user.id}, Mode: ${mode}`);
    } else {
      console.log(`🔧 [Migration] Mode administratiu activat, Mode: ${mode}`);
    }

    if (mode === 'single') {
      if (!templateId) {
        return NextResponse.json(
          { success: false, error: 'templateId és obligatori per mode single' },
          { status: 400 }
        );
      }

      const result = await migrateTemplate(templateId, dryRun, force);
      return NextResponse.json(result);
      
    } else if (mode === 'all') {
      const results = await migrateAllTemplates(dryRun);
      return NextResponse.json(results);
      
    } else if (mode === 'analyze') {
      const analysis = await analyzeAllTemplates();
      return NextResponse.json(analysis);
    }

    return NextResponse.json(
      { success: false, error: 'Mode no vàlid. Usa: single, all, analyze' },
      { status: 400 }
    );

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [Migration] Error crític:`, error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error intern del sistema de migració',
        details: error instanceof Error ? error.message : 'Error desconegut',
        processingTimeMs: totalTime,
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// MIGRACIÓ D'UNA PLANTILLA
// ============================================================================

async function migrateTemplate(templateId: string, dryRun: boolean = false, force: boolean = false): Promise<MigrationResult> {
  try {
    console.log(`🔧 [Migration] Migrant plantilla ${templateId} (dryRun: ${dryRun})`);

    // 1. Obtenir info de la plantilla
    const { data: template, error: templateError } = await supabaseServerClient
      .from('plantilla_configs')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      return { 
        templateId, 
        success: false, 
        error: `Plantilla no trobada: ${templateError?.message || 'No existeix'}` 
      };
    }

    // Determinar quin path usar per la plantilla
    const docxPath = template.placeholder_docx_storage_path || 
                    template.docx_storage_path || 
                    template.base_docx_storage_path ||
                    template.indexed_docx_storage_path;

    if (!docxPath) {
      return { 
        templateId, 
        success: false, 
        error: 'No hi ha cap fitxer DOCX configurat per aquesta plantilla' 
      };
    }

    console.log(`📁 [Migration] Usant path: ${docxPath}`);

    // 2. Descarregar plantilla original
    const { data: fileData, error: downloadError } = await supabaseServerClient.storage
      .from('template-docx')
      .download(docxPath);

    if (downloadError || !fileData) {
      return { 
        templateId, 
        success: false, 
        error: `No es pot descarregar fitxer: ${downloadError?.message || 'Fitxer no trobat'}` 
      };
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    console.log(`📥 [Migration] Fitxer descarregat: ${buffer.length} bytes`);

    // 3. Analitzar i migrar contingut
    const migrationResult = await migrateDocumentContent(buffer);

    if (!migrationResult.hasLegacyContent && !force) {
      return { 
        templateId, 
        success: true, 
        message: 'Ja està en format simple - no cal migració',
        stats: migrationResult.stats,
        originalPath: docxPath
      };
    }

    if (force) {
      console.log(`🔧 [Migration] Mode FORCE activat - re-processant plantilla independentment de l'estat`);
    }

    console.log(`🔄 [Migration] Contingut legacy detectat, migrant...`);
    console.log(`📊 [Migration] Stats:`, migrationResult.stats);

    if (dryRun) {
      return {
        templateId,
        success: true,
        message: 'DRY RUN - Migració simulada correctament',
        stats: migrationResult.stats,
        originalPath: docxPath
      };
    }

    // 4. Generar nou path per la versió migrada
    const pathParts = docxPath.split('/');
    const fileName = pathParts.pop() || 'template.docx';
    const directory = pathParts.join('/');
    
    const newFileName = fileName.replace('.docx', '_simple.docx');
    const newPath = `${directory}/${newFileName}`;

    console.log(`💾 [Migration] Guardant versió migrada a: ${newPath}`);

    // 5. Guardar nova versió migrada
    const { error: uploadError } = await supabaseServerClient.storage
      .from('template-docx')
      .upload(newPath, migrationResult.migratedBuffer, { 
        upsert: true,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

    if (uploadError) {
      throw new Error(`Error pujant fitxer migrat: ${uploadError.message}`);
    }

    // 6. Actualitzar BD amb nou path i metadades
    const { error: updateError } = await supabaseServerClient
      .from('plantilla_configs')
      .update({ 
        placeholder_docx_storage_path: newPath,
        legacy_placeholder_path: docxPath,
        migration_date: new Date().toISOString(),
        template_format: 'simple',
        migration_stats: migrationResult.stats
      })
      .eq('id', templateId);

    if (updateError) {
      // Si falla l'actualització de BD, intentar eliminar el fitxer pujat
      await supabaseServerClient.storage
        .from('template-docx')
        .remove([newPath]);
        
      throw new Error(`Error actualitzant BD: ${updateError.message}`);
    }

    console.log(`✅ [Migration] Plantilla ${templateId} migrada correctament`);

    return {
      templateId,
      success: true,
      message: 'Migrat correctament al format simple',
      stats: migrationResult.stats,
      originalPath: docxPath,
      newPath: newPath
    };

  } catch (error) {
    console.error(`❌ [Migration] Error migrant template ${templateId}:`, error);
    return {
      templateId,
      success: false,
      error: error instanceof Error ? error.message : 'Error desconegut'
    };
  }
}

// ============================================================================
// MIGRACIÓ MASSIVA
// ============================================================================

async function migrateAllTemplates(dryRun: boolean = false): Promise<{
  success: boolean;
  migrated: number;
  failed: number;
  skipped: number;
  details: MigrationResult[];
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  
  try {
    console.log(`🚀 [Migration] Iniciant migració massiva (dryRun: ${dryRun})`);

    // Obtenir totes les plantilles amb fitxers DOCX
    const { data: templates, error: templatesError } = await supabaseServerClient
      .from('plantilla_configs')
      .select('id, config_name, placeholder_docx_storage_path, docx_storage_path, base_docx_storage_path, indexed_docx_storage_path, template_format')
      .or('placeholder_docx_storage_path.not.is.null,docx_storage_path.not.is.null,base_docx_storage_path.not.is.null,indexed_docx_storage_path.not.is.null');

    if (templatesError || !templates) {
      throw new Error(`Error obtenint plantilles: ${templatesError?.message}`);
    }

    console.log(`📋 [Migration] Trobades ${templates.length} plantilles per analitzar`);

    const results: MigrationResult[] = [];
    let migrated = 0;
    let failed = 0;
    let skipped = 0;

    // Processar cada plantilla
    for (const template of templates) {
      console.log(`🔄 [Migration] Processant: ${template.config_name} (${template.id})`);
      
      // Saltar si ja està migrada
      if (template.template_format === 'simple') {
        console.log(`⏭️ [Migration] Saltant ${template.id} - ja està en format simple`);
        skipped++;
        results.push({
          templateId: template.id,
          success: true,
          message: 'Ja està en format simple - saltat'
        });
        continue;
      }

      const result = await migrateTemplate(template.id, dryRun);
      results.push(result);

      if (result.success) {
        if (result.message?.includes('no cal migració')) {
          skipped++;
        } else {
          migrated++;
        }
      } else {
        failed++;
      }

      // Petit delay per no sobrecarregar el sistema
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const processingTime = Date.now() - startTime;
    
    console.log(`✅ [Migration] Migració massiva completada:`);
    console.log(`   - Migrades: ${migrated}`);
    console.log(`   - Saltades: ${skipped}`);
    console.log(`   - Errors: ${failed}`);
    console.log(`   - Temps total: ${processingTime}ms`);

    return {
      success: true,
      migrated,
      failed,
      skipped,
      details: results,
      processingTimeMs: processingTime
    };

  } catch (error) {
    console.error(`❌ [Migration] Error en migració massiva:`, error);
    return {
      success: false,
      migrated: 0,
      failed: 0,
      skipped: 0,
      details: [],
      processingTimeMs: Date.now() - startTime
    };
  }
}

// ============================================================================
// ANÀLISI DE PLANTILLES
// ============================================================================

async function analyzeAllTemplates(): Promise<{
  success: boolean;
  totalTemplates: number;
  legacyTemplates: number;
  simpleTemplates: number;
  unknownTemplates: number;
  details: any[];
}> {
  try {
    console.log(`🔍 [Migration] Analitzant totes les plantilles...`);

    const { data: templates, error } = await supabaseServerClient
      .from('plantilla_configs')
      .select('id, config_name, template_format, placeholder_docx_storage_path, docx_storage_path, base_docx_storage_path, indexed_docx_storage_path');

    if (error || !templates) {
      throw new Error(`Error obtenint plantilles: ${error?.message}`);
    }

    const analysis = {
      totalTemplates: templates.length,
      legacyTemplates: 0,
      simpleTemplates: 0,
      unknownTemplates: 0,
      details: [] as any[]
    };

    for (const template of templates) {
      const docxPath = template.placeholder_docx_storage_path || 
                      template.docx_storage_path || 
                      template.base_docx_storage_path ||
                      template.indexed_docx_storage_path;

      let status = 'unknown';
      
      if (template.template_format === 'simple') {
        status = 'simple';
        analysis.simpleTemplates++;
      } else if (template.template_format === 'legacy' || !template.template_format) {
        status = 'legacy';
        analysis.legacyTemplates++;
      } else {
        analysis.unknownTemplates++;
      }

      analysis.details.push({
        id: template.id,
        name: template.config_name,
        status,
        hasDocx: !!docxPath,
        docxPath
      });
    }

    return {
      success: true,
      ...analysis
    };

  } catch (error) {
    console.error(`❌ [Migration] Error analitzant plantilles:`, error);
    return {
      success: false,
      totalTemplates: 0,
      legacyTemplates: 0,
      simpleTemplates: 0,
      unknownTemplates: 0,
      details: []
    };
  }
}

// ============================================================================
// UNIFICACIÓ DE PLACEHOLDERS TRENCATS
// ============================================================================

function unifyBrokenPlaceholders(content: string): string {
  console.log(`🔧 [Migration] Iniciant unificació de placeholders trencats...`);
  
  // 1. Trobar i unificar placeholders trencats genèrics
  // Pattern: {{QUAL...SEVOL}} dividit entre tags XML
  content = content.replace(
    /(\{\{[^}<>]*)<\/\w+[^>]*>[^<]*<\w+[^>]*>([^}<>]*\}\})/g,
    '$1$2'
  );
  
  // 2. Cas específic: PLACEHOLDER trencat
  content = content.replace(
    /\{\{PLAC<\/\w+[^>]*>[^<]*<\w+[^>]*>EHOLDER\}\}/g,
    '{{PLACEHOLDER}}'
  );
  
  // 3. Netejar espais i salts de línia dins placeholders
  content = content.replace(
    /\{\{([^}]+)\}\}/g,
    (match, inner) => `{{${inner.replace(/\s+/g, ' ').trim()}}}`
  );
  
  // 4. Unificar qualsevol placeholder trencat genèric
  // Buscar {{ seguit de contingut, tags XML, més contingut i }}
  let iterations = 0;
  let previousContent = '';
  
  while (iterations < 5 && content !== previousContent) { // Màxim 5 iteracions per evitar bucles infinits
    previousContent = content;
    content = content.replace(
      /(\{\{[^}<>]*?)(<\/?\w+[^>]*>)+([^}<>]*?\}\})/g,
      (match, start, tags, end) => {
        // Eliminar tots els tags XML dins del placeholder
        console.log(`🔧 [Migration] Unificant placeholder trencat: ${match.substring(0, 50)}...`);
        return start + end;
      }
    );
    iterations++;
  }
  
  // 5. Casos específics addicionals per placeholders comuns
  const commonPlaceholders = [
    { broken: /\{\{NOM<[^>]*>[^<]*<[^>]*>([^}]*)\}\}/g, fixed: '{{NOM}}' },
    { broken: /\{\{ADREC<[^>]*>[^<]*<[^>]*>A\}\}/g, fixed: '{{ADRECA}}' },
    { broken: /\{\{IMPORT<[^>]*>[^<]*<[^>]*>([^}]*)\}\}/g, fixed: '{{IMPORT}}' },
    { broken: /\{\{DATA<[^>]*>[^<]*<[^>]*>([^}]*)\}\}/g, fixed: '{{DATA}}' },
  ];
  
  commonPlaceholders.forEach(({ broken, fixed }) => {
    if (broken.test(content)) {
      console.log(`🔧 [Migration] Corregint placeholder comú: ${fixed}`);
      content = content.replace(broken, fixed);
    }
  });
  
  console.log(`✅ [Migration] Unificació de placeholders completada`);
  return content;
}

// ============================================================================
// VALIDACIÓ DE PLANTILLA MIGRADA
// ============================================================================

async function validateMigratedTemplate(buffer: Buffer): Promise<{
  valid: boolean;
  issues: string[];
  placeholderCount: number;
}> {
  try {
    const zip = new PizZip(buffer);
    const content = zip.file('word/document.xml')?.asText() || '';
    
    const issues: string[] = [];
    
    // Buscar placeholders trencats
    const brokenPattern = /\{\{[^}]*<[^>]+>[^}]*\}\}/;
    if (brokenPattern.test(content)) {
      issues.push('Placeholders amb tags XML interns detectats');
    }
    
    // Buscar tags parcials
    if (content.includes('{{PLAC') && !content.includes('{{PLACEHOLDER}}')) {
      issues.push('Placeholder PLAC incomplet detectat');
    }
    
    // Buscar tags malformats
    const malformedTags = content.match(/\{[^{]|[^}]\}/g);
    if (malformedTags && malformedTags.length > 0) {
      issues.push(`${malformedTags.length} tags malformats detectats`);
    }
    
    // Validar amb docxtemplater
    try {
      const Docxtemplater = require('docxtemplater');
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => ''
      });
      doc.render({}); // Prova de renderització buida
    } catch (e: any) {
      if (e.properties?.errors) {
        issues.push(`Errors docxtemplater: ${e.properties.errors.length}`);
        e.properties.errors.forEach((error: any, index: number) => {
          issues.push(`  Error ${index + 1}: ${error.properties?.explanation || error.message}`);
        });
      } else {
        issues.push(`Error docxtemplater: ${e.message}`);
      }
    }
    
    const placeholderCount = (content.match(/\{\{[^}]+\}\}/g) || []).length;
    
    return { 
      valid: issues.length === 0, 
      issues,
      placeholderCount
    };
  } catch (error) {
    return {
      valid: false,
      issues: [`Error validant plantilla: ${error instanceof Error ? error.message : 'Error desconegut'}`],
      placeholderCount: 0
    };
  }
}

// ============================================================================
// MIGRACIÓ DEL CONTINGUT DEL DOCUMENT
// ============================================================================

async function migrateDocumentContent(buffer: Buffer): Promise<DocumentMigrationResult> {
  try {
    const zip = new PizZip(buffer);
    let content = zip.file('word/document.xml')?.asText() || '';
    
    // NOVA FASE: Pre-processament per unificar placeholders trencats
    console.log(`🔧 [Migration] Aplicant pre-processament per placeholders trencats...`);
    content = unifyBrokenPlaceholders(content);
    
    let migratedContent = content;
    const stats: MigrationStats = {
      legacyPlaceholders: 0,
      simplePlaceholders: 0,
      converted: 0,
      malformedTags: 0,
      duplicatedTags: 0
    };
    const issues: string[] = [];

    // 1. Detectar si té contingut legacy
    const hasLegacyContent = content.includes('UNIFIED_PLACEHOLDER') || 
                            content.includes('paragraphId') ||
                            content.match(/\{\{[^}]*\{[^}]*\}[^}]*\}\}/); // JSON dins placeholders

    if (!hasLegacyContent) {
      // Comptar placeholders simples existents
      const simplePlaceholderMatches = content.match(/\{\{[A-Z_][A-Z0-9_]*\}\}/g);
      stats.simplePlaceholders = simplePlaceholderMatches?.length || 0;
      
      return { 
        hasLegacyContent: false, 
        migratedBuffer: buffer,
        stats,
        issues
      };
    }

    console.log(`🔍 [Migration] Contingut legacy detectat, processant...`);

    // 2. Processar placeholders amb JSON complex
    migratedContent = migratedContent.replace(
      /\{\{UNIFIED_PLACEHOLDER:\s*(\{[^}]*\})\s*\}\}/g,
      (fullMatch, jsonStr) => {
        stats.legacyPlaceholders++;
        
        try {
          const data = JSON.parse(jsonStr);
          
          // Extreure el text base amb placeholders
          if (data.baseTextWithPlaceholders) {
            stats.converted++;
            return data.baseTextWithPlaceholders;
          }
          
          // Si és només Excel, crear placeholder simple
          if (data.type === 'excel_only') {
            const placeholder = extractPlaceholderFromText(data.baseText || '');
            stats.converted++;
            return placeholder;
          }
          
          // Si és només AI, crear placeholder simple
          if (data.type === 'ai_only') {
            const placeholderId = generatePlaceholderFromId(data.paragraphId);
            stats.converted++;
            return `{{${placeholderId}}}`;
          }
          
          // Fallback
          stats.converted++;
          return '{{PLACEHOLDER}}';
          
        } catch (e) {
          console.error('Error parsejant JSON placeholder:', e);
          issues.push(`Error parsejant JSON: ${jsonStr.substring(0, 50)}...`);
          return '{{PLACEHOLDER}}';
        }
      }
    );

    // 3. Netejar tags duplicats i malformats
    const originalContent = migratedContent;
    
    // Detectar i comptar tags duplicats
    const duplicatedOpenTags = (migratedContent.match(/\{\{\{+/g) || []).length;
    const duplicatedCloseTags = (migratedContent.match(/\}\}\}+/g) || []).length;
    stats.duplicatedTags = duplicatedOpenTags + duplicatedCloseTags;
    
    // Netejar tags duplicats
    migratedContent = migratedContent
      .replace(/\{\{\{+/g, '{{')
      .replace(/\}\}\}+/g, '}}');
    
    // Netejar espais dins placeholders
    migratedContent = migratedContent.replace(/\{\{([^}]+)\s+\}\}/g, '{{$1}}');
    
    // Detectar tags malformats
    const malformedMatches = migratedContent.match(/\{[^{]|[^}]\}/g);
    stats.malformedTags = malformedMatches?.length || 0;
    
    if (stats.malformedTags > 0) {
      issues.push(`${stats.malformedTags} tags malformats detectats`);
    }

    // 4. Comptar placeholders simples resultants
    const simplePlaceholderMatches = migratedContent.match(/\{\{[A-Z_][A-Z0-9_]*\}\}/g);
    stats.simplePlaceholders = simplePlaceholderMatches?.length || 0;

    // 5. Actualitzar el document
    zip.file('word/document.xml', migratedContent);
    const migratedBuffer = zip.generate({ type: 'nodebuffer' });

    console.log(`✅ [Migration] Contingut migrat:`, stats);

    return {
      hasLegacyContent: true,
      migratedBuffer,
      stats,
      issues
    };

  } catch (error) {
    console.error(`❌ [Migration] Error migrant contingut:`, error);
    throw new Error(`Error processant contingut del document: ${error instanceof Error ? error.message : 'Error desconegut'}`);
  }
}

// ============================================================================
// UTILITATS
// ============================================================================

function extractPlaceholderFromText(text: string): string {
  // Intentar extreure placeholder del text
  const match = text.match(/\{\{([A-Z_][A-Z0-9_]*)\}\}/);
  if (match) {
    return `{{${match[1]}}}`;
  }
  
  // Si no hi ha placeholder, crear un basat en el text
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
  const key = words.slice(0, 2).join('_');
  
  // Usar mapa de conversions
  const standardKey = CONVERSION_PATTERNS.get(key) || key.toUpperCase();
  
  return `{{${standardKey}}}`;
}

function generatePlaceholderFromId(paragraphId: string): string {
  if (!paragraphId) return 'AI_TEXT';
  
  // Extreure part única del paragraphId
  const parts = paragraphId.split('-');
  const uniquePart = parts[parts.length - 1] || 'TEXT';
  
  return `AI_${uniquePart.toUpperCase()}`;
}

// ============================================================================
// GET ENDPOINT - INFORMACIÓ
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const analysis = await analyzeAllTemplates();
    
    return NextResponse.json({
      success: true,
      message: 'Sistema de migració universal operatiu',
      analysis,
      endpoints: {
        migrate_single: 'POST { mode: "single", templateId: "xxx" }',
        migrate_all: 'POST { mode: "all" }',
        analyze: 'POST { mode: "analyze" }',
        dry_run: 'POST { mode: "all", dryRun: true }'
      }
    });

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error obtenint informació del sistema',
        details: error instanceof Error ? error.message : 'Error desconegut'
      },
      { status: 500 }
    );
  }
}
