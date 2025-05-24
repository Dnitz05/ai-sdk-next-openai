/**
 * Utilitat per verificar la integritat dels SDTs en documents DOCX
 * 
 * Aquest mòdul permet comprovar si els Structure Document Tags (SDTs)
 * injectats pel sistema s'han preservat correctament després d'editar
 * el document amb MS Word i tornar-lo a desar.
 */

import * as JSZip from 'jszip';
import { DOMParser, Document as XmlDocument, Element as XmlElement } from '@xmldom/xmldom';

// Reutilitzar el mateix prefix que a indexDocxWithSdts.ts
const WORD_PROCESSING_ML = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const DOCPROOF_PREFIX = "docproof_pid_";

/**
 * Resultat de la verificació d'integritat d'un document DOCX
 */
export interface DocxIntegrityVerificationResult {
  totalSdtsInDoc: number;        // Recompte total d'elements <w:sdt>
  docproofSdtCount: number;      // Recompte d'SDTs amb el nostre w:tag prefixat
  foundDocproofIds?: string[];   // Llista dels nostres IDs trobats
  isIntegrityPreserved: boolean; // true si hi ha SDTs amb el nostre prefix
  xmlAnalysis: {                 // Detalls addicionals de l'anàlisi
    completeXmlSize: number;     // Mida de l'XML del document
    hasBrokenStructure: boolean; // Indica si s'han detectat estructures trencades
    brokenSdtCount: number;      // SDTs mal formats (sense sdtPr o sdtContent)
  };
}

/**
 * Verifica la integritat d'un document DOCX que havia estat indexat amb SDTs
 * @param docxBuffer Buffer del document DOCX a verificar
 * @returns Promise amb el resultat de la verificació
 */
export async function checkIndexedDocxIntegrity(docxBuffer: Buffer): Promise<DocxIntegrityVerificationResult> {
  console.log('[checkIndexedDocxIntegrity] Iniciant verificació del document...');
  
  try {
    // Carregar el document DOCX
    const zip = await JSZip.loadAsync(docxBuffer);
    const documentXml = await zip.file('word/document.xml')?.async('string');

    if (!documentXml) {
      throw new Error('No s\'ha trobat el fitxer document.xml dins del DOCX');
    }

    console.log(`[checkIndexedDocxIntegrity] Document carregat, mida XML: ${documentXml.length} bytes`);
    
    // Parsejar l'XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(documentXml, 'text/xml') as XmlDocument;
    
    // Inicialitzar el resultat
    const result: DocxIntegrityVerificationResult = {
      totalSdtsInDoc: 0,
      docproofSdtCount: 0,
      foundDocproofIds: [],
      isIntegrityPreserved: false,
      xmlAnalysis: {
        completeXmlSize: documentXml.length,
        hasBrokenStructure: false,
        brokenSdtCount: 0
      }
    };
    
    // 1. Comptar tots els elements SDT
    const allSdts = xmlDoc.getElementsByTagNameNS(WORD_PROCESSING_ML, 'sdt');
    result.totalSdtsInDoc = allSdts.length;
    
    console.log(`[checkIndexedDocxIntegrity] Total d'elements SDT trobats: ${result.totalSdtsInDoc}`);
    
    // 2. Analitzar cada SDT per trobar els nostres tags
    for (let i = 0; i < allSdts.length; i++) {
      const sdt = allSdts[i] as XmlElement;
      
      // Verificar que l'SDT té l'estructura correcta
      const sdtPr = sdt.getElementsByTagNameNS(WORD_PROCESSING_ML, 'sdtPr')[0];
      const sdtContent = sdt.getElementsByTagNameNS(WORD_PROCESSING_ML, 'sdtContent')[0];
      
      if (!sdtPr || !sdtContent) {
        console.warn(`[checkIndexedDocxIntegrity] SDT #${i+1} està mal format (falta sdtPr o sdtContent)`);
        result.xmlAnalysis.brokenSdtCount++;
        result.xmlAnalysis.hasBrokenStructure = true;
        continue;
      }
      
      // Buscar elements tag dins de sdtPr
      const tags = sdtPr.getElementsByTagNameNS(WORD_PROCESSING_ML, 'tag');
      
      if (tags.length === 0) {
        console.log(`[checkIndexedDocxIntegrity] SDT #${i+1} no té cap tag`);
        continue;
      }
      
      // Verificar si algun tag té el nostre prefix
      for (let j = 0; j < tags.length; j++) {
        const tag = tags[j] as XmlElement;
        const tagValue = tag.getAttribute('w:val');
        
        if (tagValue && tagValue.startsWith(DOCPROOF_PREFIX)) {
          result.docproofSdtCount++;
          result.foundDocproofIds?.push(tagValue);
          
          // Analitzar el contingut del paràgraf dins de l'SDT
          const paragraphs = sdtContent.getElementsByTagNameNS(WORD_PROCESSING_ML, 'p');
          let paragraphText = '';
          
          if (paragraphs.length > 0) {
            // Extreure el text del primer paràgraf com a mostra
            const textNodes = paragraphs[0].getElementsByTagNameNS(WORD_PROCESSING_ML, 't');
            for (let k = 0; k < textNodes.length; k++) {
              paragraphText += textNodes[k].textContent || '';
            }
          }
          
          console.log(`[checkIndexedDocxIntegrity] ✅ SDT #${i+1} té el nostre tag: ${tagValue}`);
          console.log(`[checkIndexedDocxIntegrity] Text de mostra: "${paragraphText.substring(0, 50)}${paragraphText.length > 50 ? '...' : ''}"`);
          
          break;
        }
      }
    }
    
    // 3. Verificar integritat
    result.isIntegrityPreserved = result.docproofSdtCount > 0;
    
    console.log(`[checkIndexedDocxIntegrity] Resum de la verificació:`);
    console.log(`[checkIndexedDocxIntegrity] - Total SDTs: ${result.totalSdtsInDoc}`);
    console.log(`[checkIndexedDocxIntegrity] - SDTs DocProof: ${result.docproofSdtCount}`);
    console.log(`[checkIndexedDocxIntegrity] - SDTs mal formats: ${result.xmlAnalysis.brokenSdtCount}`);
    console.log(`[checkIndexedDocxIntegrity] - Integritat preservada: ${result.isIntegrityPreserved ? 'SÍ' : 'NO'}`);
    
    if (result.foundDocproofIds && result.foundDocproofIds.length > 0) {
      console.log(`[checkIndexedDocxIntegrity] - IDs trobats (mostra): ${result.foundDocproofIds.slice(0, 5).join(', ')}${result.foundDocproofIds.length > 5 ? ', ...' : ''}`);
    }
    
    // 4. Anàlisi addicional: Comparar amb patró comú d'SDTs MS Word
    const wordSdtPattern = /<w:sdt>[\s\S]*?<w:sdtPr>/g;
    const wordSdtMatches = documentXml.match(wordSdtPattern);
    const wordSdtCount = wordSdtMatches ? wordSdtMatches.length : 0;
    
    if (wordSdtCount !== result.totalSdtsInDoc) {
      console.warn(`[checkIndexedDocxIntegrity] Avís: Discrepància en el recompte d'SDTs entre anàlisi XML (${result.totalSdtsInDoc}) i patró regex (${wordSdtCount})`);
    }
    
    // 5. Cerca del patró del nostre tag amb regex com a verificació addicional
    const docproofTagRegex = new RegExp(`<w:tag\\s+w:val=["']${DOCPROOF_PREFIX}[a-f0-9-]+["']`, 'g');
    const docproofMatches = documentXml.match(docproofTagRegex);
    const docproofCountRegex = docproofMatches ? docproofMatches.length : 0;
    
    if (docproofCountRegex !== result.docproofSdtCount) {
      console.warn(`[checkIndexedDocxIntegrity] Avís: Discrepància en el recompte d'SDTs DocProof entre anàlisi DOM (${result.docproofSdtCount}) i patró regex (${docproofCountRegex})`);
      console.log(`[checkIndexedDocxIntegrity] Això podria ser degut a la diferent representació dels tags en el DOM vs. text pla XML`);
    }
    
    return result;
  } catch (error) {
    console.error('[checkIndexedDocxIntegrity] Error verificant la integritat del document:', error);
    
    // Retornar un resultat d'error
    return {
      totalSdtsInDoc: 0,
      docproofSdtCount: 0,
      isIntegrityPreserved: false,
      xmlAnalysis: {
        completeXmlSize: 0,
        hasBrokenStructure: true,
        brokenSdtCount: 0
      }
    };
  }
}

/**
 * Utilitat per analitzar detalladament l'estructura dels SDTs en un document
 * i generar un informe detallat. Útil per a diagnosticar problemes.
 * @param docxBuffer Buffer del document DOCX
 * @returns Promise amb un informe detallat
 */
export async function generateSdtDetailedReport(docxBuffer: Buffer): Promise<string> {
  console.log('[generateSdtDetailedReport] Generant informe detallat dels SDTs...');
  
  try {
    // Carregar i analitzar el document com a checkIndexedDocxIntegrity
    const zip = await JSZip.loadAsync(docxBuffer);
    const documentXml = await zip.file('word/document.xml')?.async('string');

    if (!documentXml) {
      return "ERROR: No s'ha trobat el fitxer document.xml dins del DOCX";
    }
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(documentXml, 'text/xml') as XmlDocument;
    
    // Construir un informe detallat
    let report = "INFORME DETALLAT D'SDTS DEL DOCUMENT\n";
    report += "========================================\n\n";
    
    // 1. Informació general
    const allSdts = xmlDoc.getElementsByTagNameNS(WORD_PROCESSING_ML, 'sdt');
    report += `Total d'SDTs en el document: ${allSdts.length}\n\n`;
    
    // 2. Anàlisi individualitzada dels SDTs
    for (let i = 0; i < allSdts.length; i++) {
      const sdt = allSdts[i] as XmlElement;
      
      report += `SDT #${i+1}:\n`;
      report += `------------\n`;
      
      // 2.1. Analitzar sdtPr
      const sdtPr = sdt.getElementsByTagNameNS(WORD_PROCESSING_ML, 'sdtPr')[0];
      if (!sdtPr) {
        report += "AVÍS: No té element sdtPr!\n\n";
        continue;
      }
      
      // 2.2. Verificar ID
      const sdtIds = sdtPr.getElementsByTagNameNS(WORD_PROCESSING_ML, 'id');
      if (sdtIds.length > 0) {
        const idVal = (sdtIds[0] as XmlElement).getAttribute('w:val');
        report += `ID: ${idVal || 'Cap'}\n`;
      } else {
        report += "No té element ID\n";
      }
      
      // 2.3. Verificar tag
      const tags = sdtPr.getElementsByTagNameNS(WORD_PROCESSING_ML, 'tag');
      if (tags.length > 0) {
        const tagVal = (tags[0] as XmlElement).getAttribute('w:val');
        report += `Tag: ${tagVal || 'Cap'}\n`;
        
        if (tagVal && tagVal.startsWith(DOCPROOF_PREFIX)) {
          report += `  ✓ És un tag del nostre sistema (DocProof)\n`;
        } else {
          report += `  ✗ No és un tag del nostre sistema\n`;
        }
      } else {
        report += "No té element tag\n";
      }
      
      // 2.4. Verificar contingut
      const sdtContent = sdt.getElementsByTagNameNS(WORD_PROCESSING_ML, 'sdtContent')[0];
      if (!sdtContent) {
        report += "AVÍS: No té element sdtContent!\n\n";
        continue;
      }
      
      const paragraphs = sdtContent.getElementsByTagNameNS(WORD_PROCESSING_ML, 'p');
      report += `Paràgrafs dins de l'SDT: ${paragraphs.length}\n`;
      
      if (paragraphs.length > 0) {
        let paragraphText = '';
        const textNodes = paragraphs[0].getElementsByTagNameNS(WORD_PROCESSING_ML, 't');
        
        for (let j = 0; j < textNodes.length; j++) {
          paragraphText += textNodes[j].textContent || '';
        }
        
        const textPreview = paragraphText.substring(0, 100);
        report += `Text del primer paràgraf: "${textPreview}${paragraphText.length > 100 ? '...' : ''}"\n`;
      }
      
      report += '\n';
    }
    
    console.log('[generateSdtDetailedReport] Informe generat correctament');
    return report;
  } catch (error) {
    console.error('[generateSdtDetailedReport] Error generant l\'informe:', error);
    return `ERROR: No s'ha pogut generar l'informe: ${error}`;
  }
}
