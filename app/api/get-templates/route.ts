// app/api/get-templates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import supabaseServerClient from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // Obtenir paràmetres de consulta (opcional)
    const searchParams = request.nextUrl.searchParams;
    const searchTerm = searchParams.get('search') || '';
    
    // Consulta a Supabase
    let query = supabaseServerClient
      .from('plantilla_configs')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Afegir filtre de cerca si existeix
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
