// app/api/debug/check-rls-policies/route.ts
import { NextResponse } from 'next/server';
import supabaseServerClient from '@/lib/supabase/server';

export async function GET() {
  try {
    console.log('[DEBUG RLS] Verificant polítiques RLS...');

    // Verificar polítiques existents per plantilla_configs
    const { data: policies, error: policiesError } = await supabaseServerClient
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'plantilla_configs');

    if (policiesError) {
      console.error('[DEBUG RLS] Error obtenint polítiques:', policiesError);
      return NextResponse.json({
        success: false,
        error: 'Error obtenint polítiques RLS',
        details: policiesError.message
      }, { status: 500 });
    }

    console.log('[DEBUG RLS] Polítiques trobades:', policies);

    // Verificar si RLS està habilitat
    const { data: tableInfo, error: tableError } = await supabaseServerClient
      .rpc('check_rls_enabled', { table_name: 'plantilla_configs' });

    if (tableError) {
      console.warn('[DEBUG RLS] No s\'ha pogut verificar RLS:', tableError);
    }

    // Comptar plantilles totals (amb server client)
    const { count: totalCount, error: countError } = await supabaseServerClient
      .from('plantilla_configs')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('[DEBUG RLS] Error comptant plantilles:', countError);
    }

    return NextResponse.json({
      success: true,
      policies: policies || [],
      totalTemplates: totalCount || 0,
      rlsEnabled: tableInfo || 'unknown',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[DEBUG RLS] Error general:', error);
    return NextResponse.json({
      success: false,
      error: 'Error intern del servidor',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
