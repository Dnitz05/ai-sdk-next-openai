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

/**
 * Valida que un path de storage és vàlid i no conté caràcters problemàtics
 */
function validateStoragePath(storagePath: string): { isValid: boolean; error?: string; normalizedPath?: string } {
  if (!storagePath || storagePath.trim() === '') {
    return { isValid: false, error: 'Path buit o null' };
  }

  let normalizedPath = storagePath.trim();
  
  // Eliminar barra inicial si existeix
  if (normalizedPath.startsWith('/')) {
    normalizedPath = normalizedPath.substring(1);
  }

  // Verificar que no contingui dobles barres
  if (normalizedPath.includes('//')) {
    return { isValid: false, error: 'Path conté dobles barres' };
  }

  // Verificar que tingui extensió .docx
  if (!normalizedPath.toLowerCase().endsWith('.docx')) {
    return { isValid: false, error: 'Path ha de tenir extensió .docx' };
  }

  // Verificar que no contingui caràcters problemàtics
  const problematicChars = ['<', '>', ':', '"', '|', '?', '*'];
  for (const char of problematicChars) {
    if (normalizedPath.includes(char)) {
      return { isValid: false, error: `Path conté caràcter problemàtic: ${char}` };
    }
  }

  return { isValid: true, normalizedPath };
}

/**
 * Valida que un buffer és un DOCX vàlid
 */
function validateDocxBuffer(buffer: Buffer): { isValid: boolean; error?: string } {
  try {
    // Verificar mida mínima
    if (buffer.length < 100) {
      return { isValid: false, error: `Buffer massa petit: ${buffer.length} bytes` };
    }

    // Verificar signatura ZIP (DOCX és un format ZIP)
    const uint8Array = new Uint8Array(buffer);
    if (uint8Array[0] !== 0x50 || uint8Array[1] !== 0x4B) {
      return { isValid: false, error: 'No és un fitxer ZIP vàlid (signatura incorrecta)' };
    }

    return { isValid: true };

  } catch (error: any) {
    return { isValid: false, error: `Error validant buffer: ${error.message}` };
  }
}

/**
 * Diagnòstic avançat per verificar l'existència d'un fitxer
 */
async function diagnosticFileExistence(storagePath: string): Promise<void> {
  try {
    console.log(`[readDocxFromStorage] 🔍 DIAGNÒSTIC: Verificant existència del fitxer...`);
    
    const directoryPath = storagePath.substring(0, storagePath.lastIndexOf('/'));
    const fileName = storagePath.substring(storagePath.lastIndexOf('/') + 1);
    
    console.log(`[readDocxFromStorage] Directori: "${directoryPath}"`);
    console.log(`[readDocxFromStorage] Nom del fitxer: "${fileName}"`);
    
    const { data: listData, error: listError } = await supabaseAdmin.storage
      .from('template-docx')
      .list(directoryPath, { limit: 100 });
    
    if (listError) {
      console.error(`[readDocxFromStorage] Error llistant directori:`, listError);
    } else {
      console.log(`[readDocxFromStorage] Fitxers al directori "${directoryPath}":`, listData?.map(f => f.name));
      const fileExists = listData?.some(f => f.name === fileName);
      console.log(`[readDocxFromStorage] Fitxer "${fileName}" existeix: ${fileExists}`);
      
      if (!fileExists) {
        console.error(`[readDocxFromStorage] ❌ FITXER NO TROBAT: "${fileName}" no existeix al directori "${directoryPath}"`);
        console.log(`[readDocxFromStorage] Fitxers disponibles:`, listData?.map(f => f.name));
      }
    }
    
  } catch (diagError: any) {
    console.error(`[readDocxFromStorage] Error en diagnòstic:`, diagError);
  }
}

export async function getDocxTextContent(storagePath: string): Promise<string> {
  console.log(`[getDocxTextContent] Iniciant lectura de text des de: "${storagePath}"`);
  
  try {
    // STEP 1: Validar path
    const pathValidation = validateStoragePath(storagePath);
    if (!pathValidation.isValid) {
      throw new Error(`Path invàlid: ${pathValidation.error}`);
    }
    
    const normalizedPath = pathValidation.normalizedPath!;
    console.log(`[getDocxTextContent] Path normalitzat: "${normalizedPath}"`);
    
    // STEP 2: Diagnòstic d'existència
    await diagnosticFileExistence(normalizedPath);
    
    // STEP 3: Descarregar fitxer
    console.log(`[getDocxTextContent] Descarregant fitxer...`);
    const { data, error } = await supabaseAdmin.storage
      .from('template-docx')
      .download(normalizedPath);

    if (error) {
      console.error(`[getDocxTextContent] Error de Supabase Storage:`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
        status: (error as any).status,
        statusCode: (error as any).statusCode,
        details: (error as any).details
      });
      
      throw new Error(`Error descarregant fitxer "${normalizedPath}": ${error.message}`);
    }

    if (!data) {
      throw new Error(`No s'han rebut dades del fitxer "${normalizedPath}"`);
    }

    // STEP 4: Validar buffer
    const buffer = Buffer.from(await data.arrayBuffer());
    console.log(`[getDocxTextContent] Buffer descarregat: ${buffer.length} bytes`);
    
    const bufferValidation = validateDocxBuffer(buffer);
    if (!bufferValidation.isValid) {
      throw new Error(`Buffer invàlid: ${bufferValidation.error}`);
    }
    
    console.log(`[getDocxTextContent] ✅ Buffer validat correctament`);

    // STEP 5: Extreure text amb mammoth
    try {
      const { value: text } = await mammoth.extractRawText({ buffer });
      console.log(`[getDocxTextContent] ✅ Text extret: ${text.length} caràcters`);
      
      if (!text || text.trim().length === 0) {
        throw new Error('El document no conté text o està buit');
      }
      
      return text;
      
    } catch (mammothError: any) {
      console.error(`[getDocxTextContent] Error amb mammoth:`, mammothError);
      throw new Error(`Error processant document DOCX amb mammoth: ${mammothError.message}`);
    }

  } catch (error: any) {
    console.error(`[getDocxTextContent] ❌ Error crític:`, error);
    throw new Error(`Error llegint document DOCX: ${error.message}`);
  }
}

/**
 * Llegeix un document DOCX des de Supabase Storage i retorna el buffer
 * @param storagePath Path del document a Supabase Storage
 * @returns Buffer del document
 */
export async function readDocxFromStorage(storagePath: string): Promise<Buffer> {
  console.log(`[readDocxFromStorage] Iniciant lectura de buffer des de: "${storagePath}"`);
  
  try {
    // STEP 1: Validar path
    const pathValidation = validateStoragePath(storagePath);
    if (!pathValidation.isValid) {
      throw new Error(`Path invàlid: ${pathValidation.error}`);
    }
    
    const normalizedPath = pathValidation.normalizedPath!;
    console.log(`[readDocxFromStorage] Path normalitzat: "${normalizedPath}"`);
    
    // STEP 2: Diagnòstic d'existència
    await diagnosticFileExistence(normalizedPath);
    
    // STEP 3: Descarregar fitxer
    console.log(`[readDocxFromStorage] Descarregant buffer...`);
    const { data, error } = await supabaseAdmin.storage
      .from('template-docx')
      .download(normalizedPath);

    if (error) {
      console.error(`[readDocxFromStorage] Error de Supabase Storage:`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
        status: (error as any).status,
        statusCode: (error as any).statusCode,
        details: (error as any).details
      });
      
      throw new Error(`Error descarregant fitxer "${normalizedPath}": ${error.message}`);
    }

    if (!data) {
      throw new Error(`No s'han rebut dades del fitxer "${normalizedPath}"`);
    }

    // STEP 4: Validar buffer
    const buffer = Buffer.from(await data.arrayBuffer());
    console.log(`[readDocxFromStorage] Buffer descarregat: ${buffer.length} bytes`);
    
    const bufferValidation = validateDocxBuffer(buffer);
    if (!bufferValidation.isValid) {
      throw new Error(`Buffer invàlid: ${bufferValidation.error}`);
    }
    
    console.log(`[readDocxFromStorage] ✅ Buffer validat i retornat correctament`);
    return buffer;

  } catch (error: any) {
    console.error(`[readDocxFromStorage] ❌ Error crític obtenint buffer:`, error);
    throw new Error(`Error llegint buffer del document DOCX: ${error.message}`);
  }
}
