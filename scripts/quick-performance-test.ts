process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://dummy.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-service-key';

import { SmartDocumentProcessor } from '../lib/smart/SmartDocumentProcessor';
import PizZip from 'pizzip';
import * as fs from 'fs';

async function quickTest() {
  console.log('⚡ TEST RÀPID DE RENDIMENT POST-OPTIMITZACIÓ\n');
  console.log('='.repeat(60));
  
  // Crear una plantilla DOCX mínima en memòria
  console.log('📝 Creant plantilla DOCX de test...');
  
  const documentXml = `<?xml version="1.0"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:r><w:t>DOCUMENT DE TEST</w:t></w:r></w:p>
        <w:p><w:r><w:t>Contractista: {{CONTRACTISTA}}</w:t></w:r></w:p>
        <w:p><w:r><w:t>NIF: {{NIF}}</w:t></w:r></w:p>
        <w:p><w:r><w:t>Obra: {{OBRA}}</w:t></w:r></w:p>
        <w:p><w:r><w:t>Import: {{IMPORT}} euros</w:t></w:r></w:p>
        <w:p><w:r><w:t>Data: {{DATA_ACTUAL}}</w:t></w:r></w:p>
      </w:body>
    </w:document>`;
  
  const zip = new PizZip();
  zip.file('word/document.xml', documentXml);
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="xml" ContentType="application/xml"/>
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`);
  
  const templateBuffer = zip.generate({ type: 'nodebuffer' });
  console.log(`✅ Plantilla creada: ${templateBuffer.length} bytes\n`);
  
  const testData = {
    CONTRACTISTA: 'Empresa Test SL',
    NIF: 'B12345678',
    OBRA: 'Reforma oficines centrals',
    IMPORT: '45.000,00',
    DATA_ACTUAL: new Date().toLocaleDateString('ca-ES'),
    ANY_ACTUAL: new Date().getFullYear().toString(),
    MES_ACTUAL: new Date().toLocaleDateString('ca-ES', { month: 'long' })
  };

  // Set dummy env vars for test
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://dummy.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-service-key';
  
  const processor = new SmartDocumentProcessor();
  (processor as any).downloadTemplateFromStorage = async () => templateBuffer;
  
  console.log('🚀 Executant 5 tests de rendiment...\n');
  
  const timings: number[] = [];
  let errorCount = 0;
  
  for (let i = 1; i <= 5; i++) {
    const startTime = Date.now();
    
    try {
      const result = await processor.processSingle(
        '',
        'mock-template.docx',
        testData,
        'test-template-id',
        'test-user-id'
      );
      
      const elapsed = Date.now() - startTime;
      timings.push(elapsed);
      
      console.log(`Test ${i}: ✅ ${elapsed}ms`);
      
      if (i === 1 && result.documentBuffer) {
        fs.writeFileSync('test-output.docx', result.documentBuffer);
        console.log(`         💾 Document guardat: test-output.docx`);
      }
      
    } catch (error: any) {
      errorCount++;
      console.log(`Test ${i}: ❌ Error - ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTATS POST-OPTIMITZACIÓ:');
  console.log('='.repeat(60));
  
  if (timings.length > 0) {
    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
    const min = Math.min(...timings);
    const max = Math.max(...timings);
    
    console.log(`\n⚡ Temps mitjà: ${avg.toFixed(0)}ms`);
    console.log(`⚡ Temps mínim: ${min}ms`);
    console.log(`⚡ Temps màxim: ${max}ms`);
    console.log(`📈 Documents per segon: ${(1000 / avg).toFixed(2)}`);
    console.log(`❌ Errors: ${errorCount}/5`);
    
    console.log('\n📊 COMPARACIÓ AMB SISTEMA ANTERIOR:');
    console.log('   ABANS (amb cleanBrokenPlaceholders): ~12.000ms');
    console.log(`   ARA (sense preprocessador): ${avg.toFixed(0)}ms`);
    console.log(`   🚀 MILLORA: ${(12000 / avg).toFixed(1)}x més ràpid!`);
    
    if (avg < 500) {
      console.log('\n🏆 INCREÏBLE! Rendiment EXCEPCIONAL (<500ms)!');
    } else if (avg < 1000) {
      console.log('\n🎉 EXCEL·LENT! Objectiu <1 segon aconseguit!');
    } else if (avg < 3000) {
      console.log('\n✅ MOLT BÉ! Objectiu <3 segons aconseguit!');
    } else {
      console.log('\n⚠️  Encara triga més de 3 segons');
    }
  } else {
    console.log('❌ No s\'han pogut completar tests');
  }
}

quickTest()
  .then(() => console.log('\n✅ TEST COMPLETAT'))
  .catch(console.error);
