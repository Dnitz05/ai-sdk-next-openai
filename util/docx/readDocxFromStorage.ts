import { createClient } from '@supabase/supabase-js';
import mammoth from 'mammoth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getDocxTextContent(storagePath: string): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin.storage.from('documents').download(storagePath);

    if (error) {
      console.error(`[readDocxFromStorage] Supabase storage error details for path "${storagePath}":`, JSON.stringify(error, null, 2));
      throw new Error(`Error descarregant el document: ${error.message || 'Unknown Supabase storage error'}`);
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
