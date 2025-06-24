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
      throw new Error(`Error descarregant el document: ${error.message}`);
    }

    const buffer = await data.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
    
    return value;
  } catch (err) {
    console.error(`[readDocxFromStorage] Error processant el document ${storagePath}:`, err);
    throw err;
  }
}
