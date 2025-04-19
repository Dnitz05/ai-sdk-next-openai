import { NextRequest, NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autenticat. Falten credencials.' }, { status: 401 });
  }
  const accessToken = authHeader.replace('Bearer ', '').trim();
  const supabase = createUserSupabaseClient(accessToken);

  // Extreu l'id de la URL
  const pathParts = request.nextUrl.pathname.split('/');
  const id = pathParts[pathParts.length - 2] === '[id]' ? pathParts[pathParts.length - 1] : pathParts[pathParts.length - 1];
  if (!id) {
    return NextResponse.json({ error: 'Falta l\'id de la plantilla.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('plantilla_configs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Error carregant la plantilla', details: error.message }, { status: 404 });
  }

  return NextResponse.json({ template: data }, { status: 200 });
}
