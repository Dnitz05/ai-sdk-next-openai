import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';
import { createServerSupabaseClient } from '@/lib/supabase/serverClient';

export async function POST(request: NextRequest) {
  console.log("[API upload-excel] Rebuda petició POST");
  
  try {
    // 1. Autenticació de l'usuari: primer via header Authorization (Bearer), després cookies
    let userId: string | null = null;
    let userError: any = null;
    const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
    console.log('[API upload-excel] HEADER Authorization:', authHeader ? 'present' : 'missing');
    
    if (authHeader?.startsWith('Bearer ')) {
      const accessToken = authHeader.slice(7).trim();
      console.log('[API upload-excel] accessToken present:', accessToken ? 'yes' : 'no');
      try {
        const userClient = createUserSupabaseClient(accessToken);
        const { data: userDataAuth, error: authError } = await userClient.auth.getUser();
        if (!authError && userDataAuth.user) {
          userId = userDataAuth.user.id;
          console.log("[API upload-excel] Usuari autenticat via Bearer token:", userId);
        } else {
          userError = authError;
          console.log("[API upload-excel] Bearer token invalid, trying fallback...");
        }
      } catch (e) {
        userError = e;
        console.log("[API upload-excel] Bearer token error, trying fallback...");
      }
    }
    
    if (!userId) {
      console.log("[API upload-excel] Trying authentication via cookies...");
      try {
        const supabaseServer = await createServerSupabaseClient();
        const { data: userDataAuth2, error: serverError } = await supabaseServer.auth.getUser();
        if (!serverError && userDataAuth2.user) {
          userId = userDataAuth2.user.id;
          console.log("[API upload-excel] Usuari autenticat via cookies:", userId);
        } else {
          userError = serverError;
        }
      } catch (e) {
        userError = e;
      }
    }
    
    if (!userId) {
      console.error("[API upload-excel] Error obtenint informació de l'usuari:", userError);
      return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 });
    }
    
    console.log("[API upload-excel] Usuari autenticat:", userId);
    
    // 2. Processar FormData
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
    
    // 3. Validar que sigui un fitxer Excel
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
    
    // 4. Convertir a buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 5. Definir ruta d'emmagatzematge
    const storagePath = `user-${userId}/template-${templateId}/excel/data.xlsx`;
    
    // 6. Client amb service role per pujar a Storage
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    
    // 7. Pujar fitxer Excel a Supabase Storage
    console.log(`[API upload-excel] Pujant Excel a: ${storagePath}`);
    
    const { data: uploadData, error: uploadError } = await serviceClient.storage
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
    
    // 8. Actualitzar la BD amb la ruta de l'Excel
    const { error: dbError } = await serviceClient
      .from('plantilla_configs')
      .update({ 
        excel_storage_path: uploadData.path,
        excel_file_name: file.name,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId)
      .eq('user_id', userId);
    
    if (dbError) {
      console.error('[API upload-excel] Error actualitzant BD:', dbError);
      // Intentar eliminar el fitxer pujat ja que la BD no s'ha actualitzat
      await serviceClient.storage
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
