import { createClient } from '@supabase/supabase-js';
import mammoth from 'mammoth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getDocxTextContent(storagePath: string): Promise<string> {
  try {
    console.log(`[readDocxFromStorage] Intentant descarregar el document des de la ruta: "${storagePath}"`);
    const { data, error } = await supabaseAdmin.storage.from('documents').download(storagePath);

    if (error) {
      let errorMessage = 'Error desconegut de Supabase Storage.';
      if (error.message) errorMessage = error.message;
      
      console.error(`[readDocxFromStorage] Error de Supabase Storage en descarregar "${storagePath}":`);
      console.error(`  Nom de l'error: ${error.name}`);
      console.error(`  Missatge: ${error.message}`);
      console.error(`  Stack: ${error.stack}`);
      // Supabase StorageError pot tenir propietats addicionals
      if ((error as any).status) console.error(`  Status: ${(error as any).status}`);
      if ((error as any).details) console.error(`  Details: ${(error as any).details}`);
      if ((error as any).error_description) console.error(`  Error Description: ${(error as any).error_description}`);
      console.error(`  Error complet (JSON): ${JSON.stringify(error, null, 2)}`);

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
    const { data, error } = await supabaseAdmin.storage.from('documents').download(storagePath);

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
