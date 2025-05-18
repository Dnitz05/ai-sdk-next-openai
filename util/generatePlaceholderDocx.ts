import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { DOMParser, XMLSerializer } from 'xmldom';

/**
 * Interfície per a les associacions Excel
 */
interface ExcelLinkMapping {
  id: string;
  paragraphId?: string;
  selectedText?: string;
  excelHeader?: string;
}

/**
 * Interfície per a les instruccions IA
 */
interface AIInstruction {
  id?: string;
  paragraphId?: string;
  content?: string;
  prompt?: string;
}

/**
 * Genera un nou DOCX substituint el contingut dels paràgrafs amb placeholders.
 * 
 * @param originalBuffer Buffer del document DOCX original
 * @param linkMappings Associacions entre paràgrafs i cel·les Excel
 * @param aiInstructions Instruccions d'IA per a paràgrafs específics
 * @returns Buffer del document DOCX amb placeholders
 */
export async function generatePlaceholderDocx(
  originalBuffer: Buffer,
  linkMappings: ExcelLinkMapping[],
  aiInstructions: AIInstruction[]
): Promise<Buffer> {
  // Validació inicial
  if (!originalBuffer || originalBuffer.length === 0) {
    throw new Error('Buffer DOCX original buit o invàlid');
  }

  console.log("[generatePlaceholderDocx] Iniciant generació amb:", {
    bufferLength: originalBuffer.length,
    linkMappingsCount: linkMappings?.length || 0,
    aiInstructionsCount: aiInstructions?.length || 0
  });

  try {
    // Carregar el document amb PizZip
    const zip = new PizZip(originalBuffer);
    
    // Extracte el document.xml del DOCX
    const documentXml = zip.files['word/document.xml'].asText();
    
    // Parsear el XML per poder-lo manipular
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(documentXml, 'text/xml');
    
    // Identificar tots els paràgrafs (elements <w:p>)
    const paragraphs = xmlDoc.getElementsByTagName('w:p');
    console.log(`[generatePlaceholderDocx] Document conté ${paragraphs.length} paràgrafs`);
    
    let modificacions = 0;
    let selectionFound = 0;
    
    // Processar les associacions Excel
    if (Array.isArray(linkMappings) && linkMappings.length > 0) {
      console.log("[generatePlaceholderDocx] Processant associacions Excel...");
      
      // Crear un mapa per accés més eficient
      const paragraphTextMap = createParagraphTextMap(paragraphs);
      
      for (const mapping of linkMappings) {
        if (!mapping.id) continue;
        
        let paragraphFound = false;
        
        // Estratègia 1: Buscar per selectedText si està disponible
        if (mapping.selectedText) {
          // Buscar el text seleccionat en els paràgrafs
          for (let i = 0; i < paragraphs.length; i++) {
            const paragraphText = paragraphTextMap[i]?.toLowerCase() || '';
            if (paragraphText.includes(mapping.selectedText.toLowerCase())) {
              // Substituir el paràgraf
              replaceWithPlaceholder(
                paragraphs[i], 
                `[EXCEL_LINK: ${mapping.excelHeader || 'Dades Excel'} (ID: ${mapping.id})]`
              );
              paragraphFound = true;
              selectionFound++;
              modificacions++;
              break;
            }
          }
        }
        
        // Estratègia 2: Usar paragraphId si existeix i selectedText no va funcionar
        if (!paragraphFound && mapping.paragraphId) {
          // Buscar per ID directament en metadades o provat de trobar per posició
          // Aquesta és una implementació més simple, però es pot millorar segons els patrons de la teva app
          const paragraphIndex = parseInt(mapping.paragraphId.replace('p', ''), 10);
          if (!isNaN(paragraphIndex) && paragraphIndex >= 0 && paragraphIndex < paragraphs.length) {
            replaceWithPlaceholder(
              paragraphs[paragraphIndex], 
              `[EXCEL_LINK: ${mapping.excelHeader || 'Dades Excel'} (ID: ${mapping.id})]`
            );
            modificacions++;
          }
        }
      }
      
      console.log(`[generatePlaceholderDocx] S'han trobat ${selectionFound} de ${linkMappings.length} textos seleccionats.`);
    }
    
    // Processar les instruccions IA
    if (Array.isArray(aiInstructions) && aiInstructions.length > 0) {
      console.log("[generatePlaceholderDocx] Processant instruccions IA...");
      
      for (const instr of aiInstructions) {
        if (!instr.id && !instr.paragraphId) continue;
        
        const paragraphId = instr.paragraphId || (instr.id ? `p${instr.id}` : '');
        const content = instr.content || instr.prompt || 'Instrucció IA';
        
        // Intent de trobar el paràgraf per ID
        if (paragraphId) {
          // Intentar extreure un número del paragraphId
          const paragraphIndex = parseInt(paragraphId.replace(/\D/g, ''), 10);
          if (!isNaN(paragraphIndex) && paragraphIndex >= 0 && paragraphIndex < paragraphs.length) {
            replaceWithPlaceholder(
              paragraphs[paragraphIndex], 
              `[AI_INSTRUCTION: ${truncateText(content, 30)} (ID: ${instr.id || paragraphId})]`
            );
            modificacions++;
          }
        }
      }
    }
    
    console.log(`[generatePlaceholderDocx] Total modificacions: ${modificacions}`);
    
    // Convertir el XML modificat de tornada a text
    const serializer = new XMLSerializer();
    const modifiedXml = serializer.serializeToString(xmlDoc);
    
    // Actualitzar el ZIP amb el nou XML
    zip.file('word/document.xml', modifiedXml);
    
    // Generar el buffer de sortida
    const out = zip.generate({ type: 'nodebuffer' });
    console.log("[generatePlaceholderDocx] Document generat correctament, mida:", out.length);
    
    return out as Buffer;
  } catch (error) {
    console.error("[generatePlaceholderDocx] Error processant document:", error);
    throw new Error(`Error en generatePlaceholderDocx: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Reemplaça el contingut d'un paràgraf amb un text placeholder
 */
function replaceWithPlaceholder(paragraph: Element, placeholderText: string) {
  // Eliminar tots els elements fills del paràgraf
  while (paragraph.firstChild) {
    paragraph.removeChild(paragraph.firstChild);
  }
  
  // Crear elements necessaris per a un text en un paràgraf DOCX
  const run = paragraph.ownerDocument.createElement('w:r');
  const text = paragraph.ownerDocument.createElement('w:t');
  
  // Establir el text del placeholder
  text.textContent = placeholderText;
  
  // Assegurar-se que el text preserva espais
  text.setAttribute('xml:space', 'preserve');
  
  // Construir l'estructura: <w:p><w:r><w:t>Placeholder</w:t></w:r></w:p>
  run.appendChild(text);
  paragraph.appendChild(run);
}

/**
 * Crea un mapa que conté el text de cada paràgraf per a una cerca més eficient
 */
function createParagraphTextMap(paragraphs: NodeListOf<Element>): Record<number, string> {
  const map: Record<number, string> = {};
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    
    // Buscar tots els elements de text dins d'aquest paràgraf
    const textElements = paragraph.getElementsByTagName('w:t');
    let fullText = '';
    
    // Concatenar tots els fragments de text
    for (let j = 0; j < textElements.length; j++) {
      fullText += (textElements[j].textContent || '');
    }
    
    map[i] = fullText;
  }
  
  return map;
}

/**
 * Trunca un text a una longitud màxima, afegint "..." si és necessari
 */
function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
}
