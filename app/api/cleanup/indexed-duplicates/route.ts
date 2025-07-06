import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';

/**
 * API per netejar fitxers duplicats /indexed/original.docx
 * Elimina tots els fitxers amb patró /indexed/original.docx i manté només /indexed/indexed.docx
 */
export async function POST(request: NextRequest) {
  console.log('[API cleanup-indexed-duplicates] Iniciant neteja de fitxers duplicats');

  // 1. Verificar autenticació
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autenticat. Falten credencials.' }, { status: 401 });
  }
  const accessToken = authHeader.replace('Bearer ', '').trim();
  
  const userSupabaseClient = createUserSupabaseClient(accessToken);
  const { data: userData, error: userError } = await userSupabaseClient.auth.getUser();

  if (userError || !userData?.user) {
    console.error("[API cleanup-indexed-duplicates] Error verificant usuari:", userError);
    return NextResponse.json({ error: 'Usuari no autenticat o token invàlid.' }, { status: 401 });
  }
  const userId = userData.user.id;
  console.log("[API cleanup-indexed-duplicates] Usuari autenticat:", userId);

  // 2. Crear client amb service role key
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  try {
    const results = {
      scanned: 0,
      duplicatesFound: 0,
      duplicatesDeleted: 0,
      errors: [] as string[],
      deletedFiles: [] as string[]
    };

    // 3. Buscar tots els fitxers a la carpeta indexed de l'usuari
    console.log(`[API cleanup-indexed-duplicates] Buscant fitxers a user-${userId}/`);
    
    // Llistar tots els directoris de templates de l'usuari
    const { data: userDirs, error: userDirsError } = await serviceClient.storage
      .from('template-docx')
      .list(`user-${userId}`);

    if (userDirsError) {
      console.error('[API cleanup-indexed-duplicates] Error llistant directoris d\'usuari:', userDirsError);
      return NextResponse.json({ error: 'Error accedint a l\'emmagatzematge' }, { status: 500 });
    }

    if (!userDirs || userDirs.length === 0) {
      console.log('[API cleanup-indexed-duplicates] No s\'han trobat directoris per aquest usuari');
      return NextResponse.json({ 
        message: 'No s\'han trobat directoris per aquest usuari',
        results 
      }, { status: 200 });
    }

    // 4. Per cada directori de template, buscar carpeta indexed
    for (const templateDir of userDirs) {
      if (!templateDir.name.startsWith('template-')) continue;
      
      const indexedPath = `user-${userId}/${templateDir.name}/indexed`;
      console.log(`[API cleanup-indexed-duplicates] Escanejant: ${indexedPath}`);
      
      try {
        const { data: indexedFiles, error: indexedError } = await serviceClient.storage
          .from('template-docx')
          .list(indexedPath);

        if (indexedError) {
          console.log(`[API cleanup-indexed-duplicates] No s'ha pogut accedir a ${indexedPath}:`, indexedError.message);
          continue;
        }

        if (!indexedFiles || indexedFiles.length === 0) {
          console.log(`[API cleanup-indexed-duplicates] No hi ha fitxers a ${indexedPath}`);
          continue;
        }

        results.scanned += indexedFiles.length;

        // 5. Buscar fitxers amb patró original.docx
        const duplicateFiles = indexedFiles.filter(file => 
          file.name.toLowerCase().endsWith('original.docx')
        );

        if (duplicateFiles.length > 0) {
          console.log(`[API cleanup-indexed-duplicates] Trobats ${duplicateFiles.length} fitxers duplicats a ${indexedPath}:`);
          duplicateFiles.forEach(file => console.log(`  - ${file.name}`));
          
          results.duplicatesFound += duplicateFiles.length;

          // 6. Eliminar cada fitxer duplicat
          for (const duplicateFile of duplicateFiles) {
            const fullPath = `${indexedPath}/${duplicateFile.name}`;
            
            try {
              const { error: deleteError } = await serviceClient.storage
                .from('template-docx')
                .remove([fullPath]);

              if (deleteError) {
                console.error(`[API cleanup-indexed-duplicates] Error eliminant ${fullPath}:`, deleteError);
                results.errors.push(`Error eliminant ${fullPath}: ${deleteError.message}`);
              } else {
                console.log(`[API cleanup-indexed-duplicates] ✅ Eliminat: ${fullPath}`);
                results.deletedFiles.push(fullPath);
                results.duplicatesDeleted++;
              }
            } catch (deleteException) {
              console.error(`[API cleanup-indexed-duplicates] Excepció eliminant ${fullPath}:`, deleteException);
              results.errors.push(`Excepció eliminant ${fullPath}: ${deleteException}`);
            }
          }
        }

      } catch (scanError) {
        console.error(`[API cleanup-indexed-duplicates] Error escanejant ${indexedPath}:`, scanError);
        results.errors.push(`Error escanejant ${indexedPath}: ${scanError}`);
      }
    }

    // 7. Resum final
    console.log('[API cleanup-indexed-duplicates] Neteja completada:', results);

    return NextResponse.json({
      success: true,
      message: `Neteja completada. ${results.duplicatesDeleted} fitxers eliminats de ${results.duplicatesFound} trobats.`,
      results
    }, { status: 200 });

  } catch (error) {
    console.error('[API cleanup-indexed-duplicates] Error general:', error);
    return NextResponse.json({ 
      error: 'Error intern durant la neteja',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * GET endpoint per obtenir informació sobre fitxers duplicats sense eliminar-los
 */
export async function GET(request: NextRequest) {
  console.log('[API cleanup-indexed-duplicates] Mode només lectura - escanejant duplicats');

  // Autenticació similar al POST
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autenticat. Falten credencials.' }, { status: 401 });
  }
  const accessToken = authHeader.replace('Bearer ', '').trim();
  
  const userSupabaseClient = createUserSupabaseClient(accessToken);
  const { data: userData, error: userError } = await userSupabaseClient.auth.getUser();

  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Usuari no autenticat o token invàlid.' }, { status: 401 });
  }
  const userId = userData.user.id;

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  try {
    const results = {
      scanned: 0,
      duplicatesFound: 0,
      duplicateFiles: [] as string[]
    };

    // Llistar directoris de templates
    const { data: userDirs, error: userDirsError } = await serviceClient.storage
      .from('template-docx')
      .list(`user-${userId}`);

    if (userDirsError || !userDirs) {
      return NextResponse.json({ error: 'Error accedint a l\'emmagatzematge' }, { status: 500 });
    }

    // Escanejar cada directori
    for (const templateDir of userDirs) {
      if (!templateDir.name.startsWith('template-')) continue;
      
      const indexedPath = `user-${userId}/${templateDir.name}/indexed`;
      
      try {
        const { data: indexedFiles, error: indexedError } = await serviceClient.storage
          .from('template-docx')
          .list(indexedPath);

        if (indexedError || !indexedFiles) continue;

        results.scanned += indexedFiles.length;

        // Buscar duplicats
        const duplicates = indexedFiles.filter(file => 
          file.name.toLowerCase().endsWith('original.docx')
        );

        if (duplicates.length > 0) {
          results.duplicatesFound += duplicates.length;
          duplicates.forEach(file => {
            results.duplicateFiles.push(`${indexedPath}/${file.name}`);
          });
        }

      } catch (scanError) {
        console.warn(`Error escanejant ${indexedPath}:`, scanError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Escanejat completat. ${results.duplicatesFound} fitxers duplicats trobats.`,
      results
    }, { status: 200 });

  } catch (error) {
    console.error('[API cleanup-indexed-duplicates GET] Error:', error);
    return NextResponse.json({ 
      error: 'Error intern durant l\'escaneig',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
