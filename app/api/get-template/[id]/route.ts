// app/api/get-template/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import supabaseServerClient from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json({ error: 'ID de plantilla no proporcionat' }, { status: 400 });
    }
    
    const { data, error } = await supabaseServerClient
      .from('plantilla_configs')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error("Error recuperant plantilla:", error);
      return NextResponse.json({ 
        error: 'Error recuperant plantilla', 
        details: error.message 
      }, { status: 500 });
    }
    
    if (!data) {
      return NextResponse.json({ error: 'Plantilla no trobada' }, { status: 404 });
    }
    
    return NextResponse.json({ template: data }, { status: 200 });
  } catch (error) {
    console.error("Error general a /api/get-template/[id]:", error);
    return NextResponse.json({ 
      error: 'Error intern del servidor', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
