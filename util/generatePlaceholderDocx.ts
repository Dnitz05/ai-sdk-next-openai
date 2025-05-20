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
  originalParagraphText?: string; // Text original del paràgraf per fer la cerca més precisa
}

// Funció per mostrar un log amb més detall del que ofereix console.log
function debugLog(context: string, message: string, data?: any) {
  const timestamp = new Date().toISOString().substring(11, 23); // HH:MM:SS.mmm format
  console.log(`[${timestamp}] [DEBUG:${context}] ${message}`);
  if (data !== undefined) {
    if (typeof data === 'string' && data.length > 500) {
      console.log(`[${timestamp}] [DEBUG:${context}] Dades (primers 500 caràcters):`, data.substring(0, 500) + '...');
    } else {
      console.log(`[${timestamp}] [DEBUG:${context}] Dades:`, data);
    }
  }
}

/**
 * Genera un nou DOCX substituint el contingut dels paràgrafs amb placeholders.
 * Implementació basada en manipulació directa de XML per màxima compatibilitat.
 * 
 * Millores implementades:
 * 1. Preservació d'estils i estructura dels paràgrafs
 * 2. Algoritme robust per trobar text fragmentat en múltiples <w:t>
 * 3. Manteniment dels encapçalaments i formatació
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

  // Logging detallat dels mappings per millorar la resolució de problemes
  if (Array.isArray(linkMappings) && linkMappings.length > 0) {
    for (let i = 0; i < linkMappings.length; i++) {
      const mapping = linkMappings[i];
      debugLog('MAPPING', `Mapping #${i+1}:`, {
        id: mapping.id,
        selectedText: mapping.selectedText ? 
          `${mapping.selectedText.substring(0, 30)}${mapping.selectedText.length > 30 ? '...' : ''}` : 'N/A',
        selectedTextLength: mapping.selectedText?.length || 0,
        excelHeader: mapping.excelHeader,
        paragraphId: mapping.paragraphId || 'N/A'
      });
    }
  }

  if (Array.isArray(aiInstructions) && aiInstructions.length > 0) {
    for (let i = 0; i < aiInstructions.length; i++) {
      const instr = aiInstructions[i];
      debugLog('AI_INSTR', `Instrucció IA #${i+1}:`, {
        id: instr.id || 'N/A',
        paragraphId: instr.paragraphId || 'N/A',
        contentLength: (instr.content || instr.prompt || '').length,
        contentPreview: truncateText(instr.content || instr.prompt || '', 50),
        hasOriginalText: !!instr.originalParagraphText,
        originalTextLength: instr.originalParagraphText?.length || 0,
        originalTextPreview: instr.originalParagraphText ? 
          truncateText(instr.originalParagraphText, 50) : 'N/A'
      });
    }
  }

  try {
    // Carregar el document amb PizZip
    const zip = new PizZip(originalBuffer);
    
    // Extreure tots els arxius per entendre l'estructura
    const filesKeys = Object.keys(zip.files);
    debugLog('FILES', `Fitxers al document DOCX: ${filesKeys.length}`, filesKeys);
    
    // Extreure directament el document.xml del DOCX
    if (!zip.files['word/document.xml']) {
      debugLog('ERROR', 'No s\'ha trobat el fitxer word/document.xml al DOCX!');
      throw new Error('Estructura de document DOCX invàlida: falta document.xml');
    }
    
    let documentXml = zip.files['word/document.xml'].asText();
    debugLog('XML', `Document XML extret, mida: ${documentXml.length} bytes`);
    
    // Mostrar una part del XML per verificar
    if (documentXml.length > 0) {
      debugLog('XML_PREVIEW', 'Primers 300 caràcters del XML:', documentXml.substring(0, 300));
    }
    
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
          const originalSearchText = mapping.selectedText;
          const normalizedSearchText = normalizeTextForSearch(originalSearchText);

          debugLog('SEARCH', `Cercant text: "${normalizedSearchText.substring(0, 30)}${normalizedSearchText.length > 30 ? '...' : ''}"`, {
            original: originalSearchText,
            normalized: normalizedSearchText,
            mappingId: mapping.id
          });
          
          // Verificar si el text està present al document abans d'aplicar regex
          // això evitarà errors per expressions regulars mal formades o patrons que no apareixen
          const xmlLowerCase = documentXml.toLowerCase();
          const normalizedLowerCase = normalizedSearchText.toLowerCase();
          
          // Verificació de text exacte al document
          const textExists = xmlLowerCase.includes(normalizedLowerCase);
          debugLog('TEXT_CHECK', `Verificació de text al document: ${textExists ? 'TROBAT' : 'NO TROBAT'}`, {
            searchText: normalizedLowerCase,
            firstIndex: textExists ? xmlLowerCase.indexOf(normalizedLowerCase) : -1
          });
          
          // Analitzar presència de <w:t> al text per entendre com està estructurat el paràgraf
          // això és important perquè Word sol dividir text en múltiples elements <w:t>
          const wTextCount = (documentXml.match(/<w:t[^>]*>/g) || []).length;
          const wParaCount = (documentXml.match(/<w:p[^>]*>/g) || []).length;
          debugLog('XML_STRUCTURE', `Estructura del document XML: ${wParaCount} paràgrafs, ${wTextCount} elements <w:t>`);
          
          // Si el text no es troba exactament, buscar-lo dins elements <w:t>
          if (!textExists) {
            // Patró per extraure text de dins els elements <w:t>
            const wTextMatches = documentXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
            
            // Extreure text de cada element <w:t> i buscar coincidències parcials
            const concatenatedTexts = wTextMatches.map(wt => {
              const match = wt.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
              return match ? match[1] : '';
            }).join(' ');
            
            const normalizedConcatenated = normalizeTextForSearch(concatenatedTexts);
            if (normalizedConcatenated.includes(normalizedLowerCase)) {
              debugLog('TEXT_FRAGMENTS', `✅ Text trobat dins elements <w:t> concatenats`, {
                searchText: normalizedLowerCase,
                matchIndex: normalizedConcatenated.indexOf(normalizedLowerCase)
              });
            } else {
              debugLog('TEXT_FRAGMENTS', `❌ Text NO trobat ni dins elements <w:t> concatenats`);
              
              // Mostrar mostra de paràgrafs
              const paragraphSamples = (documentXml.match(/<w:p[^>]*>[\s\S]*?<\/w:p>/g) || []).slice(0, 3);
              debugLog('PARAGRAPH_SAMPLES', `Mostra de paràgrafs per diagnòstic:`, paragraphSamples.join('\n---------\n'));
            }
          }
          
          // Regex més robusta per trobar el paràgraf sencer que conté el text, preservant propietats
          // Nota: Escapem el text seleccionat per evitar problemes amb caràcters especials en regex
          const escapedText = escapeRegExp(normalizedSearchText);
          
          // La regex cerca:
          // 1. Inici del paràgraf amb tots els seus atributs (<w:p ...>)
          // 2. Opcionalment les propietats del paràgraf (<w:pPr>...</w:pPr>)
          // 3. El contingut que conté el text seleccionat
          // 4. Final del paràgraf (</w:p>)
            // Millora 1: Primer intentem amb una estratègia basada en DOM per trobar text fragmentat
            // Si un text està dividit entre múltiples <w:t>, cal analitzar tots els runs d'un paràgraf
            let paragraphsWithPotentialMatches = [];
            const paragraphMatches = documentXml.match(/<w:p[^>]*>[\s\S]*?<\/w:p>/g) || [];
            
            debugLog('DOM_SEARCH', `Analitzant ${paragraphMatches.length} paràgrafs per trobar text fragmentat`);
            
            // Cerca basada en fragments de text per detectar coincidències en múltiples <w:t>
            for (let i = 0; i < paragraphMatches.length; i++) {
              const paragraph = paragraphMatches[i];
              // Extreure tot el text pla d'un paràgraf (concatenant tots els <w:t>)
              const textElements = paragraph.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
              const paragraphText = textElements
                .map(el => {
                  const match = el.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
                  return match ? match[1] : '';
                })
                .join('');
              
              // Normalitzar i cercar
              const normalizedParagraphText = normalizeTextForSearch(paragraphText);
              if (normalizedParagraphText.includes(normalizedSearchText.toLowerCase())) {
                paragraphsWithPotentialMatches.push({
                  index: i,
                  paragraph,
                  originalText: paragraphText
                });
                debugLog('TEXT_FRAGMENT_MATCH', `✓ Trobat text en paràgraf #${i} (fragmentat en ${textElements.length} parts)`);
              }
            }
            
            // Si hem trobat paràgrafs amb coincidències potencials, els processem
            let matchFound = false;
            let originalXmlLength = documentXml.length;
            
            if (paragraphsWithPotentialMatches.length > 0) {
              debugLog('MATCHES', `Trobats ${paragraphsWithPotentialMatches.length} paràgrafs amb text similar`);
              
              for (const match of paragraphsWithPotentialMatches) {
                // Analitzem l'estructura del paràgraf per preservar-la
                const startTagMatch = match.paragraph.match(/(<w:p[^>]*>(?:<w:pPr>.*?<\/w:pPr>)?)/);
                const endTagMatch = match.paragraph.match(/(<\/w:p>)$/);
                
                if (startTagMatch && endTagMatch) {
                  const startTag = startTagMatch[1];
                  const endTag = endTagMatch[1];
                  
                  // Extreure estil del primer <w:r> per preservar-lo
                  const runStyleMatch = match.paragraph.match(/<w:r>(?:<w:rPr>(.*?)<\/w:rPr>)?/);
                  const styleTag = runStyleMatch && runStyleMatch[1] ? 
                    `<w:rPr>${runStyleMatch[1]}</w:rPr>` : '';
                  
                  // MILLORA CRÍTICA: En lloc de substituir tot el paràgraf,
                  // Mantenim el startTag intacte (que conté propietats i estil de paràgraf)
                  // i creem un replacement que preserva l'estil original
                  const placeholderText = `[EXCEL_LINK: ${mapping.excelHeader || 'Dades Excel'} (ID: ${mapping.id})]`;
                  
                  // Preservar l'estructura del paràgraf, incloent encapçalaments i estils
                  const replacement = `${startTag}<w:r>${styleTag}<w:t xml:space="preserve">${placeholderText}</w:t></w:r>${endTag}`;
                  
                  debugLog('PRESERVE_REPLACE', `Substituint per placeholder preservant estil: "${placeholderText}"`);
                  
                  // Escapar el paràgraf per fer una substitució exacta
                  const escapedParagraphForReplace = escapeRegExp(match.paragraph);
                  const paragraphRegexExact = new RegExp(escapedParagraphForReplace, 'g');
                  
                  // Aplicar la substitució
                  documentXml = documentXml.replace(paragraphRegexExact, replacement);
                  
                  // Verificar si s'ha fet la substitució
                  if (documentXml.length !== originalXmlLength) {
                    matchFound = true;
                    debugLog('STRUCTURE_PRESERVED', `✅ Substitució exitosa preservant estructura per Excel ID: ${mapping.id}`);
                    break; // Sortim del bucle un cop fet el primer reemplaçament
                  }
                }
              }
            }
            
            // Si no hem trobat coincidències amb la cerca DOM, provem amb el mètode regex original
            if (!matchFound) {
              debugLog('FALLBACK', `No s'ha trobat amb cerca DOM, provant amb regex tradicional`);
              
              // La regex millorada ara captura millor les seccions del paràgraf
              const paragraphRegex = new RegExp(
                `(<w:p[^>]*>(?:<w:pPr>.*?</w:pPr>)?)([\\s\\S]*?${escapedText}[\\s\\S]*?)(</w:p>)`,
                'i'
              );
              
              debugLog('REGEX', `Expressió regular utilitzada:`, paragraphRegex.toString());
              
              // Intentem trobar i substituir
              originalXmlLength = documentXml.length;
              
              documentXml = documentXml.replace(paragraphRegex, (match, startTag, content, endTag) => {
                matchFound = true;
                debugLog('MATCH', `Coincidència trobada, mida: ${match.length} bytes`, {
                  startTag: startTag.substring(0, 50) + (startTag.length > 50 ? '...' : ''),
                  contentPreview: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
                  endTag: endTag
                });
                
                // Extreure estils de text existents
                const runStyleMatch = content.match(/<w:rPr>(.*?)<\/w:rPr>/);
                const styleTag = runStyleMatch ? `<w:rPr>${runStyleMatch[1]}</w:rPr>` : '';
                
                // Crear el placeholder preservant l'estil
                const placeholderText = `[EXCEL_LINK: ${mapping.excelHeader || 'Dades Excel'} (ID: ${mapping.id})]`;
                const replacement = `${startTag}<w:r>${styleTag}<w:t xml:space="preserve">${placeholderText}</w:t></w:r>${endTag}`;
                debugLog('REPLACE', `Substituint per placeholder: "${placeholderText}" amb estils preservats`);
                return replacement;
              });
            }
          
          // Comprovar si s'ha fet alguna substitució
          if (matchFound && documentXml.length !== originalXmlLength) {
            modificacions++;
            substitucions.exitoses++;
            debugLog('SUCCESS', `✅ Substitució exitosa per Excel ID: ${mapping.id}`, {
              beforeLength: originalXmlLength,
              afterLength: documentXml.length,
              difference: originalXmlLength - documentXml.length
            });
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
        
        // Prioritzar la cerca utilitzant originalParagraphText si està disponible
        if (instr.originalParagraphText && instr.originalParagraphText.length > 5) {
          debugLog('AI_SEARCH', `Utilitzant originalParagraphText per IA: ID: ${instr.id || paragraphId}`, {
            textLength: instr.originalParagraphText.length,
            textPreview: truncateText(instr.originalParagraphText, 50)
          });
          
          const normalizedSearchText = normalizeTextForSearch(instr.originalParagraphText);
          const escapedText = escapeRegExp(normalizedSearchText);
          
          // Verificar si el text està present al document
          const xmlLowerCase = documentXml.toLowerCase();
          const normalizedLowerCase = normalizedSearchText.toLowerCase();
          const textExists = xmlLowerCase.includes(normalizedLowerCase);
          
          debugLog('AI_TEXT_CHECK', `Verificació de text IA al document: ${textExists ? 'TROBAT' : 'NO TROBAT'}`, {
            searchText: normalizedLowerCase.substring(0, 30) + '...',
            firstIndex: textExists ? xmlLowerCase.indexOf(normalizedLowerCase) : -1
          });
          
          if (textExists) {
            // Regex per trobar el paràgraf amb el text
            const paragraphRegex = new RegExp(
              `(<w:p[^>]*>(?:<w:pPr>.*?</w:pPr>)?)([\\s\\S]*?${escapedText}[\\s\\S]*?)(</w:p>)`,
              'i'
            );
            
            const originalXmlLength = documentXml.length;
            let matchFound = false;
            
            documentXml = documentXml.replace(paragraphRegex, (match, startTag, content, endTag) => {
              matchFound = true;
              const placeholderText = `[AI_INSTRUCTION: ${truncateText(instr.content || instr.prompt || '', 30)} (ID: ${instr.id || paragraphId})]`;
              
              // Extreure estils de text existents per preservar-los
              const runStyleMatch = content.match(/<w:rPr>(.*?)<\/w:rPr>/);
              const styleTag = runStyleMatch ? `<w:rPr>${runStyleMatch[1]}</w:rPr>` : '';
              
              // Crear el placeholder preservant l'estil
              const replacement = `${startTag}<w:r>${styleTag}<w:t xml:space="preserve">${placeholderText}</w:t></w:r>${endTag}`;
              debugLog('AI_REPLACE', `Substituint per placeholder IA: "${placeholderText}" amb estils preservats`);
              return replacement;
            });
            
            if (matchFound && documentXml.length !== originalXmlLength) {
              modificacions++;
              substitucions.exitoses++;
              debugLog('AI_SUCCESS', `✅ Substitució exitosa per IA ID: ${instr.id || paragraphId}`);
              // Continuem amb el següent si ja hem fet una substitució
              continue;
            }
          }
          
          // Intent alternatiu: buscar només una part significativa del text
          if (!textExists) {
            debugLog('AI_RETRY', `Text IA no trobat exactament, intentant amb substring`);
            let simplifiedSearch = normalizedSearchText;
            if (simplifiedSearch.length > 30) {
              simplifiedSearch = simplifiedSearch.substring(0, 30);
              debugLog('AI_SUBSTRING', `Utilitzant substring: "${simplifiedSearch}"`);
            }
            
            const simpleRegex = new RegExp(
              `(<w:p[^>]*>(?:<w:pPr>.*?</w:pPr>)?)([\\s\\S]*?${escapeRegExp(simplifiedSearch)}[\\s\\S]*?)(</w:p>)`,
              'i'
            );
            
            const simpleLength = documentXml.length;
            documentXml = documentXml.replace(simpleRegex, (match, startTag, content, endTag) => {
              const placeholderText = `[AI_INSTRUCTION: ${truncateText(instr.content || instr.prompt || '', 30)} (ID: ${instr.id || paragraphId})]`;
              
              // Extreure estils de text existents per preservar-los
              const runStyleMatch = content.match(/<w:rPr>(.*?)<\/w:rPr>/);
              const styleTag = runStyleMatch ? `<w:rPr>${runStyleMatch[1]}</w:rPr>` : '';
              
              debugLog('AI_REPLACE_ALT', `Intent alternatiu - substituint IA per: "${placeholderText}" preservant estil`);
              return `${startTag}<w:r>${styleTag}<w:t xml:space="preserve">${placeholderText}</w:t></w:r>${endTag}`;
            });
            
            if (documentXml.length !== simpleLength) {
              modificacions++;
              substitucions.exitoses++;
              debugLog('AI_SUCCESS_ALT', `✅ Substitució alternativa exitosa per IA ID: ${instr.id || paragraphId}`);
              continue;
            }
          }
        }
        
        // Si originalParagraphText no funcionava o no estava disponible, utilitzem el mètode anterior
        if (paragraphId) {
          debugLog('AI_FALLBACK', `Utilitzant paragraphId per IA: ${paragraphId}`);
          
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
                
                // Extreure estil del primer <w:r> per preservar-lo
                const runStyleMatch = paragraph.match(/<w:r>(?:<w:rPr>(.*?)<\/w:rPr>)?/);
                const styleTag = runStyleMatch && runStyleMatch[1] ? 
                  `<w:rPr>${runStyleMatch[1]}</w:rPr>` : '';
                  
                const replacement = `${startTag}<w:r>${styleTag}<w:t xml:space="preserve">${placeholderText}</w:t></w:r>${endTag}`;
                const escapedParagraph = escapeRegExp(paragraph);
                documentXml = documentXml.replace(new RegExp(escapedParagraph, 'g'), replacement);
                
                modificacions++;
                debugLog('AI_SUCCESS_ID', `✅ Substitució per ID exitosa per IA ID: ${instr.id || paragraphId}`);
              }
            }
          }
        }
      }
    }
    
    debugLog('STATS', `Resum de modificacions:`, {
      total: modificacions,
      exitoses: substitucions.exitoses,
      fallides: substitucions.fallides
    });
    
    // Afegim una verificació final abans de generar el document
    // Crear un test senzill: afegir un text "TEST PLACEHOLDER" en una posició fixa
    // Això ens assegurarà que el mecanisme de substituició funciona
    if (modificacions === 0) {
      debugLog('FORCE_TEST', `No s'ha fet cap modificació. Realitzant un test de força...`);
      
      // Obtenir tots els paràgrafs
      const paragraphMatches = documentXml.match(/<w:p[^>]*>[\s\S]*?<\/w:p>/g);
      
      if (paragraphMatches && paragraphMatches.length > 0) {
        // Seleccionar el primer paràgraf com a test
        const testParagraph = paragraphMatches[0];
        debugLog('FORCE_TEST', `Seleccionat paràgraf per test:`, testParagraph.substring(0, 100) + '...');
        
        // Crear un patró de substitució directa
        const testPlaceholder = `[TEST_PLACEHOLDER: Això és una prova de substitució directa]`;
        
        // Obtenir les etiquetes d'inici i final
        const startTagMatch = testParagraph.match(/(<w:p[^>]*>(?:<w:pPr>.*?<\/w:pPr>)?)/);
        const endTagMatch = testParagraph.match(/(<\/w:p>)$/);
        
        if (startTagMatch && endTagMatch) {
          const startTag = startTagMatch[1];
          const endTag = endTagMatch[1];
          
          // Extreure estil del primer <w:r> per preservar-lo
          const runStyleMatch = testParagraph.match(/<w:r>(?:<w:rPr>(.*?)<\/w:rPr>)?/);
          const styleTag = runStyleMatch && runStyleMatch[1] ? 
            `<w:rPr>${runStyleMatch[1]}</w:rPr>` : '';
            
          const testReplacement = `${startTag}<w:r>${styleTag}<w:t xml:space="preserve">${testPlaceholder}</w:t></w:r>${endTag}`;
          
          // Substituir el primer paràgraf
          const originalForTest = documentXml;
          documentXml = documentXml.replace(testParagraph, testReplacement);
          
          // Verificar si s'ha fet la substitució
          if (documentXml !== originalForTest) {
            debugLog('FORCE_TEST', `✅ Test de força aplicat amb èxit al document`);
          } else {
            debugLog('FORCE_TEST', `❌ Test de força ha fallat`);
          }
        }
      }
    }
    
    // Verificació final: comparació de documents
    debugLog('FINAL_CHECK', `Comparació final dels documents:`, {
      originalXmlLength: zip.files['word/document.xml'].asText().length,
      currentXmlLength: documentXml.length,
      xmlHasChanged: zip.files['word/document.xml'].asText() !== documentXml
    });
    
    // Verificar si el document modificat conté els placeholders
    const finalTest = linkMappings && linkMappings.length > 0 && linkMappings[0].id;
    if (finalTest) {
      const placeholderTest = `[EXCEL_LINK: ${linkMappings[0].excelHeader || 'Dades Excel'} (ID: ${linkMappings[0].id})]`;
      const placeholderExists = documentXml.includes(placeholderTest);
      debugLog('PLACEHOLDER_CHECK', `Comprovació final de placeholder:`, {
        testText: placeholderTest,
        exists: placeholderExists
      });
    }
    
    // Actualitzar el ZIP amb el nou XML
    zip.file('word/document.xml', documentXml);
    
    // Generar el buffer de sortida
    const out = zip.generate({ type: 'nodebuffer' });
    debugLog('OUTPUT', `Document generat correctament:`, {
      originalSize: originalBuffer.length,
      newSize: out.length,
      sizeChange: out.length - originalBuffer.length
    });
    
    return out as Buffer;
  } catch (error) {
    console.error("[generatePlaceholderDocx] Error processant document:", error);
    throw new Error(`Error en generatePlaceholderDocx: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Normalitza un text per fer-lo més fàcil de trobar al document
 * Elimina espais redundants, caràcters especials, etc.
 * 
 * Millora: Més tolerant amb puntuació i espais, per trobar text fragmentat
 */
function normalizeTextForSearch(text: string): string {
  if (!text) return '';
  
  // Eliminar caràcters que poden causar problemes en la cerca
  return text
    .replace(/\s+/g, ' ')       // Reduir múltiples espais a un sol
    .replace(/[\r\n]+/g, ' ')   // Reemplaçar salts de línia per espais
    .replace(/[,.;:!?"\[\]{}()]/g, ' ') // Reemplaçar puntuació per espais
    .replace(/\s+/g, ' ')       // Tornar a reduir múltiples espais
    .trim()                     // Eliminar espais al principi i final
    .toLowerCase();             // Convertir a minúscules per fer la cerca case-insensitive
}

/**
 * Funció auxiliar per comprovar si dos textos són similars
 * Útil per trobar coincidències quan el text ha estat lleugerament modificat
 * 
 * @param text1 Primer text a comparar
 * @param text2 Segon text a comparar
 * @param threshold Llindar de similitud (0.0 a 1.0)
 * @returns True si els textos són similars segons el llindar
 */
function areTextsSimilar(text1: string, text2: string, threshold: number = 0.7): boolean {
  if (!text1 || !text2) return false;
  if (text1 === text2) return true;
  
  // Normalitzar ambdós textos
  const normalized1 = normalizeTextForSearch(text1);
  const normalized2 = normalizeTextForSearch(text2);
  
  // Si un text conté l'altre, són similars
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return true;
  }
  
  // Si els textos són molt curts, comparem directament
  if (normalized1.length < 10 || normalized2.length < 10) {
    return normalized1 === normalized2;
  }
  
  // Per textos més llargs, calculem quants caràcters comparteixen
  let commonChars = 0;
  const shortText = normalized1.length < normalized2.length ? normalized1 : normalized2;
  const longText = normalized1.length >= normalized2.length ? normalized1 : normalized2;
  
  for (let i = 0; i < shortText.length; i++) {
    if (longText.includes(shortText[i])) {
      commonChars++;
    }
  }
  
  // Calculem similitud basada en caràcters comuns
  const similarity = commonChars / shortText.length;
  return similarity >= threshold;
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
