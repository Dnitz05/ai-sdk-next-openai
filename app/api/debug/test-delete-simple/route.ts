// Test simple per verificar que podem fer DELETE amb user client
import { NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';

export async function POST(request: Request) {
  try {
    console.log('🧪 Testejant DELETE amb user client...');
    
    // 1. Llegeix el token de l'Authorization header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'No autenticat. Falten credencials.' 
      }, { status: 401 });
    }
    const accessToken = authHeader.replace('Bearer ', '').trim();

    // 2. Crea el client Supabase autenticat amb el token de l'usuari
    const supabase = createUserSupabaseClient(accessToken);
    
    // 3. Obtenir l'usuari autenticat
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ 
        error: 'Error obtenint usuari autenticat',
        details: userError?.message 
      }, { status: 401 });
    }
    
    console.log(`👤 Usuari autenticat: ${user.id}`);
    
    // 4. Verificar que podem llegir plantilles
    const { data: templates, error: selectError } = await supabase
      .from('plantilla_configs')
      .select('id, config_name, user_id')
      .limit(3);
    
    if (selectError) {
      return NextResponse.json({
        success: false,
        error: 'Error llegint plantilles',
        details: selectError.message
      });
    }
    
    console.log(`📋 Trobades ${templates?.length || 0} plantilles`);
    
    // 5. Testejar DELETE amb una condició impossible (no elimina res)
    console.log('🧪 Testejant DELETE amb condició impossible...');
    const { error: deleteError } = await supabase
      .from('plantilla_configs')
      .delete()
      .eq('id', 'test-impossible-id-12345');
    
    if (deleteError) {
      return NextResponse.json({
        success: false,
        error: 'Error testejant DELETE - això indica que RLS bloqueja DELETE',
        details: deleteError.message,
        templates: templates?.length || 0,
        diagnosis: 'RLS està bloquejant operacions DELETE. Necessitem política DELETE.'
      });
    }
    
    console.log('✅ Test DELETE completat sense errors');
    
    return NextResponse.json({
      success: true,
      message: 'DELETE funciona correctament amb user client',
      templates: templates?.length || 0,
      templatesList: templates?.map(t => ({ id: t.id, name: t.config_name })) || [],
      user: user.id
    });
    
  } catch (error) {
    console.error('Error en test DELETE:', error);
    return NextResponse.json({
      success: false,
      error: 'Error general en test',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Test DELETE simple. Usa POST amb Authorization header.',
    usage: 'POST /api/debug/test-delete-simple amb Authorization: Bearer <token>'
  });
}
