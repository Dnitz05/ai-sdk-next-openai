// app/api/get-templates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  try {
    // Crear client SSR per autenticació
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

    // Obtenir userId de la sessió
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[API get-templates] Error obtenint informació de l'usuari:", authError);
      return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 });
    }
    
    const userId = user.id;
    console.log("[API get-templates] Usuari autenticat:", userId);

    // Obtenir paràmetres de consulta (opcional)
    const searchParams = request.nextUrl.searchParams;
    const searchTerm = searchParams.get('search') || '';

    // Consulta a Supabase (RLS filtra automàticament per user_id)
    let query = supabase
      .from('plantilla_configs')
      .select('*')
      .order('created_at', { ascending: false });

    if (searchTerm) {
      query = query.ilike('config_name', `%${searchTerm}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[API get-templates] Error recuperant plantilles:", error);
      return NextResponse.json({
        error: 'Error recuperant plantilles',
        details: error.message
      }, { status: 500 });
    }

    console.log(`[API get-templates] ✅ Retornant ${data?.length || 0} plantilles per usuari:`, userId);
    return NextResponse.json({ 
      templates: data, 
      user_id: userId 
    }, { status: 200 });

  } catch (error) {
    console.error("[API get-templates] Error general:", error);
    return NextResponse.json({
      error: 'Error intern del servidor',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
