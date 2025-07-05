// app/api/debug/test-delete-template/[id]/route.ts
import { NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';

export async function GET(request: Request) {
  // Extraiem l'id de la URL manualment segons la nova API de Next.js 15
  let id: string | undefined;
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    id = pathParts[pathParts.length - 1];
  } catch {
    id = undefined;
  }

  // 1. Llegeix el token de l'Authorization header
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autenticat. Falten credencials.' }, { status: 401 });
  }
  const accessToken = authHeader.replace('Bearer ', '').trim();

  try {
    if (!id) {
      return NextResponse.json({ error: 'ID de plantilla no proporcionat' }, { status: 400 });
    }

    // 2. Crea el client Supabase autenticat amb el token de l'usuari
    const supabase = createUserSupabaseClient(accessToken);

    // 3. Primer, verificar l'usuari autenticat
    const { data: userData, error: userError } = await supabase.auth.getUser();
    console.log(`[DEBUG DELETE] Usuari autenticat:`, userData?.user?.id, userError);

    // 4. Intentar obtenir la plantilla
    const { data: template, error: fetchError } = await supabase
      .from('plantilla_configs')
      .select(`
        id,
        config_name,
        user_id,
        base_docx_storage_path,
        placeholder_docx_storage_path,
        indexed_docx_storage_path,
        excel_storage_path
      `)
      .eq('id', id)
      .single();

    console.log(`[DEBUG DELETE] Plantilla trobada:`, template, fetchError);

    if (fetchError) {
      return NextResponse.json({
        error: 'Error obtenint plantilla',
        details: fetchError.message,
        code: fetchError.code,
        hint: fetchError.hint
      }, { status: 500 });
    }

    if (!template) {
      return NextResponse.json({ error: 'Plantilla no trobada' }, { status: 404 });
    }

    // 5. Verificar propietat
    const isOwner = template.user_id === userData?.user?.id;
    console.log(`[DEBUG DELETE] És propietari:`, isOwner, `(${template.user_id} === ${userData?.user?.id})`);

    // 6. Intentar eliminar (DRY RUN)
    const { data: deleteResult, error: deleteError } = await supabase
      .from('plantilla_configs')
      .delete()
      .eq('id', id)
      .select(); // Afegim select per veure què s'elimina

    console.log(`[DEBUG DELETE] Resultat eliminació:`, deleteResult, deleteError);

    return NextResponse.json({
      success: true,
      debug: {
        templateId: id,
        authenticatedUser: userData?.user?.id,
        template: template,
        isOwner: isOwner,
        deleteResult: deleteResult,
        deleteError: deleteError,
        wasDeleted: !deleteError && deleteResult && deleteResult.length > 0
      }
    });

  } catch (error) {
    console.error("Error general a /api/debug/test-delete-template:", error);
    return NextResponse.json({
      error: 'Error intern del servidor',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
