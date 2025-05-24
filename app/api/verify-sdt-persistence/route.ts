/**
 * API endpoint per verificar la persistència dels SDTs en documents DOCX
 * 
 * Aquest endpoint permet pujar un document DOCX i verificar si els 
 * Structure Document Tags (SDTs) amb el prefix 'docproof_pid_' s'han 
 * preservat correctament després d'editar el document amb MS Word.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkIndexedDocxIntegrity } from '../../../util/docx/verifySdtPersistence';

export async function POST(request: NextRequest) {
  try {
    console.log('[verify-sdt-persistence] Rebent petició de verificació...');
    
    // Obtenir el fitxer del form data
    const formData = await request.formData();
    const file = formData.get('docx') as File;
    
    if (!file) {
      console.error('[verify-sdt-persistence] No s\'ha trobat cap fitxer DOCX a la petició');
      return NextResponse.json(
        { 
          success: false, 
          error: 'No s\'ha proporcionat cap fitxer DOCX. Utilitza el camp "docx" per pujar el fitxer.' 
        },
        { status: 400 }
      );
    }

    // Validar que sigui un fitxer DOCX
    if (!file.name.toLowerCase().endsWith('.docx')) {
      console.error('[verify-sdt-persistence] El fitxer no té extensió .docx:', file.name);
      return NextResponse.json(
        { 
          success: false, 
          error: 'El fitxer ha de tenir extensió .docx' 
        },
        { status: 400 }
      );
    }

    console.log(`[verify-sdt-persistence] Processant fitxer: ${file.name} (${file.size} bytes)`);

    // Convertir el fitxer a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const docxBuffer = Buffer.from(arrayBuffer);

    console.log(`[verify-sdt-persistence] Fitxer convertit a buffer: ${docxBuffer.length} bytes`);

    // Verificar la integritat dels SDTs
    console.log('[verify-sdt-persistence] Iniciant verificació d\'integritat...');
    const verificationResult = await checkIndexedDocxIntegrity(docxBuffer);

    console.log(`[verify-sdt-persistence] Verificació completada:`);
    console.log(`  - Total SDTs: ${verificationResult.totalSdtsInDoc}`);
    console.log(`  - SDTs DocProof: ${verificationResult.docproofSdtCount}`);
    console.log(`  - Integritat preservada: ${verificationResult.isIntegrityPreserved}`);

    // Preparar la resposta
    const response = {
      success: true,
      fileName: file.name,
      fileSize: file.size,
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

    console.log('[verify-sdt-persistence] Enviant resposta exitosa');
    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[verify-sdt-persistence] Error processant la petició:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Error intern del servidor: ${error instanceof Error ? error.message : 'Error desconegut'}`,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Endpoint informatiu per mostrar com utilitzar l'API
  return NextResponse.json({
    endpoint: '/api/verify-sdt-persistence',
    method: 'POST',
    description: 'Verifica la persistència dels SDTs en documents DOCX',
    usage: {
      contentType: 'multipart/form-data',
      fields: {
        docx: 'Fitxer DOCX a verificar (obligatori)'
      }
    },
    example: {
      postman: {
        method: 'POST',
        url: 'https://your-vercel-url.vercel.app/api/verify-sdt-persistence',
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
