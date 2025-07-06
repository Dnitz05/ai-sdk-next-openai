// Test endpoint per verificar que la correcció de DELETE funciona
import { NextResponse } from 'next/server';
import supabaseServerClient from '@/lib/supabase/server';

export async function GET() {
  try {
    console.log('🧪 Testejant correcció de DELETE...');
    
    // 1. Verificar que podem llegir plantilles
    const { data: templates, error: selectError } = await supabaseServerClient
      .from('plantilla_configs')
      .select('id, config_name, user_id')
      .limit(5);
    
    if (selectError) {
      return NextResponse.json({
        success: false,
        error: 'Error llegint plantilles',
        details: selectError.message
      });
    }
    
    console.log(`📋 Trobades ${templates?.length || 0} plantilles`);
    
    // 2. Testejar DELETE amb una condició impossible (no elimina res)
    const { error: deleteError } = await supabaseServerClient
      .from('plantilla_configs')
      .delete()
      .eq('id', 'test-impossible-id-12345');
    
    if (deleteError) {
      return NextResponse.json({
        success: false,
        error: 'Error testejant DELETE',
        details: deleteError.message,
        templates: templates?.length || 0
      });
    }
    
    console.log('✅ Test DELETE completat sense errors');
    
    return NextResponse.json({
      success: true,
      message: 'Correcció de DELETE funciona correctament',
      templates: templates?.length || 0,
      templatesList: templates?.map(t => ({ id: t.id, name: t.config_name })) || []
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
