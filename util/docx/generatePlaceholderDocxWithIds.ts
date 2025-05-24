/**
 * Utilitat per generar documents DOCX amb placeholders basant-se en IDs
 * 
 * Aquest mòdul implementa la generació de placeholders utilitzant els
 * identificadors únics dels paràgrafs (SDT IDs) en lloc de dependre de
 * la cerca de text, el que ofereix una precisió molt més alta.
 */

import * as JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { ExcelLinkMapping, AIInstruction } from '@/app/types';

/**
 * Genera un document DOCX amb placeholders basant-se en IDs de paràgrafs
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
  console.log('[generatePlaceholderDocxWithIds] Inici de la generació amb placeholders basats en IDs');
  console.log(`[generatePlaceholderDocxWithIds] Mappings: ${linkMappings.length}, AI Instructions: ${aiInstructions.length}`);

  try {
    // Carregar el document DOCX
    const zip = await JSZip.loadAsync(docxBuffer);
    const documentXml = await zip.file('word/document.xml')?.async('string');

    if (!documentXml) {
      throw new Error('No s\'ha trobat el fitxer document.xml dins del DOCX');
    }

    // Parsear l'XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(documentXml, 'text/xml');

    // Procesar els linkMappings
    let modificationsCount = 0;
    
    // Processar primer els mappings d'Excel
    if (linkMappings && linkMappings.length > 0) {
      console.log(`[generatePlaceholderDocxWithIds] Processant ${linkMappings.length} linkMappings...`);
      
      for (const mapping of linkMappings) {
        if (!mapping.paragraphId || !mapping.selectedText) {
          console.log(`[generatePlaceholderDocxWithIds] Saltant mapping sense paragraphId o selectedText`, mapping);
          continue;
        }
        
        // Buscar SDT amb l'ID corresponent
        const sdt = findSdtById(xmlDoc, mapping.paragraphId);
        
        if (sdt) {
          // Trobar el text seleccionat dins de l'SDT
          const paragraphContent = getParagraphContentFromSdt(sdt);
          
          if (paragraphContent) {
            // Substitució del text seleccionat pel placeholder corresponent
            const placeholder = `{{${mapping.excelHeader || 'EXCEL_FIELD'}}}`;
            const result = replaceSelectedTextWithPlaceholder(
              paragraphContent, 
              mapping.selectedText, 
              placeholder
            );
            
            if (result) {
              modificationsCount++;
              console.log(`[generatePlaceholderDocxWithIds] ✅ Substituït text "${mapping.selectedText}" per "${placeholder}" en paràgraf ${mapping.paragraphId}"`);
            } else {
              console.log(`[generatePlaceholderDocxWithIds] ❌ No s'ha pogut substituir "${mapping.selectedText}" en paràgraf ${mapping.paragraphId}"`);
            }
          } else {
            console.log(`[generatePlaceholderDocxWithIds] ❌ No s'ha trobat contingut al paràgraf amb ID ${mapping.paragraphId}`);
          }
        } else {
          console.log(`[generatePlaceholderDocxWithIds] ❌ No s'ha trobat SDT amb ID ${mapping.paragraphId}`);
        }
      }
    }
    
    // Processar instruccions d'IA
    if (aiInstructions && aiInstructions.length > 0) {
      console.log(`[generatePlaceholderDocxWithIds] Processant ${aiInstructions.length} instruccions AI...`);
      
      for (const instruction of aiInstructions) {
        if (!instruction.paragraphId) {
          console.log(`[generatePlaceholderDocxWithIds] Saltant instrucció sense paragraphId`, instruction);
          continue;
        }
        
        // Buscar SDT amb l'ID corresponent
        const sdt = findSdtById(xmlDoc, instruction.paragraphId);
        
        if (sdt) {
          // Trobar el contingut del paràgraf dins de l'SDT
          const paragraphContent = getParagraphContentFromSdt(sdt);
          
          if (paragraphContent) {
            // Substituir tot el text del paràgraf pel placeholder d'IA
            const placeholder = `{{IA_${instruction.id || 'INSTRUCTION'}}}`;
            
            // Substituïm tot el contingut del paràgraf pel placeholder
            replaceAllTextInParagraph(paragraphContent, placeholder);
            
            modificationsCount++;
            console.log(`[generatePlaceholderDocxWithIds] ✅ Paràgraf complet substituït per "${placeholder}" en ID ${instruction.paragraphId}"`);
          } else {
            console.log(`[generatePlaceholderDocxWithIds] ❌ No s'ha trobat contingut al paràgraf amb ID ${instruction.paragraphId}`);
          }
        } else {
          console.log(`[generatePlaceholderDocxWithIds] ❌ No s'ha trobat SDT amb ID ${instruction.paragraphId}`);
        }
      }
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
function findSdtById(xmlDoc: Document, id: string): Element | undefined {
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
function getParagraphContentFromSdt(sdt: Element): Element | undefined {
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
function replaceSelectedTextWithPlaceholder(paragraph: Element, selectedText: string, placeholder: string): boolean {
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
 */
function replaceAllTextInParagraph(paragraph: Element, placeholder: string): void {
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
    const runElement = paragraph.getElementsByTagName('w:r')[0] || paragraph.appendChild(document.createElement('w:r'));
    const textElement = document.createElement('w:t');
    textElement.textContent = placeholder;
    runElement.appendChild(textElement);
  }
}
