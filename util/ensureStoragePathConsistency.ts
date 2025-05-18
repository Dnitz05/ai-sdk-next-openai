/**
 * Utilitat per verificar i reparar inconsistències entre Supabase Storage i la base de dades.
 * Aquesta funció pot ser utilitzada a través de CLI o invocada per altres parts del codi.
 * 
 * @author Cline & AI-SDK Team
 * @version 1.0
 */

import { createClient } from '@supabase/supabase-js';

interface RepairResult {
  fixed: number;
  problematic: { id: string; userId: string; originalName: string | null; issue: string }[];
  scanCount: number;
}

/**
 * Verifica i repara inconsistències entre els documents DOCX emmagatzemats a Supabase Storage
 * i les referències guardades a la taula plantilla_configs.
 * 
 * @param limit Nombre màxim de plantilles a escanejar (per defecte 100)
 * @param fixAutomatically Si és true, intenta reparar automàticament les inconsistències (per defecte false)
 * @param verbose Si és true, mostra més informació durant el procés (per defecte false)
 * 
 * @returns Promise amb els resultats de la verificació i les reparacions
 */
export async function ensureStoragePathConsistency(
  limit: number = 100,
  fixAutomatically: boolean = false,
  verbose: boolean = false
): Promise<RepairResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Falten les variables d\'entorn necessàries per connectar amb Supabase');
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  console.log(`[Storage Consistency] Iniciant verificació de consistència (limit: ${limit})`);

  // Resultat
  const result: RepairResult = {
    fixed: 0,
    problematic: [],
    scanCount: 0,
  };

  try {
    // 1. Obtenir plantilles amb límit
    const { data: templates, error: templatesError } = await supabase
      .from('plantilla_configs')
      .select('id, user_id, base_docx_name, base_docx_storage_path')
      .limit(limit);

    if (templatesError) {
      throw new Error(`Error obtenint plantilles: ${templatesError.message}`);
    }

    console.log(`[Storage Consistency] Escanejant ${templates.length} plantilles...`);
    result.scanCount = templates.length;

    // 2. Verificar cada plantilla
    for (const template of templates) {
      const templateId = template.id;
      const userId = template.user_id;
      const storedPath = template.base_docx_storage_path;
      const originalName = template.base_docx_name;

      if (verbose) {
        console.log(`\n[Storage Consistency] Verificant plantilla ${templateId} de l'usuari ${userId}`);
        console.log(`  - Nom original: ${originalName || 'Desconegut'}`);
        console.log(`  - Ruta emmagatzemada: ${storedPath || 'NULL'}`);
      }

      // 3a. Si no hi ha path emmagatzemat, buscar si hi ha algun document a la ruta esperada
      if (!storedPath) {
        const searchPath = `user-${userId}/template-${templateId}/original`;
        if (verbose) console.log(`  - Cercant a: ${searchPath}`);

        const { data: fileList, error: listError } = await supabase.storage
          .from('template-docx')
          .list(searchPath);

        if (listError) {
          console.error(`  - Error buscant fitxers a ${searchPath}: ${listError.message}`);
          result.problematic.push({
            id: templateId,
            userId: userId,
            originalName: originalName,
            issue: `Error buscant fitxers: ${listError.message}`
          });
          continue;
        }

        if (!fileList || fileList.length === 0) {
          if (verbose) console.log(`  - No s'han trobat fitxers a ${searchPath}`);
          continue; // Saltam a la següent plantilla
        }

        // Buscar si hi ha algun fitxer .docx
        const docxFile = fileList.find(f => f.name.toLowerCase().endsWith('.docx'));
        
        if (docxFile) {
          const recoveredPath = `${searchPath}/${docxFile.name}`;
          console.log(`[Storage Consistency] ✅ Plantilla ${templateId}: Trobat document a ${recoveredPath}`);

          if (fixAutomatically) {
            const { error: updateError } = await supabase
              .from('plantilla_configs')
              .update({ base_docx_storage_path: recoveredPath })
              .eq('id', templateId);

            if (updateError) {
              console.error(`  - Error actualitzant la BD: ${updateError.message}`);
              result.problematic.push({
                id: templateId,
                userId: userId,
                originalName: originalName,
                issue: `Error actualitzant la BD: ${updateError.message}`
              });
            } else {
              console.log(`  - ✅ BD actualitzada amb ruta: ${recoveredPath}`);
              result.fixed++;
            }
          } else {
            console.log(`  - [MODE NOMÉS LECTURA] Es podria reparar amb: ${recoveredPath}`);
            result.problematic.push({
              id: templateId,
              userId: userId,
              originalName: originalName,
              issue: `Ruta emmagatzemada NULL però el document existeix a: ${recoveredPath}`
            });
          }
        } else {
          if (verbose) console.log(`  - No s'ha trobat cap fitxer .docx a ${searchPath}`);
        }
      }
      // 3b. Si hi ha path emmagatzemat, verificar que el fitxer existeix
      else {
        // Comprovar si el fitxer existeix a Storage
        try {
          const { data: existingFile } = await supabase.storage
            .from('template-docx')
            .getPublicUrl(storedPath);

          if (!existingFile || !existingFile.publicUrl) {
            console.log(`[Storage Consistency] ❌ Plantilla ${templateId}: No s'ha pogut obtenir la URL pública`);
            result.problematic.push({
              id: templateId,
              userId: userId,
              originalName: originalName,
              issue: `No s'ha pogut obtenir la URL pública per a ${storedPath}`
            });
          } else if (verbose) {
            console.log(`  - Verificat: URL pública obtinguda per a ${storedPath}`);
          }
        } catch (existError) {
          console.log(`  - Error verificant existència a ${storedPath}: ${existError instanceof Error ? existError.message : String(existError)}`);
          result.problematic.push({
            id: templateId,
            userId: userId,
            originalName: originalName,
            issue: `Error verificant existència: ${existError instanceof Error ? existError.message : String(existError)}`
          });
        }
      }
    }

    console.log(`\n[Storage Consistency] Resultat:`);
    console.log(`  - Plantilles escanejades: ${result.scanCount}`);
    console.log(`  - Plantilles reparades: ${result.fixed}`);
    console.log(`  - Plantilles amb problemes: ${result.problematic.length}`);

    return result;

  } catch (error) {
    console.error('[Storage Consistency] Error general:', error);
    throw error;
  }
}

/**
 * Funció per verificar si un placeholder DOCX pot ser regenerat
 * 
 * @param templateId ID de la plantilla
 * @returns Promise amb true si pot ser regenerat, false en cas contrari
 */
export async function canRegeneratePlaceholder(templateId: string): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Falten les variables d\'entorn necessàries per connectar amb Supabase');
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  try {
    // 1. Obtenir la informació de la plantilla
    const { data: template, error: templateError } = await supabase
      .from('plantilla_configs')
      .select('id, user_id, base_docx_storage_path, link_mappings, ai_instructions')
      .eq('id', templateId)
      .single();

    if (templateError) {
      console.error(`[canRegeneratePlaceholder] Error obtenint plantilla ${templateId}: ${templateError.message}`);
      return false;
    }

    // Comprovar requisits bàsics
    const hasLinkMappings = Array.isArray(template.link_mappings) && template.link_mappings.length > 0;
    const hasAiInstructions = Array.isArray(template.ai_instructions) && template.ai_instructions.length > 0;
    
    // Si no hi ha ni linkMappings ni aiInstructions, no cal regenerar
    if (!hasLinkMappings && !hasAiInstructions) {
      console.log(`[canRegeneratePlaceholder] Plantilla ${templateId} no té mappings ni instructions`);
      return false;
    }

    // Comprovar si tenim path o podem recuperar-lo
    let originalPathToUse = template.base_docx_storage_path;

    if (!originalPathToUse) {
      // Intent de recuperació
      const searchPath = `user-${template.user_id}/template-${templateId}/original`;
      
      const { data: fileList, error: listError } = await supabase.storage
        .from('template-docx')
        .list(searchPath);

      if (listError || !fileList || fileList.length === 0) {
        console.log(`[canRegeneratePlaceholder] No s'ha trobat cap fitxer a ${searchPath}`);
        return false;
      }

      // Buscar si hi ha algun fitxer .docx
      const docxFile = fileList.find(f => f.name.toLowerCase().endsWith('.docx'));
      
      if (!docxFile) {
        console.log(`[canRegeneratePlaceholder] No s'ha trobat cap fitxer .docx a ${searchPath}`);
        return false;
      }
      
      originalPathToUse = `${searchPath}/${docxFile.name}`;
    }

    // Verificar que el fitxer existeix a Storage
    if (originalPathToUse) {
      try {
        const { data } = await supabase.storage
          .from('template-docx')
          .getPublicUrl(originalPathToUse);
          
        return !!data && !!data.publicUrl;
      } catch (e) {
        console.error(`[canRegeneratePlaceholder] Error verificant fitxer a ${originalPathToUse}:`, e);
        return false;
      }
    }

    return false;
  } catch (error) {
    console.error('[canRegeneratePlaceholder] Error general:', error);
    return false;
  }
}
