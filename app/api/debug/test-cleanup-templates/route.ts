import { NextRequest, NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [DEBUG] Testejant API de neteja de plantilles...');
    
    // 1. Llegeix el token de l'Authorization header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'No autenticat. Falten credencials.',
        debug: 'Missing or invalid Authorization header'
      }, { status: 401 });
    }
    const accessToken = authHeader.replace('Bearer ', '').trim();

    // 2. Crea el client Supabase autenticat amb el token de l'usuari
    let supabase;
    try {
      supabase = createUserSupabaseClient(accessToken);
      console.log('✅ [DEBUG] Client Supabase creat correctament');
    } catch (err) {
      console.error('❌ [DEBUG] Error creant client Supabase:', err);
      return NextResponse.json({ 
        error: 'Error creant client Supabase',
        debug: err instanceof Error ? err.message : 'Error desconegut'
      }, { status: 500 });
    }
    
    // 3. Testejar autenticació
    let user;
    try {
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('❌ [DEBUG] Error d\'autenticació:', userError);
        return NextResponse.json({ 
          error: 'Error d\'autenticació',
          debug: userError.message
        }, { status: 401 });
      }
      user = authUser;
      console.log(`✅ [DEBUG] Usuari autenticat: ${user?.id}`);
    } catch (err) {
      console.error('❌ [DEBUG] Excepció en autenticació:', err);
      return NextResponse.json({ 
        error: 'Excepció en autenticació',
        debug: err instanceof Error ? err.message : 'Error desconegut'
      }, { status: 500 });
    }
    
    // 4. Testejar accés a plantilles
    let templates;
    try {
      const { data: templatesData, error: fetchError } = await supabase
        .from('plantilla_configs')
        .select('id, config_name')
        .limit(5);
      
      if (fetchError) {
        console.error('❌ [DEBUG] Error obtenint plantilles:', fetchError);
        return NextResponse.json({ 
          error: 'Error obtenint plantilles',
          debug: fetchError.message
        }, { status: 500 });
      }
      
      templates = templatesData;
      console.log(`✅ [DEBUG] Plantilles obtingudes: ${templates?.length || 0}`);
    } catch (err) {
      console.error('❌ [DEBUG] Excepció obtenint plantilles:', err);
      return NextResponse.json({ 
        error: 'Excepció obtenint plantilles',
        debug: err instanceof Error ? err.message : 'Error desconegut'
      }, { status: 500 });
    }
    
    // 5. Testejar accés al Storage
    let storageTest;
    try {
      const userPrefix = `user-${user?.id}/`;
      const { data: storageData, error: storageError } = await supabase.storage
        .from('template-docx')
        .list(userPrefix, { limit: 5 });
      
      if (storageError) {
        console.error('❌ [DEBUG] Error accedint al Storage:', storageError);
        storageTest = { error: storageError.message };
      } else {
        storageTest = { success: true, files: storageData?.length || 0 };
        console.log(`✅ [DEBUG] Storage accessible: ${storageData?.length || 0} elements`);
      }
    } catch (err) {
      console.error('❌ [DEBUG] Excepció accedint al Storage:', err);
      storageTest = { error: err instanceof Error ? err.message : 'Error desconegut' };
    }
    
    return NextResponse.json({ 
      success: true,
      debug: {
        user: {
          id: user?.id,
          email: user?.email
        },
        templates: {
          count: templates?.length || 0,
          sample: templates?.slice(0, 3)
        },
        storage: storageTest,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ [DEBUG] Error general:', error);
    return NextResponse.json({ 
      error: 'Error general en el debug',
      debug: error instanceof Error ? error.message : 'Error desconegut',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Endpoint de debug per testejar la neteja de plantilles.',
    usage: 'POST /api/debug/test-cleanup-templates amb Authorization header'
  });
}
