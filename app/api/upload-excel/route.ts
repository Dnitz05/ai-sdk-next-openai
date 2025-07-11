import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: NextRequest) {
  console.log("[API upload-excel] Iniciant pujada d'Excel amb SSR...");
  
  try {
    // 1. Crear client SSR per autenticació automàtica amb RLS
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => {
            return request.cookies.getAll().map(cookie => ({
              name: cookie.name,
              value: cookie.value,
            }))
          },
          setAll: () => {
            // No necessitem setAll en aquest context
          }
        }
      }
    );

    // 2. Verificar autenticació SSR
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[API upload-excel] Error d'autenticació SSR:", authError);
      return NextResponse.json({ 
        error: 'Usuari no autenticat',
        details: authError?.message 
      }, { status: 401 });
    }
    
    const userId = user.id;
    console.log("[API upload-excel] Usuari autenticat via SSR:", userId);
    
    // 3. Processar FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const templateId = formData.get('templateId') as string;
    
    if (!file) {
      return NextResponse.json({ 
        error: 'No s\'ha proporcionat cap fitxer Excel.' 
      }, { status: 400 });
    }
    
    if (!templateId) {
      return NextResponse.json({ 
        error: 'templateId és obligatori.' 
      }, { status: 400 });
    }
    
    // 4. Validar que sigui un fitxer Excel
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ];
    
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'El fitxer ha de ser un Excel (.xlsx o .xls).' 
      }, { status: 400 });
    }
    
    console.log(`[API upload-excel] Processant fitxer: ${file.name} (${file.size} bytes)`);
    
    // 5. Verificar que la plantilla pertany a l'usuari abans de continuar
    const { data: templateCheck, error: templateError } = await supabase
      .from('plantilla_configs')
      .select('id, user_id')
      .eq('id', templateId)
      .single();
    
    if (templateError || !templateCheck) {
      console.error("[API upload-excel] Plantilla no trobada o no pertany a l'usuari:", templateError);
      return NextResponse.json({ 
        error: 'Plantilla no trobada o no autoritzada' 
      }, { status: 404 });
    }
    
    // 6. Convertir a buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 7. Definir ruta d'emmagatzematge
    const storagePath = `user-${userId}/template-${templateId}/excel/data.xlsx`;
    
    // 8. Pujar fitxer Excel a Supabase Storage amb RLS
    console.log(`[API upload-excel] Pujant Excel a: ${storagePath}`);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('template-docx')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true
      });
    
    if (uploadError) {
      console.error('[API upload-excel] Error pujant a Storage:', uploadError);
      return NextResponse.json({ 
        error: `Error pujant Excel: ${uploadError.message}` 
      }, { status: 500 });
    }
    
    console.log(`[API upload-excel] Excel pujat correctament: ${uploadData.path}`);
    
    // 9. Actualitzar la BD amb la ruta de l'Excel (RLS automàtic)
    const { error: dbError } = await supabase
      .from('plantilla_configs')
      .update({ 
        excel_storage_path: uploadData.path,
        excel_file_name: file.name,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId); // RLS assegura que només s'actualitza si pertany a l'usuari
    
    if (dbError) {
      console.error('[API upload-excel] Error actualitzant BD:', dbError);
      // Intentar eliminar el fitxer pujat ja que la BD no s'ha actualitzat
      await supabase.storage
        .from('template-docx')
        .remove([uploadData.path]);
      
      return NextResponse.json({ 
        error: `Error actualitzant base de dades: ${dbError.message}` 
      }, { status: 500 });
    }
    
    console.log(`[API upload-excel] BD actualitzada amb excel_storage_path: ${uploadData.path}`);
    
    return NextResponse.json({
      success: true,
      excelStoragePath: uploadData.path,
      fileName: file.name,
      message: 'Excel pujat i processat correctament'
    });
    
  } catch (error) {
    console.error('[API upload-excel] Error general:', error);
    return NextResponse.json({
      error: 'Error intern del servidor',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
