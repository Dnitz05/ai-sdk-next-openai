import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

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
 * Implementació basada en manipulació directa de XML per màxima compatibilitat.
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
    
    // Extreure directament el document.xml del DOCX
    let documentXml = zip.files['word/document.xml'].asText();
    console.log(`[generatePlaceholderDocx] Document XML extret, mida: ${documentXml.length} bytes`);
    
    let modificacions = 0;
    let substitucions = {
      exitoses: 0,
      fallides: 0
    };
    
    // Processar les associacions Excel a nivell de text XML
    if (Array.isArray(linkMappings) && linkMappings.length > 0) {
      console.log("[generatePlaceholderDocx] Processant associacions Excel...");
      
      for (const mapping of linkMappings) {
        if (!mapping.id) continue;
        
        // Si tenim text seleccionat, l'utilitzem per trobar el paràgraf
        if (mapping.selectedText && mapping.selectedText.length > 3) {
          const normalizedSearchText = normalizeTextForSearch(mapping.selectedText);
          console.log(`[generatePlaceholderDocx] Cercant text: "${normalizedSearchText.substring(0, 30)}${normalizedSearchText.length > 30 ? '...' : ''}"`);
          
          // Regex més robusta per trobar el paràgraf sencer que conté el text, preservant propietats
          // Nota: Escapem el text seleccionat per evitar problemes amb caràcters especials en regex
          const escapedText = escapeRegExp(normalizedSearchText);
          
          // La regex cerca:
          // 1. Inici del paràgraf amb tots els seus atributs (<w:p ...>)
          // 2. Opcionalment les propietats del paràgraf (<w:pPr>...</w:pPr>)
          // 3. El contingut que conté el text seleccionat
          // 4. Final del paràgraf (</w:p>)
          const paragraphRegex = new RegExp(
            `(<w:p[^>]*>(?:<w:pPr>.*?</w:pPr>)?)([\\s\\S]*?${escapedText}[\\s\\S]*?)(</w:p>)`,
            'i'
          );
          
          // Intentem trobar i substituir
          const originalXmlLength = documentXml.length;
          
          documentXml = documentXml.replace(paragraphRegex, (match, startTag, content, endTag) => {
            // Creem un nou paràgraf que manté les propietats però substitueix el contingut
            const placeholderText = `[EXCEL_LINK: ${mapping.excelHeader || 'Dades Excel'} (ID: ${mapping.id})]`;
            const replacement = `${startTag}<w:r><w:t xml:space="preserve">${placeholderText}</w:t></w:r>${endTag}`;
            console.log(`[generatePlaceholderDocx] Substituint paràgraf per placeholder Excel: "${placeholderText}"`);
            return replacement;
          });
          
          // Comprovar si s'ha fet alguna substitució
          if (documentXml.length !== originalXmlLength) {
            modificacions++;
            substitucions.exitoses++;
            console.log(`[generatePlaceholderDocx] ✅ Substitució exitosa per Excel ID: ${mapping.id}`);
          } else {
            substitucions.fallides++;
            console.log(`[generatePlaceholderDocx] ❌ No s'ha trobat text coincident per Excel ID: ${mapping.id}`);
            
            // Intent alternatiu: buscar text amb menys restriccions
            console.log(`[generatePlaceholderDocx] Intent alternatiu de cerca...`);
            // Simplifiquem encara més el text per buscar només una part significativa
            let simplifiedSearch = normalizedSearchText;
            if (simplifiedSearch.length > 20) {
              simplifiedSearch = simplifiedSearch.substring(0, 20);
              console.log(`[generatePlaceholderDocx] Utilitzant substring: "${simplifiedSearch}"`);
            }
            
            const simpleRegex = new RegExp(
              `(<w:p[^>]*>(?:<w:pPr>.*?</w:pPr>)?)([\\s\\S]*?${escapeRegExp(simplifiedSearch)}[\\s\\S]*?)(</w:p>)`,
              'i'
            );
            
            const simpleLength = documentXml.length;
            documentXml = documentXml.replace(simpleRegex, (match, startTag, content, endTag) => {
              const placeholderText = `[EXCEL_LINK: ${mapping.excelHeader || 'Dades Excel'} (ID: ${mapping.id})]`;
              console.log(`[generatePlaceholderDocx] Intent alternatiu - substituint per: "${placeholderText}"`);
              return `${startTag}<w:r><w:t xml:space="preserve">${placeholderText}</w:t></w:r>${endTag}`;
            });
            
            if (documentXml.length !== simpleLength) {
              modificacions++;
              substitucions.exitoses++;
              console.log(`[generatePlaceholderDocx] ✅ Substitució alternativa exitosa per Excel ID: ${mapping.id}`);
            }
          }
        } 
        // Alternativament, usem paragraphId si està disponible
        else if (mapping.paragraphId) {
          console.log(`[generatePlaceholderDocx] Utilitzant paragraphId: ${mapping.paragraphId}`);
          
          // Buscar paràgrafs per posició (estratègia imperfecta però pot funcionar en alguns casos)
          const paragraphNum = parseInt(mapping.paragraphId.replace(/\D/g, ''), 10);
          if (!isNaN(paragraphNum)) {
            // Trobar tots els paràgrafs al document
            const paragraphMatches = documentXml.match(/<w:p[^>]*>[\s\S]*?<\/w:p>/g);
            
            if (paragraphMatches && paragraphNum < paragraphMatches.length) {
              console.log(`[generatePlaceholderDocx] Trobat paràgraf #${paragraphNum} de ${paragraphMatches.length}`);
              
              const paragraph = paragraphMatches[paragraphNum];
              const placeholderText = `[EXCEL_LINK: ${mapping.excelHeader || 'Dades Excel'} (ID: ${mapping.id})]`;
              
              // Dividir el paràgraf per mantenir les propietats
              const startTagMatch = paragraph.match(/(<w:p[^>]*>(?:<w:pPr>.*?<\/w:pPr>)?)/);
              const endTagMatch = paragraph.match(/(<\/w:p>)$/);
              
              if (startTagMatch && endTagMatch) {
                const startTag = startTagMatch[1];
                const endTag = endTagMatch[1];
                
                const replacement = `${startTag}<w:r><w:t xml:space="preserve">${placeholderText}</w:t></w:r>${endTag}`;
                
                // Escapar caràcters especials en el paràgraf per substituir-lo exactament
                const escapedParagraph = escapeRegExp(paragraph);
                documentXml = documentXml.replace(new RegExp(escapedParagraph, 'g'), replacement);
                
                modificacions++;
                substitucions.exitoses++;
                console.log(`[generatePlaceholderDocx] ✅ Substitució per ID exitosa per Excel ID: ${mapping.id}`);
              }
            }
          }
        }
      }
    }
    
    // Processar les instruccions IA
    if (Array.isArray(aiInstructions) && aiInstructions.length > 0) {
      console.log("[generatePlaceholderDocx] Processant instruccions IA...");
      
      for (const instr of aiInstructions) {
        if (!instr.id && !instr.paragraphId) continue;
        
        const content = instr.content || instr.prompt || 'Instrucció IA';
        const paragraphId = instr.paragraphId || '';
        
        // Utilitzem una estratègia similar a la de Excel, però amb contingut específic per a IA
        if (paragraphId) {
          console.log(`[generatePlaceholderDocx] Utilitzant paragraphId per IA: ${paragraphId}`);
          
          // Buscar per posició
          const paragraphNum = parseInt(paragraphId.replace(/\D/g, ''), 10);
          if (!isNaN(paragraphNum)) {
            const paragraphMatches = documentXml.match(/<w:p[^>]*>[\s\S]*?<\/w:p>/g);
            
            if (paragraphMatches && paragraphNum < paragraphMatches.length) {
              const paragraph = paragraphMatches[paragraphNum];
              const placeholderText = `[AI_INSTRUCTION: ${truncateText(content, 30)} (ID: ${instr.id || paragraphId})]`;
              
              const startTagMatch = paragraph.match(/(<w:p[^>]*>(?:<w:pPr>.*?<\/w:pPr>)?)/);
              const endTagMatch = paragraph.match(/(<\/w:p>)$/);
              
              if (startTagMatch && endTagMatch) {
                const startTag = startTagMatch[1];
                const endTag = endTagMatch[1];
                
                const replacement = `${startTag}<w:r><w:t xml:space="preserve">${placeholderText}</w:t></w:r>${endTag}`;
                const escapedParagraph = escapeRegExp(paragraph);
                documentXml = documentXml.replace(new RegExp(escapedParagraph, 'g'), replacement);
                
                modificacions++;
                console.log(`[generatePlaceholderDocx] ✅ Substitució per ID exitosa per IA ID: ${instr.id || paragraphId}`);
              }
            }
          }
        }
      }
    }
    
    console.log(`[generatePlaceholderDocx] Resum de modificacions: ${modificacions} total`);
    console.log(`[generatePlaceholderDocx] Substitucions: ${substitucions.exitoses} exitoses, ${substitucions.fallides} fallides`);
    
    // Actualitzar el ZIP amb el nou XML
    zip.file('word/document.xml', documentXml);
    
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
 * Normalitza un text per fer-lo més fàcil de trobar al document
 * Elimina espais redundants, caràcters especials, etc.
 */
function normalizeTextForSearch(text: string): string {
  if (!text) return '';
  
  // Eliminar caràcters que poden causar problemes en la cerca
  return text
    .replace(/\s+/g, ' ')       // Reduir múltiples espais a un sol
    .replace(/[\r\n]+/g, ' ')   // Reemplaçar salts de línia per espais
    .trim()                     // Eliminar espais al principi i final
    .toLowerCase();             // Convertir a minúscules per fer la cerca case-insensitive
}

/**
 * Escapa caràcters especials en una cadena per utilitzar-la en una expressió regular
 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Trunca un text a una longitud màxima, afegint "..." si és necessari
 */
function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
}
