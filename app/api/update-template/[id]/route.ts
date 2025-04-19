import { NextRequest, NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autenticat. Falten credencials.' }, { status: 401 });
  }
  const accessToken = authHeader.replace('Bearer ', '').trim();
  const supabase = createUserSupabaseClient(accessToken);

  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: 'Falta l\'id de la plantilla.' }, { status: 400 });
  }

  const body = await request.json();
  // Només permet actualitzar camps específics
  const fields = [
    'config_name',
    'base_docx_name',
    'excel_file_name',
    'final_html'
    // Afegeix més camps si cal
  ];
  const updateData: Record<string, any> = {};
  for (const key of fields) {
    if (key in body) updateData[key] = body[key];
  }

  const { data, error } = await supabase
    .from('plantilla_configs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Error actualitzant la plantilla', details: error.message }, { status: 400 });
  }

  return NextResponse.json({ template: data }, { status: 200 });
}