import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  try {
    console.log('🔐 Testejant autenticació amb client SSR...');

    // Crear client SSR per llegir cookies de la sessió
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

    // Intentar obtenir l'usuari
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('🔍 Resultat autenticació:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      error: authError?.message,
      cookiesCount: request.cookies.getAll().length
    });

    if (authError) {
      return NextResponse.json({
        success: false,
        error: 'Error d\'autenticació',
        details: authError.message,
        cookies: request.cookies.getAll().map(c => ({ name: c.name, hasValue: !!c.value })),
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Usuari no autenticat',
        cookies: request.cookies.getAll().map(c => ({ name: c.name, hasValue: !!c.value })),
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }

    // Test d'accés a la base de dades amb l'usuari autenticat
    const { data: projects, error: dbError } = await supabase
      .from('projects')
      .select('id, project_name')
      .eq('user_id', user.id)
      .limit(3);

    return NextResponse.json({
      success: true,
      message: 'Autenticació funcionant correctament',
      user: {
        id: user.id,
        email: user.email,
        authenticated: true
      },
      database: {
        projectsFound: projects?.length || 0,
        dbError: dbError?.message || null
      },
      cookies: request.cookies.getAll().map(c => ({ name: c.name, hasValue: !!c.value })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en test d\'autenticació:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Error intern',
      details: error instanceof Error ? error.message : 'Error desconegut',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
