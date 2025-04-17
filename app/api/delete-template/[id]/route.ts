// app/api/delete-template/[id]/route.ts
import { NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';

export async function DELETE(request: Request) {
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

    // 3. Elimina la plantilla (la RLS filtrarà per user_id)
    const { error } = await supabase
      .from('plantilla_configs')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Error eliminant plantilla:", error);
      return NextResponse.json({
        error: 'Error eliminant plantilla',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error general a /api/delete-template/[id]:", error);
    return NextResponse.json({
      error: 'Error intern del servidor',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
