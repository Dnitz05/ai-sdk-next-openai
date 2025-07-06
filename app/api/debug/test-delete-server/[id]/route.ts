// app/api/debug/test-delete-server/[id]/route.ts
import { NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';
import supabaseServerClient from '@/lib/supabase/server';

export async function DELETE(request: Request) {
  // Extraiem l'id de la URL
  let id: string | undefined;
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    id = pathParts[pathParts.length - 1];
  } catch {
    id = undefined;
  }

  // Llegeix el token de l'Authorization header
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autenticat. Falten credencials.' }, { status: 401 });
  }
  const accessToken = authHeader.replace('Bearer ', '').trim();

  try {
    if (!id) {
      return NextResponse.json({ error: 'ID de plantilla no proporcionat' }, { status: 400 });
    }

    console.log(`[TEST DELETE SERVER] Testejant eliminació de plantilla ID: ${id}`);

    // 1. Crear client autenticat per verificar ownership
    const userSupabase = createUserSupabaseClient(accessToken);
    
    // 2. Obtenir la plantilla per verificar que existeix i és del usuari
    const { data: template, error: fetchError } = await userSupabase
      .from('plantilla_configs')
      .select('id, config_name, user_id')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error("[TEST DELETE SERVER] Error obtenint plantilla:", fetchError);
      return NextResponse.json({
        success: false,
        error: 'Error obtenint plantilla',
        details: fetchError.message,
        step: 'fetch_template'
      }, { status: 500 });
    }

    if (!template) {
      return NextResponse.json({
        success: false,
        error: 'Plantilla no trobada',
        step: 'template_not_found'
      }, { status: 404 });
    }

    console.log(`[TEST DELETE SERVER] Plantilla trobada: "${template.config_name}" (user_id: ${template.user_id})`);

    // 3. Intentar eliminar amb client del servidor (bypassing RLS)
    console.log(`[TEST DELETE SERVER] Eliminant amb server client...`);
    const { error: deleteError } = await supabaseServerClient
      .from('plantilla_configs')
      .delete()
      .eq('id', id)
      .eq('user_id', template.user_id); // Seguretat extra

    if (deleteError) {
      console.error("[TEST DELETE SERVER] Error eliminant amb server client:", deleteError);
      return NextResponse.json({
        success: false,
        error: 'Error eliminant amb server client',
        details: deleteError.message,
        step: 'delete_with_server_client'
      }, { status: 500 });
    }

    console.log(`[TEST DELETE SERVER] ✅ Plantilla eliminada correctament amb server client`);

    // 4. Verificar que s'ha eliminat
    const { data: verifyTemplate, error: verifyError } = await supabaseServerClient
      .from('plantilla_configs')
      .select('id')
      .eq('id', id)
      .single();

    const stillExists = !verifyError && verifyTemplate;

    return NextResponse.json({
      success: true,
      message: 'Test d\'eliminació completat',
      templateName: template.config_name,
      templateId: id,
      userId: template.user_id,
      stillExists: stillExists,
      verifyError: verifyError?.message || null,
      step: 'completed'
    });

  } catch (error) {
    console.error("[TEST DELETE SERVER] Error general:", error);
    return NextResponse.json({
      success: false,
      error: 'Error intern del servidor',
      details: error instanceof Error ? error.message : String(error),
      step: 'general_error'
    }, { status: 500 });
  }
}
