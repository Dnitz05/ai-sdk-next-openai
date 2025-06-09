import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

/**
 * Interfície per a les dades d'Excel processades
 */
export interface ExcelData {
  headers: string[];
  rows: any[];
  totalRows: number;
}

/**
 * Llegeix un fitxer Excel des de Supabase Storage i retorna les dades processades
 * @param excelStoragePath - Ruta del fitxer Excel a Supabase Storage
 * @returns Dades de l'Excel processades (headers, rows, totalRows)
 */
export async function readExcelFromStorage(excelStoragePath: string): Promise<ExcelData> {
  console.log(`[readExcelFromStorage] Llegint Excel de Storage: ${excelStoragePath}`);
  
  // Client amb service role per accedir a Storage
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  try {
    // Descarregar el fitxer Excel des de Storage
    const { data: fileData, error: downloadError } = await serviceClient.storage
      .from('template-docx')
      .download(excelStoragePath);

    if (downloadError) {
      console.error(`[readExcelFromStorage] Error descarregant Excel: ${downloadError.message}`);
      throw new Error(`Error accedint al fitxer Excel: ${downloadError.message}`);
    }

    if (!fileData) {
      throw new Error('No s\'ha pogut obtenir el contingut del fitxer Excel');
    }

    // Convertir Blob a ArrayBuffer
    const arrayBuffer = await fileData.arrayBuffer();
    console.log(`[readExcelFromStorage] Fitxer descarregat: ${arrayBuffer.byteLength} bytes`);

    // Processar Excel amb XLSX
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    
    // Obtenir el primer full de càlcul
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('El fitxer Excel no conté cap full de càlcul');
    }

    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convertir a JSON amb la primera fila com a headers
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length === 0) {
      throw new Error('El fitxer Excel està buit');
    }

    // Separar headers (primera fila) i dades (resta de files)
    const headers = jsonData[0] as string[];
    const rawRows = jsonData.slice(1);

    if (!headers || headers.length === 0) {
      throw new Error('No s\'han trobat capçaleres a l\'Excel');
    }

    // Filtrar files buides i convertir-les a objectes amb claus dels headers
    const processedRows = rawRows
      .filter(row => Array.isArray(row) && row.some(cell => 
        cell !== null && cell !== undefined && cell !== ''
      ))
      .map((row: any) => {
        const rowObj: any = {};
        headers.forEach((header, index) => {
          rowObj[header] = row[index] || '';
        });
        return rowObj;
      });

    console.log(`[readExcelFromStorage] ✅ Excel processat: ${headers.length} columnes, ${processedRows.length} files`);

    return {
      headers,
      rows: processedRows,
      totalRows: processedRows.length
    };

  } catch (error) {
    console.error('[readExcelFromStorage] Error general:', error);
    throw new Error(
      `Error processant Excel: ${error instanceof Error ? error.message : 'Error desconegut'}`
    );
  }
}

/**
 * Verifica si una plantilla té un Excel associat i retorna la seva informació bàsica
 * @param templateId - ID de la plantilla
 * @param userId - ID de l'usuari (per seguretat)
 * @returns Informació bàsica de l'Excel (només headers per eficiència)
 */
export async function getExcelInfoFromTemplate(templateId: string, userId: string): Promise<{
  hasExcel: boolean;
  fileName?: string;
  headers?: string[];
  totalRows?: number;
}> {
  console.log(`[getExcelInfoFromTemplate] Obtenint info Excel per plantilla: ${templateId}`);
  
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  try {
    // Obtenir informació de la plantilla
    const { data: template, error: templateError } = await serviceClient
      .from('plantilla_configs')
      .select('excel_storage_path, excel_file_name')
      .eq('id', templateId)
      .eq('user_id', userId)
      .single();

    if (templateError) {
      console.error(`[getExcelInfoFromTemplate] Error obtenint plantilla: ${templateError.message}`);
      throw new Error(`Error accedint a la plantilla: ${templateError.message}`);
    }

    if (!template.excel_storage_path) {
      console.log(`[getExcelInfoFromTemplate] Plantilla ${templateId} no té Excel associat`);
      return { hasExcel: false };
    }

    // Llegir només els headers per eficiència (primera fila)
    const excelData = await readExcelFromStorage(template.excel_storage_path);

    return {
      hasExcel: true,
      fileName: template.excel_file_name,
      headers: excelData.headers,
      totalRows: excelData.totalRows
    };

  } catch (error) {
    console.error('[getExcelInfoFromTemplate] Error:', error);
    throw error;
  }
}
