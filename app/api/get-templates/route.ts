// app/api/get-templates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';

export async function GET(request: NextRequest) {
  // 1. Llegeix el token de l'Authorization header
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autenticat. Falten credencials.' }, { status: 401 });
  }
  const accessToken = authHeader.replace('Bearer ', '').trim();

  try {
    // Obtenir paràmetres de consulta (opcional)
    const searchParams = request.nextUrl.searchParams;
    const searchTerm = searchParams.get('search') || '';

    // 2. Crea el client Supabase autenticat amb el token de l'usuari
    const supabase = createUserSupabaseClient(accessToken);

    // 3. Consulta a Supabase (la RLS filtrarà per user_id)
    let query = supabase
      .from('plantilla_configs')
      .select('*')
      .order('created_at', { ascending: false });

    if (searchTerm) {
      query = query.ilike('config_name', `%${searchTerm}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error recuperant plantilles:", error);
      return NextResponse.json({
        error: 'Error recuperant plantilles',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({ templates: data }, { status: 200 });
  } catch (error) {
    console.error("Error general a /api/get-templates:", error);
    return NextResponse.json({
      error: 'Error intern del servidor',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
