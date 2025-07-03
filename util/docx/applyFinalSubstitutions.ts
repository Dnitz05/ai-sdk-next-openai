import { readDocxFromStorage } from './readDocxFromStorage';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

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
    // STEP 1: Llegir document plantilla
    const templateBuffer = await readDocxFromStorage(templateDocumentPath);
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '', // Retorna string buit per placeholders no trobats
    });

    // STEP 2: Preparar dades de substitució combinades
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

    // STEP 3: Aplicar substitucions
    doc.setData(substitutionData);
    doc.render();

    // STEP 4: Retornar document final
    const finalBuffer = doc.getZip().generate({ type: 'nodebuffer' });
    console.log(`[applyFinalSubstitutions] ✅ Substitucions aplicades correctament. Mida final: ${finalBuffer.length} bytes`);
    
    return finalBuffer;

  } catch (error: any) {
    console.error(`[applyFinalSubstitutions] Error aplicant substitucions:`, error.message);
    throw new Error(`Error en substitucions finals: ${error.message}`);
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
