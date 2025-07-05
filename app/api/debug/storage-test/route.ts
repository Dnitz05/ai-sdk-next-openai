import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    console.log(`[StorageTest] Iniciant test de connectivitat amb Supabase Storage...`);
    
    // Verificar variables d'entorn
    console.log(`[StorageTest] NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'PRESENT' : 'MISSING'}`);
    console.log(`[StorageTest] SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'PRESENT' : 'MISSING'}`);
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Variables d\'entorn faltants',
        details: {
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'PRESENT' : 'MISSING',
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'PRESENT' : 'MISSING'
        }
      }, { status: 500 });
    }
    
    // Crear client Supabase
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    console.log(`[StorageTest] ✅ Client Supabase creat correctament`);
    
    // Test 1: Llistar buckets
    console.log(`[StorageTest] Test 1: Llistant buckets...`);
    const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();
    
    if (bucketsError) {
      console.error(`[StorageTest] Error llistant buckets:`, bucketsError);
      return NextResponse.json({
        success: false,
        error: 'Error llistant buckets',
        details: bucketsError
      }, { status: 500 });
    }
    
    console.log(`[StorageTest] Buckets trobats:`, buckets?.map(b => b.name));
    
    // Test 2: Verificar bucket 'documents'
    const documentsBucket = buckets?.find(b => b.name === 'documents');
    if (!documentsBucket) {
      return NextResponse.json({
        success: false,
        error: 'Bucket "documents" no trobat',
        availableBuckets: buckets?.map(b => b.name) || []
      }, { status: 404 });
    }
    
    console.log(`[StorageTest] Bucket 'documents' trobat:`, documentsBucket);
    
    // Test 3: Llistar fitxers al bucket documents (primer nivell)
    console.log(`[StorageTest] Test 3: Llistant fitxers al bucket documents...`);
    const { data: files, error: filesError } = await supabaseAdmin.storage
      .from('documents')
      .list('', { limit: 10 });
    
    if (filesError) {
      console.error(`[StorageTest] Error llistant fitxers:`, filesError);
      return NextResponse.json({
        success: false,
        error: 'Error llistant fitxers del bucket documents',
        details: filesError
      }, { status: 500 });
    }
    
    console.log(`[StorageTest] Fitxers/directoris trobats:`, files?.map(f => ({ name: f.name, id: f.id })));
    
    // Test 4: Intentar accedir a un path específic si es proporciona
    const testPath = request.nextUrl.searchParams.get('path');
    let pathTestResult: any = null;
    
    if (testPath) {
      console.log(`[StorageTest] Test 4: Verificant path específic: "${testPath}"`);
      
      // Intentar llistar el directori del path
      const pathDir = testPath.substring(0, testPath.lastIndexOf('/'));
      const fileName = testPath.substring(testPath.lastIndexOf('/') + 1);
      
      const { data: pathFiles, error: pathError } = await supabaseAdmin.storage
        .from('documents')
        .list(pathDir, { limit: 100 });
      
      if (pathError) {
        console.error(`[StorageTest] Error llistant directori "${pathDir}":`, pathError);
        pathTestResult = {
          success: false,
          error: `Error llistant directori "${pathDir}"`,
          details: pathError
        };
      } else {
        const fileExists = pathFiles?.some(f => f.name === fileName);
        console.log(`[StorageTest] Fitxers al directori "${pathDir}":`, pathFiles?.map(f => f.name));
        console.log(`[StorageTest] Fitxer "${fileName}" existeix: ${fileExists}`);
        
        pathTestResult = {
          success: true,
          directory: pathDir,
          fileName: fileName,
          fileExists: fileExists,
          filesInDirectory: pathFiles?.map(f => f.name) || []
        };
        
        // Test 5: Si el fitxer existeix, intentar descarregar-lo
        if (fileExists) {
          console.log(`[StorageTest] Test 5: Intentant descarregar "${testPath}"...`);
          const { data: downloadData, error: downloadError } = await supabaseAdmin.storage
            .from('documents')
            .download(testPath);
          
          if (downloadError) {
            console.error(`[StorageTest] Error descarregant fitxer:`, downloadError);
            pathTestResult.downloadTest = {
              success: false,
              error: 'Error descarregant fitxer',
              details: downloadError
            };
          } else {
            const size = downloadData ? await downloadData.size : 0;
            console.log(`[StorageTest] ✅ Fitxer descarregat correctament. Mida: ${size} bytes`);
            pathTestResult.downloadTest = {
              success: true,
              fileSize: size,
              contentType: downloadData?.type || 'unknown'
            };
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Test de connectivitat amb Supabase Storage completat',
      results: {
        environmentVariables: {
          NEXT_PUBLIC_SUPABASE_URL: 'PRESENT',
          SUPABASE_SERVICE_ROLE_KEY: 'PRESENT'
        },
        buckets: buckets?.map(b => ({
          name: b.name,
          id: b.id,
          public: b.public,
          file_size_limit: b.file_size_limit
        })) || [],
        documentsBucket: documentsBucket ? {
          name: documentsBucket.name,
          id: documentsBucket.id,
          public: documentsBucket.public,
          file_size_limit: documentsBucket.file_size_limit,
          allowed_mime_types: documentsBucket.allowed_mime_types
        } : null,
        topLevelFiles: files?.map(f => ({
          name: f.name,
          id: f.id,
          updated_at: f.updated_at,
          created_at: f.created_at,
          last_accessed_at: f.last_accessed_at
        })) || [],
        pathTest: pathTestResult
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[StorageTest] Error durant el test:', error);
    return NextResponse.json({
      success: false,
      error: 'Error durant el test de connectivitat',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
