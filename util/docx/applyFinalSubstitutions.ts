import { readDocxFromStorage } from './readDocxFromStorage';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import mammoth from 'mammoth';

/**
 * Valida que un buffer és un ZIP vàlid (DOCX és un format ZIP)
 */
function validateDocxBuffer(buffer: Buffer): { isValid: boolean; error?: string } {
  try {
    // Verificar mida mínima
    if (buffer.length < 100) {
      return { isValid: false, error: `Buffer massa petit: ${buffer.length} bytes` };
    }

    // Verificar signatura ZIP (PK)
    const uint8Array = new Uint8Array(buffer);
    if (uint8Array[0] !== 0x50 || uint8Array[1] !== 0x4B) {
      return { isValid: false, error: 'No és un fitxer ZIP vàlid (signatura incorrecta)' };
    }

    // Intentar crear PizZip per validar estructura
    try {
      new PizZip(buffer);
      return { isValid: true };
    } catch (zipError: any) {
      return { isValid: false, error: `Estructura ZIP invàlida: ${zipError.message}` };
    }

  } catch (error: any) {
    return { isValid: false, error: `Error validant buffer: ${error.message}` };
  }
}

/**
 * Aplica substitucions finals al document plantilla
 * - Substitueix placeholders [AI_INSTRUCTION: ...] pel contingut generat
 * - Substitueix placeholders [EXCEL_LINK: ...] per dades de l'Excel
 * 
 * @param templateDocumentPath Path del document amb placeholders
 * @param generatedContent Mapa de placeholder_id -> contingut generat
 * @param excelData Dades de l'Excel per la fila actual
 * @returns Buffer del document final
 */
export async function applyFinalSubstitutions(
  templateDocumentPath: string,
  generatedContent: { [placeholder_id: string]: string },
  excelData: { [key: string]: any }
): Promise<Buffer> {
  
  console.log(`[applyFinalSubstitutions] Iniciant substitucions al document: ${templateDocumentPath}`);
  console.log(`[applyFinalSubstitutions] Contingut generat disponible:`, Object.keys(generatedContent));
  console.log(`[applyFinalSubstitutions] Dades Excel disponibles:`, Object.keys(excelData));

  try {
    // STEP 1: Llegir document plantilla amb validació robusta
    console.log(`[applyFinalSubstitutions] Descarregant document des de: ${templateDocumentPath}`);
    const templateBuffer = await readDocxFromStorage(templateDocumentPath);
    
    // STEP 1.5: Validar buffer abans de processar
    console.log(`[applyFinalSubstitutions] Validant buffer descarregat (${templateBuffer.length} bytes)...`);
    const validation = validateDocxBuffer(templateBuffer);
    
    if (!validation.isValid) {
      console.error(`[applyFinalSubstitutions] ❌ Buffer invàlid: ${validation.error}`);
      throw new Error(`Document DOCX corrupte o invàlid: ${validation.error}`);
    }
    
    console.log(`[applyFinalSubstitutions] ✅ Buffer validat correctament`);

    // STEP 2: Intentar processar amb Docxtemplater (mètode principal)
    try {
      console.log(`[applyFinalSubstitutions] Intentant processar amb Docxtemplater...`);
      
      const zip = new PizZip(templateBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => '', // Retorna string buit per placeholders no trobats
      });

      // Preparar dades de substitució combinades
      const substitutionData = {
        // Contingut generat per la IA
        ...generatedContent,
        // Dades de l'Excel (amb prefix per evitar conflictes)
        ...Object.keys(excelData).reduce((acc, key) => {
          acc[`EXCEL_${key}`] = excelData[key];
          return acc;
        }, {} as { [key: string]: any })
      };

      console.log(`[applyFinalSubstitutions] Dades de substitució preparades:`, Object.keys(substitutionData));

      // Aplicar substitucions
      doc.setData(substitutionData);
      doc.render();

      // Generar document final
      const finalBuffer = doc.getZip().generate({ type: 'nodebuffer' });
      console.log(`[applyFinalSubstitutions] ✅ Substitucions aplicades amb Docxtemplater. Mida final: ${finalBuffer.length} bytes`);
      
      return finalBuffer;

    } catch (docxtemplaterError: any) {
      console.warn(`[applyFinalSubstitutions] ⚠️ Docxtemplater ha fallat: ${docxtemplaterError.message}`);
      console.log(`[applyFinalSubstitutions] Intentant fallback amb substitució de text...`);
      
      // FALLBACK: Utilitzar substitució de text simple
      return await applyTextSubstitutionsFallback(templateBuffer, generatedContent, excelData);
    }

  } catch (error: any) {
    console.error(`[applyFinalSubstitutions] ❌ Error crític aplicant substitucions:`, error.message);
    console.error(`[applyFinalSubstitutions] Stack trace:`, error.stack);
    throw new Error(`Error en substitucions finals: ${error.message}`);
  }
}

/**
 * Fallback per quan Docxtemplater falla - utilitza mammoth per extreure text i fer substitucions
 */
async function applyTextSubstitutionsFallback(
  templateBuffer: Buffer,
  generatedContent: { [placeholder_id: string]: string },
  excelData: { [key: string]: any }
): Promise<Buffer> {
  
  console.log(`[applyTextSubstitutionsFallback] Iniciant substitució de text com a fallback`);

  try {
    // Extreure text del DOCX amb mammoth
    const { value: extractedText } = await mammoth.extractRawText({ buffer: templateBuffer });
    console.log(`[applyTextSubstitutionsFallback] Text extret: ${extractedText.length} caràcters`);

    let processedText = extractedText;

    // Substituir placeholders AI_INSTRUCTION
    for (const [placeholderId, content] of Object.entries(generatedContent)) {
      const placeholder = `[AI_INSTRUCTION: ${placeholderId}]`;
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      processedText = processedText.replace(regex, content);
      console.log(`[applyTextSubstitutionsFallback] Substituït placeholder: ${placeholder}`);
    }

    // Substituir placeholders EXCEL_LINK
    for (const [key, value] of Object.entries(excelData)) {
      const placeholder = `[EXCEL_LINK: ${key}]`;
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      processedText = processedText.replace(regex, String(value || ''));
      console.log(`[applyTextSubstitutionsFallback] Substituït placeholder Excel: ${placeholder}`);
    }

    // Retornar com a text pla (no és ideal, però funcional)
    const resultBuffer = Buffer.from(processedText, 'utf8');
    console.log(`[applyTextSubstitutionsFallback] ✅ Substitucions de text completades. Mida final: ${resultBuffer.length} bytes`);
    
    return resultBuffer;

  } catch (fallbackError: any) {
    console.error(`[applyTextSubstitutionsFallback] ❌ Error en fallback:`, fallbackError.message);
    throw new Error(`Error en fallback de substitucions: ${fallbackError.message}`);
  }
}

/**
 * Substitució alternativa per documents simples que usen text pla
 * (backup si Docxtemplater no funciona amb el format específic)
 */
export async function applyTextSubstitutions(
  templateDocumentPath: string,
  generatedContent: { [placeholder_id: string]: string },
  excelData: { [key: string]: any }
): Promise<Buffer> {
  
  console.log(`[applyTextSubstitutions] Aplicant substitucions de text pla al document: ${templateDocumentPath}`);

  try {
    const templateBuffer = await readDocxFromStorage(templateDocumentPath);
    let templateText = templateBuffer.toString('utf8');

    // Substituir placeholders AI_INSTRUCTION
    for (const [placeholderId, content] of Object.entries(generatedContent)) {
      const placeholder = `[AI_INSTRUCTION: ${placeholderId}]`;
      templateText = templateText.replace(new RegExp(placeholder, 'g'), content);
    }

    // Substituir placeholders EXCEL_LINK
    for (const [key, value] of Object.entries(excelData)) {
      const placeholder = `[EXCEL_LINK: ${key}]`;
      templateText = templateText.replace(new RegExp(placeholder, 'g'), String(value || ''));
    }

    console.log(`[applyTextSubstitutions] ✅ Substitucions de text aplicades correctament`);
    return Buffer.from(templateText, 'utf8');

  } catch (error: any) {
    console.error(`[applyTextSubstitutions] Error en substitucions de text:`, error.message);
    throw new Error(`Error en substitucions de text: ${error.message}`);
  }
}
