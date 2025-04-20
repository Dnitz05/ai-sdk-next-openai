import { NextRequest, NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';

export async function PUT(request: NextRequest) {
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

  const body = await request.json();
  // Només permet actualitzar camps específics
  const fields = [
    'config_name',
    'base_docx_name',
    'excel_file_name',
    'final_html',
    'excel_headers',
    'link_mappings',
    'ai_instructions'
  ];
  const updateData: Record<string, any> = {};
  for (const key of fields) {
    if (key in body) updateData[key] = body[key];
  }

  // LOG del body rebut i del payload d'update
  console.log('[API UPDATE-TEMPLATE] body rebut:', body);
  console.log('[API UPDATE-TEMPLATE] updateData:', updateData);

  const { data, error } = await supabase
    .from('plantilla_configs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[API UPDATE-TEMPLATE] error:', error);
    return NextResponse.json({ error: 'Error actualitzant la plantilla', details: error.message, supabase: error }, { status: 400 });
  }

  return NextResponse.json({ template: data }, { status: 200 });
}