import { createClient } from '@supabase/supabase-js';
import mammoth from 'mammoth';

// Verificar variables d'entorn abans de crear el client
console.log(`[readDocxFromStorage] Verificant variables d'entorn...`);
console.log(`[readDocxFromStorage] NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'PRESENT' : 'MISSING'}`);
console.log(`[readDocxFromStorage] SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'PRESENT' : 'MISSING'}`);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL no està definida en les variables d\'entorn del worker');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY no està definida en les variables d\'entorn del worker');
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log(`[readDocxFromStorage] ✅ Client Supabase creat correctament`);

export async function getDocxTextContent(storagePath: string): Promise<string> {
  try {
    console.log(`[readDocxFromStorage] Intentant descarregar el document des de la ruta: "${storagePath}"`);
    
    // DIAGNÒSTIC AVANÇAT: Verificar si el fitxer existeix primer
    console.log(`[readDocxFromStorage] Verificant si el fitxer existeix...`);
    const { data: listData, error: listError } = await supabaseAdmin.storage
      .from('template-docx')
      .list(storagePath.substring(0, storagePath.lastIndexOf('/')), {
        limit: 100,
        search: storagePath.substring(storagePath.lastIndexOf('/') + 1)
      });
    
    if (listError) {
      console.error(`[readDocxFromStorage] Error llistant fitxers:`, listError);
    } else {
      console.log(`[readDocxFromStorage] Fitxers trobats al directori:`, listData?.map(f => f.name));
      const fileName = storagePath.substring(storagePath.lastIndexOf('/') + 1);
      const fileExists = listData?.some(f => f.name === fileName);
      console.log(`[readDocxFromStorage] Fitxer "${fileName}" existeix: ${fileExists}`);
    }
    
    // Intentar descarregar el fitxer
    const { data, error } = await supabaseAdmin.storage.from('template-docx').download(storagePath);

    if (error) {
      let errorMessage = 'Error desconegut de Supabase Storage.';
      if (error.message) errorMessage = error.message;
      
      console.error(`[readDocxFromStorage] Error de Supabase Storage en descarregar "${storagePath}":`);
      console.error(`  Nom de l'error: ${error.name}`);
      console.error(`  Missatge: ${error.message}`);
      console.error(`  Stack: ${error.stack}`);
      // Supabase StorageError pot tenir propietats addicionals
      if ((error as any).status) console.error(`  Status: ${(error as any).status}`);
      if ((error as any).statusCode) console.error(`  StatusCode: ${(error as any).statusCode}`);
      if ((error as any).details) console.error(`  Details: ${(error as any).details}`);
      if ((error as any).error_description) console.error(`  Error Description: ${(error as any).error_description}`);
      if ((error as any).hint) console.error(`  Hint: ${(error as any).hint}`);
      console.error(`  Error complet (JSON): ${JSON.stringify(error, null, 2)}`);
      
      // DIAGNÒSTIC AVANÇAT: Verificar permisos del bucket
      console.log(`[readDocxFromStorage] Verificant permisos del bucket 'template-docx'...`);
      const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();
      if (bucketsError) {
        console.error(`[readDocxFromStorage] Error obtenint buckets:`, bucketsError);
      } else {
        console.log(`[readDocxFromStorage] Buckets disponibles:`, buckets?.map(b => b.name));
        const templateDocxBucket = buckets?.find(b => b.name === 'template-docx');
        if (templateDocxBucket) {
          console.log(`[readDocxFromStorage] Bucket 'template-docx' trobat:`, {
            id: templateDocxBucket.id,
            name: templateDocxBucket.name,
            public: templateDocxBucket.public,
            file_size_limit: templateDocxBucket.file_size_limit,
            allowed_mime_types: templateDocxBucket.allowed_mime_types
          });
        } else {
          console.error(`[readDocxFromStorage] Bucket 'template-docx' NO trobat!`);
        }
      }

      throw new Error(`Error descarregant el document "${storagePath}": ${errorMessage}`);
    }

    if (!data) {
      throw new Error(`No s'han rebut dades del document des de Supabase storage per a la ruta: ${storagePath}`);
    }

    const buffer = await data.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
    
    return value;
  } catch (err) {
    console.error(`[readDocxFromStorage] Error processant el document ${storagePath}:`, err);
    throw err;
  }
}

/**
 * Llegeix un document DOCX des de Supabase Storage i retorna el buffer
 * @param storagePath Path del document a Supabase Storage
 * @returns Buffer del document
 */
export async function readDocxFromStorage(storagePath: string): Promise<Buffer> {
  try {
    console.log(`[readDocxFromStorage] Descarregant buffer del document des de: "${storagePath}"`);
    const { data, error } = await supabaseAdmin.storage.from('template-docx').download(storagePath);

    if (error) {
      console.error(`[readDocxFromStorage] Error de Supabase Storage:`, error);
      throw new Error(`Error descarregant el document "${storagePath}": ${error.message}`);
    }

    if (!data) {
      throw new Error(`No s'han rebut dades del document des de Supabase storage per a la ruta: ${storagePath}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error(`[readDocxFromStorage] Error obtenint buffer del document ${storagePath}:`, err);
    throw err;
  }
}
