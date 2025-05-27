/**
 * API endpoint TEMPORAL i PÚBLIC per testejar la verificació dels SDTs en documents DOCX
 * 
 * Aquest endpoint és idèntic a verify-sdt-persistence però sense requerir autenticació.
 * IMPORTANT: Aquest fitxer és només per testing i s'ha d'esborrar després de les proves.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkIndexedDocxIntegrity } from '../../../util/docx/verifySdtPersistence';

export async function POST(request: NextRequest) {
  try {
    console.log('[test-sdt-public] 🧪 ENDPOINT DE TEST - Rebent petició de verificació...');
    
    // Obtenir el fitxer del form data
    const formData = await request.formData();
    const file = formData.get('docx') as File;
    
    if (!file) {
      console.error('[test-sdt-public] No s\'ha trobat cap fitxer DOCX a la petició');
      return NextResponse.json(
        { 
          success: false, 
          error: 'No s\'ha proporcionat cap fitxer DOCX. Utilitza el camp "docx" per pujar el fitxer.',
          note: '🧪 Aquest és un endpoint de test públic. No requereix autenticació.'
        },
        { status: 400 }
      );
    }

    // Validar que sigui un fitxer DOCX
    if (!file.name.toLowerCase().endsWith('.docx')) {
      console.error('[test-sdt-public] El fitxer no té extensió .docx:', file.name);
      return NextResponse.json(
        { 
          success: false, 
          error: 'El fitxer ha de tenir extensió .docx',
          note: '🧪 Aquest és un endpoint de test públic. No requereix autenticació.'
        },
        { status: 400 }
      );
    }

    console.log(`[test-sdt-public] Processant fitxer: ${file.name} (${file.size} bytes)`);

    // Convertir el fitxer a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const docxBuffer = Buffer.from(arrayBuffer);

    console.log(`[test-sdt-public] Fitxer convertit a buffer: ${docxBuffer.length} bytes`);

    // Verificar la integritat dels SDTs
    console.log('[test-sdt-public] Iniciant verificació d\'integritat...');
    const verificationResult = await checkIndexedDocxIntegrity(docxBuffer);

    console.log(`[test-sdt-public] Verificació completada:`);
    console.log(`  - Total SDTs: ${verificationResult.totalSdtsInDoc}`);
    console.log(`  - SDTs DocProof: ${verificationResult.docproofSdtCount}`);
    console.log(`  - Integritat preservada: ${verificationResult.isIntegrityPreserved}`);

    // Preparar la resposta
    const response = {
      success: true,
      fileName: file.name,
      fileSize: file.size,
      testNote: '🧪 Aquest resultat prové de l\'endpoint de test públic',
      verification: {
        totalSdtsInDoc: verificationResult.totalSdtsInDoc,
        docproofSdtCount: verificationResult.docproofSdtCount,
        isIntegrityPreserved: verificationResult.isIntegrityPreserved,
        foundDocproofIds: verificationResult.foundDocproofIds || [],
        xmlAnalysis: {
          completeXmlSize: verificationResult.xmlAnalysis.completeXmlSize,
          hasBrokenStructure: verificationResult.xmlAnalysis.hasBrokenStructure,
          brokenSdtCount: verificationResult.xmlAnalysis.brokenSdtCount
        }
      },
      summary: {
        status: verificationResult.isIntegrityPreserved ? 'INTEGRITAT PRESERVADA' : 'INTEGRITAT COMPROMESA',
        message: verificationResult.isIntegrityPreserved 
          ? `Els SDTs del sistema DocProof s'han preservat correctament. S'han trobat ${verificationResult.docproofSdtCount} SDTs amb els nostres identificadors.`
          : `No s'han trobat SDTs del sistema DocProof. Això indica que Word podria haver eliminat els SDTs durant l'edició.`,
        recommendations: verificationResult.isIntegrityPreserved 
          ? ['El document està llest per generar placeholders basats en IDs']
          : [
              'Verifica que el document original estava correctament indexat',
              'Comprova si Word ha eliminat els SDTs durant l\'edició',
              'Considera re-indexar el document abans d\'editar amb Word'
            ]
      }
    };

    console.log('[test-sdt-public] 🧪 Enviant resposta exitosa des de l\'endpoint de test');
    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[test-sdt-public] Error processant la petició:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Error intern del servidor: ${error instanceof Error ? error.message : 'Error desconegut'}`,
        details: error instanceof Error ? error.stack : undefined,
        testNote: '🧪 Aquest error prové de l\'endpoint de test públic'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Endpoint informatiu per mostrar com utilitzar l'API de test
  return NextResponse.json({
    endpoint: '/api/test-sdt-public',
    method: 'POST',
    description: '🧪 ENDPOINT DE TEST PÚBLIC - Verifica la persistència dels SDTs en documents DOCX sense autenticació',
    warning: '⚠️ Aquest endpoint és temporal i només per testing. S\'ha d\'esborrar després de les proves.',
    usage: {
      contentType: 'multipart/form-data',
      fields: {
        docx: 'Fitxer DOCX a verificar (obligatori)'
      }
    },
    example: {
      postman: {
        method: 'POST',
        url: 'https://ai-sdk-next-openai-5k895w1go-dnitzs-projects.vercel.app/api/test-sdt-public',
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        body: {
          type: 'form-data',
          fields: [
            {
              key: 'docx',
              type: 'file',
              description: 'Selecciona el fitxer DOCX a verificar'
            }
          ]
        }
      }
    },
    response_format: {
      success: 'boolean',
      fileName: 'string',
      fileSize: 'number',
      testNote: 'string',
      verification: {
        totalSdtsInDoc: 'number',
        docproofSdtCount: 'number',
        isIntegrityPreserved: 'boolean',
        foundDocproofIds: 'string[]',
        xmlAnalysis: {
          completeXmlSize: 'number',
          hasBrokenStructure: 'boolean',
          brokenSdtCount: 'number'
        }
      },
      summary: {
        status: 'string',
        message: 'string',
        recommendations: 'string[]'
      }
    }
  });
}
