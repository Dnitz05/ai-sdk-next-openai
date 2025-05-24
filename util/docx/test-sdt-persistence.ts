/**
 * Script de demostració i test per a la indexació de documents DOCX
 * amb SDTs i la verificació de la seva persistència.
 * 
 * Aquest script pot ser utilitzat per verificar que els SDTs injectats
 * amb indexDocxWithSdts persisteixen després d'editar el document amb 
 * MS Word.
 * 
 * Exemple d'ús:
 * 1. Generar document indexat: node -r ts-node/register util/docx/test-sdt-persistence.ts index path/to/original.docx output/indexed.docx
 * 2. Obrir output/indexed.docx amb MS Word, editar i desar
 * 3. Verificar persistència: node -r ts-node/register util/docx/test-sdt-persistence.ts verify output/indexed.docx
 * 4. Informe detallat: node -r ts-node/register util/docx/test-sdt-persistence.ts report output/indexed.docx > report.txt
 */

import * as fs from 'fs';
import * as path from 'path';
import { indexDocxWithSdts } from './indexDocxWithSdts';
import { checkIndexedDocxIntegrity, generateSdtDetailedReport } from './verifySdtPersistence';

async function main() {
  // Obtenir els arguments de la línia de comandes
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();
  
  if (!command || !['index', 'verify', 'report'].includes(command)) {
    console.log('Ús: node -r ts-node/register util/docx/test-sdt-persistence.ts <command> [params]');
    console.log('Commands:');
    console.log('  index <input_docx> <output_docx> - Indexa un document DOCX amb SDTs');
    console.log('  verify <docx_file> - Verifica la persistència dels SDTs en un document');
    console.log('  report <docx_file> - Genera un informe detallat sobre els SDTs del document');
    process.exit(1);
  }
  
  try {
    switch (command) {
      case 'index':
        await indexDocument(args[1], args[2]);
        break;
      case 'verify':
        await verifyDocument(args[1]);
        break;
      case 'report':
        await generateReport(args[1]);
        break;
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Indexa un document DOCX amb SDTs
 * @param inputPath Ruta al document DOCX original
 * @param outputPath Ruta on desar el document indexat
 */
async function indexDocument(inputPath?: string, outputPath?: string) {
  // Validar paràmetres
  if (!inputPath || !outputPath) {
    console.error('Error: Cal especificar els paths del document d\'entrada i sortida');
    console.log('Ús: node -r ts-node/register util/docx/test-sdt-persistence.ts index <input_docx> <output_docx>');
    process.exit(1);
  }
  
  console.log(`\n🔍 COMENÇANT INDEXACIÓ DE DOCUMENT`);
  console.log(`📄 Document d'entrada: ${inputPath}`);
  console.log(`📄 Document de sortida: ${outputPath}`);
  
  // Llegir el document original
  console.log(`\n📂 Llegint document original...`);
  const originalBuffer = fs.readFileSync(inputPath);
  console.log(`✅ Document original llegit: ${originalBuffer.length} bytes`);
  
  // Indexar el document
  console.log(`\n🔄 Indexant document amb SDTs...`);
  const result = await indexDocxWithSdts(originalBuffer);
  
  // Guardar el document indexat
  console.log(`\n💾 Desant document indexat...`);
  
  // Assegurar que existeix el directori de sortida
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, result.indexedBuffer);
  
  console.log(`✅ Document indexat desat correctament: ${result.indexedBuffer.length} bytes`);
  console.log(`🏷️ S'han indexat ${result.idMap.length} paràgrafs amb SDTs`);
  console.log(`\n📊 RESUM DE LA INDEXACIÓ:`);
  console.log(`   - Document original: ${originalBuffer.length} bytes`);
  console.log(`   - Document indexat: ${result.indexedBuffer.length} bytes`);
  console.log(`   - Paràgrafs indexats: ${result.idMap.length}`);
  console.log(`\n🎯 Document indexat disponible a: ${outputPath}`);
  console.log(`\n⚠️ PAS SEGÜENT: Obrir el document amb MS Word, fer canvis i desar-lo.`);
  console.log(`   Després, verifica la persistència amb:`);
  console.log(`   node -r ts-node/register util/docx/test-sdt-persistence.ts verify ${outputPath}`);
}

/**
 * Verifica la persistència dels SDTs en un document DOCX
 * @param docxPath Ruta al document DOCX a verificar
 */
async function verifyDocument(docxPath?: string) {
  // Validar paràmetres
  if (!docxPath) {
    console.error('Error: Cal especificar el path del document a verificar');
    console.log('Ús: node -r ts-node/register util/docx/test-sdt-persistence.ts verify <docx_file>');
    process.exit(1);
  }
  
  console.log(`\n🔍 COMENÇANT VERIFICACIÓ DE DOCUMENT`);
  console.log(`📄 Document a verificar: ${docxPath}`);
  
  // Llegir el document
  console.log(`\n📂 Llegint document...`);
  const docxBuffer = fs.readFileSync(docxPath);
  console.log(`✅ Document llegit: ${docxBuffer.length} bytes`);
  
  // Verificar la integritat dels SDTs
  console.log(`\n🔄 Verificant integritat dels SDTs...`);
  const result = await checkIndexedDocxIntegrity(docxBuffer);
  
  console.log(`\n📊 RESUM DE LA VERIFICACIÓ:`);
  console.log(`   - Total d'SDTs en el document: ${result.totalSdtsInDoc}`);
  console.log(`   - SDTs del sistema DocProof: ${result.docproofSdtCount}`);
  console.log(`   - SDTs mal formats: ${result.xmlAnalysis.brokenSdtCount}`);
  console.log(`   - Mida de l'XML: ${result.xmlAnalysis.completeXmlSize} bytes`);
  
  if (result.isIntegrityPreserved) {
    console.log(`\n✅ RESULTAT: INTEGRITAT PRESERVADA`);
    console.log(`   Els SDTs del sistema DocProof s'han preservat correctament.`);
    
    if (result.foundDocproofIds && result.foundDocproofIds.length > 0) {
      console.log(`\n🏷️ IDs trobats (mostra):`);
      result.foundDocproofIds.slice(0, 5).forEach((id, index) => {
        console.log(`   ${index + 1}. ${id}`);
      });
      
      if (result.foundDocproofIds.length > 5) {
        console.log(`   ... i ${result.foundDocproofIds.length - 5} més.`);
      }
    }
  } else {
    console.log(`\n❌ RESULTAT: INTEGRITAT COMPROMESA`);
    console.log(`   No s'han trobat SDTs del sistema DocProof en el document.`);
    console.log(`   Això pot indicar que Word ha eliminat els SDTs durant l'edició.`);
  }
  
  console.log(`\n⚠️ Per a un informe més detallat, executa:`);
  console.log(`   node -r ts-node/register util/docx/test-sdt-persistence.ts report ${docxPath} > report.txt`);
}

/**
 * Genera un informe detallat sobre els SDTs d'un document DOCX
 * @param docxPath Ruta al document DOCX a analitzar
 */
async function generateReport(docxPath?: string) {
  // Validar paràmetres
  if (!docxPath) {
    console.error('Error: Cal especificar el path del document a analitzar');
    console.log('Ús: node -r ts-node/register util/docx/test-sdt-persistence.ts report <docx_file>');
    process.exit(1);
  }
  
  // Llegir el document
  const docxBuffer = fs.readFileSync(docxPath);
  
  // Generar informe
  const report = await generateSdtDetailedReport(docxBuffer);
  
  // Imprimir informe (per defecte a stdout, però es pot redirigir a un fitxer)
  console.log(report);
}

// Executar la funció principal
main().catch(error => {
  console.error('Error no controlat:', error);
  process.exit(1);
});
