/**
 * Utilitat per generar documents DOCX amb placeholders basant-se en IDs
 * 
 * Aquest mòdul implementa la generació de placeholders utilitzant els
 * identificadors únics dels paràgrafs (SDT IDs) en lloc de dependre de
 * la cerca de text, el que ofereix una precisió molt més alta.
 */

import * as JSZip from 'jszip';
import { DOMParser, XMLSerializer, Document as XMLDocument, Element as XMLElement } from '@xmldom/xmldom';
import { ExcelLinkMapping, AIInstruction } from '@/app/types';

/**
 * Genera un document DOCX amb placeholders basant-se en IDs de paràgrafs
 * Utilitza un sistema unificat de placeholders JSON per gestionar Excel, IA i combinacions
 * @param docxBuffer Buffer del document DOCX indexat amb SDTs
 * @param linkMappings Array de mappings d'Excel
 * @param aiInstructions Array d'instruccions d'IA
 * @returns Buffer del document DOCX amb els placeholders inserits
 */
export async function generatePlaceholderDocxWithIds(
  docxBuffer: Buffer,
  linkMappings: ExcelLinkMapping[],
  aiInstructions: AIInstruction[]
): Promise<Buffer> {
  console.log('[generatePlaceholderDocxWithIds] Inici de la generació amb placeholders JSON unificats');
  console.log(`[generatePlaceholderDocxWithIds] Mappings: ${linkMappings.length}, AI Instructions: ${aiInstructions.length}`);
  
  // Debug: Mostrar detalls dels mappings
  linkMappings.forEach((mapping, idx) => {
    console.log(`[generatePlaceholderDocxWithIds] LinkMapping ${idx}: ID="${mapping.paragraphId}", Text="${mapping.selectedText}", Header="${mapping.excelHeader}"`);
  });
  
  aiInstructions.forEach((instruction, idx) => {
    console.log(`[generatePlaceholderDocxWithIds] AIInstruction ${idx}: ID="${instruction.paragraphId}", Content="${instruction.content?.substring(0, 50)}..."`);
  });

  try {
    // Carregar el document DOCX
    const zip = await JSZip.loadAsync(docxBuffer);
    const documentXml = await zip.file('word/document.xml')?.async('string');

    if (!documentXml) {
      throw new Error('No s\'ha trobat el fitxer document.xml dins del DOCX');
    }

    // Debug: Mostrar els primers SDTs disponibles al document
    console.log('[generatePlaceholderDocxWithIds] Analitzant SDTs disponibles al document...');
    const availableSdts = extractAvailableSdtIds(documentXml);
    console.log(`[generatePlaceholderDocxWithIds] SDTs trobats (${availableSdts.length}):`, availableSdts.slice(0, 5).map(sdt => `"${sdt}"`).join(', ') + (availableSdts.length > 5 ? '...' : ''));

    // Parsear l'XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(documentXml, 'text/xml');

    // FASE 1: Agrupar mappings i instruccions per paragraphId
    console.log('[generatePlaceholderDocxWithIds] 📊 Agrupant dades per paràgraf...');
    const paragraphData = groupDataByParagraphId(linkMappings, aiInstructions);
    
    console.log(`[generatePlaceholderDocxWithIds] Paràgrafs detectats: ${Object.keys(paragraphData).length}`);
    Object.entries(paragraphData).forEach(([paragraphId, data]) => {
      console.log(`[generatePlaceholderDocxWithIds] Paràgraf ${paragraphId}: ${data.excelMappings.length} Excel + ${data.aiInstructions.length} IA`);
    });

    // FASE 2: Processar cada paràgraf i generar placeholders JSON
    let modificationsCount = 0;
    
    for (const [paragraphId, data] of Object.entries(paragraphData)) {
      console.log(`[generatePlaceholderDocxWithIds] 🔄 Processant paràgraf: ${paragraphId}`);
      
      // Trobar el paràgraf (primer per ID, després per text)
      const paragraphInfo = findParagraphByIdOrText(xmlDoc, paragraphId, data);
      
      if (!paragraphInfo.found || !paragraphInfo.paragraphElement) {
        console.log(`[generatePlaceholderDocxWithIds] ❌ No s'ha trobat el paràgraf ${paragraphId}`);
        continue;
      }
      
      // Generar el placeholder JSON unificat
      const jsonPlaceholder = generateUnifiedJsonPlaceholder(paragraphId, data, paragraphInfo.originalText);
      
      // Substituir tot el paràgraf pel placeholder JSON
      replaceAllTextInParagraph(paragraphInfo.paragraphElement, jsonPlaceholder, xmlDoc);
      
      modificationsCount++;
      console.log(`[generatePlaceholderDocxWithIds] ✅ Paràgraf substituït per placeholder JSON: ${paragraphId} (${paragraphInfo.method})`);
    }
    
    // Si no hem pogut aplicar cap substitució, afegir un placeholder de test
    // per verificar que el mecanisme funciona correctament
    if (modificationsCount === 0) {
      console.log(`[generatePlaceholderDocxWithIds] ⚠️ No s'ha aplicat cap substitució. Afegint placeholder de test...`);
      
      // Buscar el primer paràgraf que contingui text
      const paragraphs = xmlDoc.getElementsByTagName('w:p');
      let testApplied = false;
      
      for (let i = 0; i < paragraphs.length && !testApplied; i++) {
        const paragraph = paragraphs[i];
        
        if (paragraph && paragraph.getElementsByTagName('w:t').length > 0) {
          // Substituir el contingut del primer element w:t
          const textNode = paragraph.getElementsByTagName('w:t')[0];
          if (textNode && textNode.textContent && textNode.textContent.trim().length > 0) {
            textNode.textContent = "{{TEST_PLACEHOLDER}} " + textNode.textContent;
            testApplied = true;
            modificationsCount++;
            console.log(`[generatePlaceholderDocxWithIds] ✅ Afegit placeholder de test al paràgraf ${i + 1}`);
          }
        }
      }
    }
    
    console.log(`[generatePlaceholderDocxWithIds] Total modificacions aplicades: ${modificationsCount}`);
    
    // Serialitzar de nou el document XML
    const serializer = new XMLSerializer();
    const modifiedXml = serializer.serializeToString(xmlDoc);
    
    // Actualitzar el fitxer XML dins del ZIP
    zip.file('word/document.xml', modifiedXml);
    
    // Generar el nou document DOCX
    console.log(`[generatePlaceholderDocxWithIds] Generant buffer del document modificat...`);
    const placeholderBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    
    console.log(`[generatePlaceholderDocxWithIds] Document generat correctament (${placeholderBuffer.length} bytes)`);
    return placeholderBuffer;
  } catch (error) {
    console.error(`[generatePlaceholderDocxWithIds] ❌ Error generant el document amb placeholders:`, error);
    throw error;
  }
}

/**
 * Busca un element SDT pel seu ID
 * @param xmlDoc Document XML
 * @param id ID de l'SDT a buscar
 * @returns Element SDT si es troba, undefined si no
 */
function findSdtById(xmlDoc: XMLDocument, id: string): XMLElement | undefined {
  const allSdts = xmlDoc.getElementsByTagName('w:sdt');
  
  for (let i = 0; i < allSdts.length; i++) {
    const sdt = allSdts[i];
    const sdtProps = sdt.getElementsByTagName('w:sdtPr')[0];
    
    if (sdtProps) {
      const sdtTags = sdtProps.getElementsByTagName('w:tag');
      
      for (let j = 0; j < sdtTags.length; j++) {
        const tag = sdtTags[j];
        const tagVal = tag.getAttribute('w:val');
        
        if (tagVal === id) {
          return sdt;
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Obté el contingut del paràgraf dins d'un element SDT
 * @param sdt Element SDT
 * @returns Element de contingut del paràgraf, o undefined si no es troba
 */
function getParagraphContentFromSdt(sdt: XMLElement): XMLElement | undefined {
  const sdtContent = sdt.getElementsByTagName('w:sdtContent')[0];
  
  if (sdtContent) {
    const paragraphs = sdtContent.getElementsByTagName('w:p');
    
    if (paragraphs && paragraphs.length > 0) {
      return paragraphs[0];
    }
  }
  
  return undefined;
}

/**
 * Substitueix una part del text d'un paràgraf per un placeholder
 * @param paragraph Element del paràgraf
 * @param selectedText Text a substituir
 * @param placeholder Text del placeholder
 * @returns true si s'ha fet la substitució, false si no
 */
function replaceSelectedTextWithPlaceholder(paragraph: XMLElement, selectedText: string, placeholder: string): boolean {
  const textNodes = paragraph.getElementsByTagName('w:t');
  let fullText = '';
  
  // Recollir tot el text del paràgraf
  for (let i = 0; i < textNodes.length; i++) {
    fullText += textNodes[i].textContent || '';
  }
  
  // Verificar si el text seleccionat existeix dins del paràgraf
  if (fullText.indexOf(selectedText) === -1) {
    console.log(`[replaceSelectedTextWithPlaceholder] Text seleccionat no trobat: "${selectedText}" en "${fullText.substring(0, 50)}..."`);
    return false;
  }
  
  // Ara necessitem fer la substitució als nodes w:t que contenen el text
  let textRemaining = selectedText;
  let startNodeIndex = -1;
  let startPosition = -1;
  
  // Trobar el node d'inici i la posició
  for (let i = 0; i < textNodes.length && startNodeIndex === -1; i++) {
    const nodeText = textNodes[i].textContent || '';
    const position = nodeText.indexOf(textRemaining.substring(0, Math.min(textRemaining.length, nodeText.length)));
    
    if (position !== -1) {
      startNodeIndex = i;
      startPosition = position;
    }
  }
  
  if (startNodeIndex === -1) {
    // Text no trobat en cap node individual 
    // (podria estar dividit entre múltiples nodes)
    console.log(`[replaceSelectedTextWithPlaceholder] Text seleccionat dividit entre nodes: "${selectedText}"`);
    
    // Estratègia alternativa per a text dividit entre múltiples nodes
    // Aquí hi hauria d'haver una implementació més sofisticada
    return false;
  }
  
  // Fer la substitució al node inicial
  const startNode = textNodes[startNodeIndex];
  const nodeText = startNode.textContent || '';
  
  if (startPosition + selectedText.length <= nodeText.length) {
    // El text a substituir està completament dins d'aquest node
    startNode.textContent = 
      nodeText.substring(0, startPosition) + 
      placeholder + 
      nodeText.substring(startPosition + selectedText.length);
    return true;
  } else {
    // El text està dividit en múltiples nodes
    // Aquí hi hauria d'haver una implementació més sofisticada
    return false;
  }
}

/**
 * Substitueix tot el text d'un paràgraf per un placeholder
 * @param paragraph Element del paràgraf
 * @param placeholder Text del placeholder
 * @param xmlDoc Document XML per crear nous elements
 */
function replaceAllTextInParagraph(paragraph: XMLElement, placeholder: string, xmlDoc: XMLDocument): void {
  const textNodes = paragraph.getElementsByTagName('w:t');
  
  // Si hi ha almenys un node de text, substituïm el primer i esborrem la resta
  if (textNodes && textNodes.length > 0) {
    // Establir el placeholder al primer node
    textNodes[0].textContent = placeholder;
    
    // Esborrar la resta de nodes de text
    for (let i = 1; i < textNodes.length; i++) {
      textNodes[i].textContent = '';
    }
  } else {
    // Si no hi ha nodes de text, creem un de nou
    const runElement = paragraph.getElementsByTagName('w:r')[0] || paragraph.appendChild(xmlDoc.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'w:r'));
    const textElement = xmlDoc.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'w:t');
    textElement.textContent = placeholder;
    runElement.appendChild(textElement);
  }
}

/**
 * Extreu els IDs disponibles dels SDTs del document
 * @param documentXml Contingut XML del document
 * @returns Array amb els IDs dels SDTs disponibles
 */
function extractAvailableSdtIds(documentXml: string): string[] {
  const ids: string[] = [];
  
  // Regex per trobar els tags SDT amb w:val
  const sdtTagRegex = /<w:tag\s+w:val=["']([^"']+)["']/g;
  let match;
  
  while ((match = sdtTagRegex.exec(documentXml)) !== null) {
    ids.push(match[1]);
  }
  
  return ids;
}

// ============================================================================
// NOVES FUNCIONS PER AL SISTEMA UNIFICAT JSON
// ============================================================================

/**
 * Tipus de dades agrupades per paràgraf
 */
interface ParagraphData {
  excelMappings: ExcelLinkMapping[];
  aiInstructions: AIInstruction[];
  allSelectedTexts: string[];
}

/**
 * Informació trobada sobre un paràgraf
 */
interface ParagraphInfo {
  found: boolean;
  paragraphElement?: XMLElement;
  originalText: string;
  method: 'sdt' | 'text' | 'not_found';
}

/**
 * Estructura del placeholder JSON unificat
 */
interface UnifiedPlaceholder {
  paragraphId: string;
  type: 'excel_only' | 'ai_only' | 'combined';
  baseText?: string;
  baseTextWithPlaceholders?: string;
  aiInstruction?: string;
}

/**
 * Agrupa els linkMappings i aiInstructions per paragraphId
 * @param linkMappings Array de mappings d'Excel
 * @param aiInstructions Array d'instruccions d'IA
 * @returns Object amb dades agrupades per paragraphId
 */
function groupDataByParagraphId(
  linkMappings: ExcelLinkMapping[], 
  aiInstructions: AIInstruction[]
): Record<string, ParagraphData> {
  const grouped: Record<string, ParagraphData> = {};
  
  // Agrupar Excel mappings
  linkMappings.forEach(mapping => {
    const paragraphId = mapping.paragraphId;
    if (!paragraphId || !mapping.selectedText) return;
    
    if (!grouped[paragraphId]) {
      grouped[paragraphId] = {
        excelMappings: [],
        aiInstructions: [],
        allSelectedTexts: []
      };
    }
    
    grouped[paragraphId].excelMappings.push(mapping);
    grouped[paragraphId].allSelectedTexts.push(mapping.selectedText);
  });
  
  // Agrupar AI instructions
  aiInstructions.forEach(instruction => {
    const paragraphId = instruction.paragraphId;
    if (!paragraphId) return;
    
    if (!grouped[paragraphId]) {
      grouped[paragraphId] = {
        excelMappings: [],
        aiInstructions: [],
        allSelectedTexts: []
      };
    }
    
    grouped[paragraphId].aiInstructions.push(instruction);
  });
  
  return grouped;
}

/**
 * Troba un paràgraf per ID (SDT) o per text
 * @param xmlDoc Document XML
 * @param paragraphId ID del paràgraf
 * @param data Dades del paràgraf (per cercar per text si cal)
 * @returns Informació del paràgraf trobat
 */
function findParagraphByIdOrText(
  xmlDoc: XMLDocument, 
  paragraphId: string, 
  data: ParagraphData
): ParagraphInfo {
  // MÈTODE 1: Buscar per ID SDT
  const sdt = findSdtById(xmlDoc, paragraphId);
  if (sdt) {
    const paragraphContent = getParagraphContentFromSdt(sdt);
    if (paragraphContent) {
      const originalText = extractTextFromParagraph(paragraphContent);
      return {
        found: true,
        paragraphElement: paragraphContent,
        originalText,
        method: 'sdt'
      };
    }
  }
  
  // MÈTODE 2: Buscar per text (fallback)
  if (data.allSelectedTexts.length > 0) {
    const allParagraphs = xmlDoc.getElementsByTagName('w:p');
    
    for (let i = 0; i < allParagraphs.length; i++) {
      const paragraph = allParagraphs[i];
      const fullText = extractTextFromParagraph(paragraph);
      
      // Verificar si aquest paràgraf conté algun dels textos seleccionats
      const containsSelectedText = data.allSelectedTexts.some(selectedText => 
        fullText.includes(selectedText)
      );
      
      if (containsSelectedText) {
        return {
          found: true,
          paragraphElement: paragraph,
          originalText: fullText,
          method: 'text'
        };
      }
    }
  }
  
  return {
    found: false,
    originalText: '',
    method: 'not_found'
  };
}

/**
 * Extreu tot el text d'un paràgraf
 * @param paragraph Element del paràgraf
 * @returns Text complet del paràgraf
 */
function extractTextFromParagraph(paragraph: XMLElement): string {
  const textNodes = paragraph.getElementsByTagName('w:t');
  let fullText = '';
  
  for (let i = 0; i < textNodes.length; i++) {
    fullText += textNodes[i].textContent || '';
  }
  
  return fullText;
}

/**
 * Aplica els placeholders d'Excel a un text
 * @param text Text original
 * @param excelMappings Array de mappings d'Excel
 * @returns Text amb placeholders d'Excel aplicats
 */
function applyExcelPlaceholdersToText(text: string, excelMappings: ExcelLinkMapping[]): string {
  let textWithPlaceholders = text;
  
  // Aplicar cada mapping d'Excel
  excelMappings.forEach(mapping => {
    if (mapping.selectedText && mapping.excelHeader) {
      const placeholder = `{{${mapping.excelHeader}}}`;
      textWithPlaceholders = textWithPlaceholders.replace(mapping.selectedText, placeholder);
    }
  });
  
  return textWithPlaceholders;
}

/**
 * Genera un placeholder JSON unificat per a un paràgraf
 * @param paragraphId ID del paràgraf
 * @param data Dades del paràgraf (Excel + IA)
 * @param originalText Text original del paràgraf
 * @returns Placeholder JSON com a string
 */
function generateUnifiedJsonPlaceholder(
  paragraphId: string, 
  data: ParagraphData, 
  originalText: string
): string {
  const hasExcel = data.excelMappings.length > 0;
  const hasAI = data.aiInstructions.length > 0;
  
  let placeholder: UnifiedPlaceholder;
  
  if (hasExcel && hasAI) {
    // COMBINAT: Excel + IA
    placeholder = {
      paragraphId,
      type: 'combined',
      baseTextWithPlaceholders: applyExcelPlaceholdersToText(originalText, data.excelMappings),
      aiInstruction: data.aiInstructions[0].content || 'Processa aquest text segons les instruccions.'
    };
    console.log(`[generateUnifiedJsonPlaceholder] 🔗 Placeholder COMBINAT per ${paragraphId}`);
  } else if (hasExcel) {
    // NOMÉS EXCEL
    placeholder = {
      paragraphId,
      type: 'excel_only',
      baseTextWithPlaceholders: applyExcelPlaceholdersToText(originalText, data.excelMappings)
    };
    console.log(`[generateUnifiedJsonPlaceholder] 📊 Placeholder EXCEL per ${paragraphId}`);
  } else {
    // NOMÉS IA
    placeholder = {
      paragraphId,
      type: 'ai_only',
      baseText: originalText,
      aiInstruction: data.aiInstructions[0].content || 'Processa aquest text segons les instruccions.'
    };
    console.log(`[generateUnifiedJsonPlaceholder] 🤖 Placeholder IA per ${paragraphId}`);
  }
  
  // Convertir a JSON i encapsular
  const jsonString = JSON.stringify(placeholder, null, 0);
  return `{{UNIFIED_PLACEHOLDER:${jsonString}}}`;
}
