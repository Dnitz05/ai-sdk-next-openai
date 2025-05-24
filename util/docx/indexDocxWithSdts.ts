/**
 * Utilitat per indexar documents DOCX amb SDTs (Structure Document Tags)
 * 
 * Aquest mòdul proporciona funcions per a verificar si un document
 * DOCX ja està indexat amb SDTs i per a indexar-lo si no ho està.
 * 
 * La indexació consisteix en envoltar cada paràgraf amb un SDT que conté
 * un identificador únic, permetent una identificació i modificació precisa
 * dels paràgrafs al generar placeholders.
 */

import * as JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
import { DOMParser, XMLSerializer, Document as XmlDocument, Element as XmlElement } from '@xmldom/xmldom';

// Namespace constants
const WORD_PROCESSING_ML = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const DOCPROOF_PREFIX = "docproof_pid_"; // Prefix pels nostres identificadors

/**
 * Resultat de la verificació d'indexació d'un document DOCX
 */
interface DocxIndexCheckResult {
  indexed: boolean;
  sdtCount: number;
  docproofSdtCount: number; // Nombre d'SDTs específics del nostre sistema
}

/**
 * Resultat del procés d'indexació del document DOCX
 */
interface DocxIndexingResult {
  indexedBuffer: Buffer;
  idMap: ParagraphMapping[]; // Array de mapeigs de paràgrafs 
}

/**
 * Informació detallada d'un paràgraf indexat
 */
interface ParagraphMapping {
  id: string;             // ID únic de paràgraf (UUID)
  numericId: number;      // ID numèric per a l'atribut w:id
  text: string;           // Text complet del paràgraf
  position: number;       // Posició dins del document
  parentType?: string;    // Tipus de contenidor pare (taula, secció, etc.)
}

/**
 * Comprova si un document DOCX ja està indexat amb SDTs creats pel nostre sistema
 * @param docxBuffer Buffer del document DOCX
 * @returns Promise amb el resultat de la comprovació
 */
export async function isDocxIndexed(docxBuffer: Buffer): Promise<DocxIndexCheckResult> {
  try {
    console.log('[isDocxIndexed] Verificant si el document està indexat...');
    
    const zip = await JSZip.loadAsync(docxBuffer);
    const documentXml = await zip.file('word/document.xml')?.async('string');

    if (!documentXml) {
      throw new Error('No s\'ha trobat el fitxer document.xml dins del DOCX');
    }

    // Comptar tots els elements SDT en el document
    const allSdtMatches = documentXml.match(/<w:sdt>/g);
    const allSdtCount = allSdtMatches ? allSdtMatches.length : 0;

    // Comptar específicament els nostres SDTs (amb el prefix docproof_pid_)
    const docproofTagRegex = new RegExp(`<w:tag\\s+w:val=["']${DOCPROOF_PREFIX}[a-f0-9-]+["']`, 'g');
    const docproofMatches = documentXml.match(docproofTagRegex);
    const docproofCount = docproofMatches ? docproofMatches.length : 0;

    console.log(`[isDocxIndexed] Document analitzat: ${allSdtCount} SDTs totals, ${docproofCount} SDTs DocProof`);

    // Considerem que el document està indexat si té almenys un SDT amb el nostre prefix
    return {
      indexed: docproofCount > 0,
      sdtCount: allSdtCount,
      docproofSdtCount: docproofCount
    };
  } catch (error) {
    console.error('[isDocxIndexed] Error verificant si el document està indexat:', error);
    return {
      indexed: false,
      sdtCount: 0,
      docproofSdtCount: 0
    };
  }
}

/**
 * Indexa un document DOCX envoltant cada paràgraf amb SDTs
 * @param docxBuffer Buffer del document DOCX original
 * @returns Promise amb el resultat de la indexació
 */
export async function indexDocxWithSdts(docxBuffer: Buffer): Promise<DocxIndexingResult> {
  console.log('[indexDocxWithSdts] Iniciant procés d\'indexació del document...');
  
  try {
    const zip = await JSZip.loadAsync(docxBuffer);
    const documentXml = await zip.file('word/document.xml')?.async('string');

    if (!documentXml) {
      throw new Error('No s\'ha trobat el fitxer document.xml dins del DOCX');
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(documentXml, 'text/xml') as XmlDocument;
    
    // Inicialitzar el comptador per als IDs numèrics
    let sdtIdCounter = 1;
    
    // Obtenir tots els paràgrafs (inclosos els que estan dins de taules)
    const allParagraphs = getAllParagraphs(xmlDoc);
    console.log(`[indexDocxWithSdts] S'han trobat ${allParagraphs.length} paràgrafs en total per indexar`);
    
    // Array per guardar la informació de mapeig de paràgrafs
    const paragraphMappings: ParagraphMapping[] = [];
    
    // Convertir l'array de paràgrafs a un array estàtic per iterar de forma segura
    const paragraphsArray = Array.from(allParagraphs);
    
    // Per cada paràgraf, crear un SDT amb un ID únic
    for (let i = 0; i < paragraphsArray.length; i++) {
      const paragraph = paragraphsArray[i];
      const paragraphText = extractTextFromParagraph(paragraph);
      
      if (paragraphText.trim().length === 0) {
        console.log(`[indexDocxWithSdts] Saltant paràgraf buit en posició ${i+1}`);
        continue; // Saltar paràgrafs buits
      }
      
      // Generar un ID únic pel paràgraf (amb el nostre prefix)
      const uuid = uuidv4();
      const paragraphId = `${DOCPROOF_PREFIX}${uuid}`;
      const numericId = sdtIdCounter++;
      
      console.log(`[indexDocxWithSdts] Processant paràgraf ${i+1}: "${paragraphText.substring(0, 30)}${paragraphText.length > 30 ? '...' : ''}"`);
      console.log(`[indexDocxWithSdts] Assignant ID: ${paragraphId}, ID numèric: ${numericId}`);
      
      // Detectar el tipus de contenidor pare
      const parentType = getParentNodeType(paragraph);
      
      // Crear l'estructura de mapeig de paràgrafs
      paragraphMappings.push({
        id: paragraphId,
        numericId,
        text: paragraphText,
        position: i,
        parentType
      });
      
      // Crear l'estructura SDT utilitzant els namespaces correctes
      // 1. Crear l'element SDT
      const sdtElement = xmlDoc.createElementNS(WORD_PROCESSING_ML, 'w:sdt');
      
      // 2. Crear l'element de propietats de l'SDT
      const sdtPr = xmlDoc.createElementNS(WORD_PROCESSING_ML, 'w:sdtPr');
      
      // 3. Afegir l'ID numèric
      const sdtId = xmlDoc.createElementNS(WORD_PROCESSING_ML, 'w:id');
      sdtId.setAttribute('w:val', String(numericId));
      sdtPr.appendChild(sdtId);
      
      // 4. Afegir l'etiqueta (tag) amb l'ID únic
      const sdtTag = xmlDoc.createElementNS(WORD_PROCESSING_ML, 'w:tag');
      sdtTag.setAttribute('w:val', paragraphId);
      sdtPr.appendChild(sdtTag);
      
      // 5. Afegir el tipus d'SDT (opcional però recomanat)
      const sdtPlaceholder = xmlDoc.createElementNS(WORD_PROCESSING_ML, 'w:placeholder');
      const docPart = xmlDoc.createElementNS(WORD_PROCESSING_ML, 'w:docPart');
      docPart.setAttribute('w:val', 'DefaultPlaceholder');
      sdtPlaceholder.appendChild(docPart);
      sdtPr.appendChild(sdtPlaceholder);
      
      // 6. Afegir el contenidor de contingut
      const sdtContent = xmlDoc.createElementNS(WORD_PROCESSING_ML, 'w:sdtContent');
      
      // 7. Afegir els elements al document
      sdtElement.appendChild(sdtPr);
      sdtElement.appendChild(sdtContent);
      
      // 8. Moure el paràgraf dins del contingut de l'SDT
      const parent = paragraph.parentNode as XmlElement;
      if (parent) {
        try {
          parent.insertBefore(sdtElement, paragraph);
          sdtContent.appendChild(paragraph);
        } catch (moveError) {
          console.error(`[indexDocxWithSdts] Error movent el paràgraf ${i+1} a l'SDT:`, moveError);
          throw new Error(`Error en la manipulació DOM: ${moveError}`);
        }
      } else {
        console.error(`[indexDocxWithSdts] No s'ha trobat el node pare pel paràgraf ${i+1}`);
        throw new Error('No s\'ha trobat el node pare per un paràgraf');
      }
    }
    
    // Convertir el document modificat a XML
    const serializer = new XMLSerializer();
    const modifiedXml = serializer.serializeToString(xmlDoc);
    
    console.log(`[indexDocxWithSdts] Document modificat correctament amb ${paragraphMappings.length} SDTs`);
    
    // Actualitzar el document dins del ZIP
    zip.file('word/document.xml', modifiedXml);
    
    // Generar el nou fitxer DOCX
    const indexedBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    console.log(`[indexDocxWithSdts] Nou document DOCX generat: ${indexedBuffer.length} bytes`);
    
    return {
      indexedBuffer,
      idMap: paragraphMappings
    };
  } catch (error) {
    console.error('[indexDocxWithSdts] Error crític indexant el document:', error);
    throw error;
  }
}

/**
 * Obté tots els paràgrafs del document, incloent-hi els que estan dins de taules
 * @param xmlDoc Document XML
 * @returns Array d'elements paràgraf
 */
function getAllParagraphs(xmlDoc: XmlDocument): XmlElement[] {
  const paragraphs: XmlElement[] = [];
  const bodyElements = xmlDoc.getElementsByTagNameNS(WORD_PROCESSING_ML, 'body');
  
  if (bodyElements.length === 0) {
    console.warn('[getAllParagraphs] No s\'ha trobat l\'element body en el document');
    return paragraphs;
  }
  
  // Funció recursiva per obtenir paràgrafs dins de qualsevol estructura
  function extractParagraphsFrom(element: XmlElement): void {
    // 1. Obtenir paràgrafs directes
    const directParagraphs = element.getElementsByTagNameNS(WORD_PROCESSING_ML, 'p');
    for (let i = 0; i < directParagraphs.length; i++) {
      if (isDirectChild(directParagraphs[i] as XmlElement, element)) {
        paragraphs.push(directParagraphs[i] as XmlElement);
      }
    }
    
    // 2. Obtenir cel·les de taula i buscar paràgrafs dins d'elles
    const tableRows = element.getElementsByTagNameNS(WORD_PROCESSING_ML, 'tr');
    for (let i = 0; i < tableRows.length; i++) {
      if (isDirectChild(tableRows[i] as XmlElement, element)) {
        const tableCells = tableRows[i].getElementsByTagNameNS(WORD_PROCESSING_ML, 'tc');
        for (let j = 0; j < tableCells.length; j++) {
          extractParagraphsFrom(tableCells[j] as XmlElement);
        }
      }
    }
    
    // 3. Buscar en altres contenidors potencials
    const otherContainers = ['txbxContent', 'footnote', 'endnote'];
    for (const container of otherContainers) {
      const containers = element.getElementsByTagNameNS(WORD_PROCESSING_ML, container);
      for (let i = 0; i < containers.length; i++) {
        if (isDirectChild(containers[i] as XmlElement, element)) {
          extractParagraphsFrom(containers[i] as XmlElement);
        }
      }
    }
  }
  
  // Començar l'extracció de paràgrafs des del body
  extractParagraphsFrom(bodyElements[0] as XmlElement);
  
  return paragraphs;
}

/**
 * Comprova si un node és fill directe d'un altre (no a través de nodes intermedis)
 * @param child Element fill potencial
 * @param parent Element pare potencial
 * @returns true si child és fill directe de parent
 */
function isDirectChild(child: XmlElement, parent: XmlElement): boolean {
  return child.parentNode === parent;
}

/**
 * Determina el tipus del node pare d'un element
 * @param element Element a analitzar
 * @returns Tipus del node pare o undefined
 */
function getParentNodeType(element: XmlElement): string | undefined {
  const parent = element.parentNode as XmlElement;
  if (!parent) return undefined;
  
  const nodeName = parent.nodeName;
  
  // Taules i altres contenidors comuns
  if (nodeName === 'w:tc') return 'table-cell';
  if (nodeName === 'w:txbxContent') return 'text-box';
  if (nodeName === 'w:footnote') return 'footnote';
  if (nodeName === 'w:endnote') return 'endnote';
  if (nodeName === 'w:body') return 'body';
  
  return nodeName;
}

/**
 * Extreu el text d'un paràgraf XML
 * @param paragraph Element XML del paràgraf
 * @returns Text contingut al paràgraf
 */
function extractTextFromParagraph(paragraph: XmlElement): string {
  let text = '';
  
  // Obtenir tots els elements <w:t> dins del paràgraf
  const textNodes = paragraph.getElementsByTagNameNS(WORD_PROCESSING_ML, 't');
  
  for (let i = 0; i < textNodes.length; i++) {
    text += textNodes[i].textContent || '';
  }
  
  return text;
}
