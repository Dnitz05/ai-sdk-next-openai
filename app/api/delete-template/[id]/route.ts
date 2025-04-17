// app/api/delete-template/[id]/route.ts
import { NextResponse } from 'next/server';
import supabaseServerClient from '@/lib/supabase/server';

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

  try {
    if (!id) {
      return NextResponse.json({ error: 'ID de plantilla no proporcionat' }, { status: 400 });
    }
    
    const { error } = await supabaseServerClient
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
