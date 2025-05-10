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
  // Log de l'URL per ajudar en la depuració
  console.log('[API UPDATE-TEMPLATE] pathname completa:', request.nextUrl.pathname);
  
  const pathParts = request.nextUrl.pathname.split('/');
  console.log('[API UPDATE-TEMPLATE] parts de la URL:', pathParts);
  
  // Extracció d'ID més robusta que simplement agafa l'últim segment de l'URL
  const id = pathParts[pathParts.length - 1];
  console.log('[API UPDATE-TEMPLATE] ID extret:', id);
  
  if (!id || id === '[id]') {
    return NextResponse.json({ error: 'Falta l\'id de la plantilla o format incorrecte.', path: request.nextUrl.pathname }, { status: 400 });
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
    
    try {
      // Obtenir informació de l'usuari per al debug (separar del pipeline principal)
      const userResponse = await supabase.auth.getUser();
      const userId = userResponse.data?.user?.id;
      
      // Preparar informació detallada de l'error per a la resposta
      const errorDetails = {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        userId: userId || 'not-authenticated',
        request_id: request.headers.get('x-request-id') || 'unknown'
      };
      
      // Segons el codi d'error, retornar un missatge més específic
      let userMessage = 'Error actualitzant la plantilla';
      if (error.code === '42P01') userMessage = 'Taula no trobada';
      else if (error.code === '42703') userMessage = 'Columna no existent';
      else if (error.code?.startsWith('23')) userMessage = 'Error de restricció: ' + error.code;
      else if (error.code?.startsWith('28')) userMessage = 'Error de permisos (RLS)';
      else if (error.code === 'PGRST301') userMessage = 'Registre no trobat';
      
      console.log('[API UPDATE-TEMPLATE] Detalls d\'error complets:', errorDetails);
      
      return NextResponse.json({ 
        error: userMessage, 
        details: error.message, 
        debug: errorDetails 
      }, { status: 400 });
    } catch (debugError) {
      // Si hi ha hagut error en obtenir la informació de depuració, 
      // igualment retornar l'error original
      console.error('[API UPDATE-TEMPLATE] Error en recollir info de debug:', debugError);
      return NextResponse.json({ 
        error: 'Error actualitzant la plantilla', 
        details: error.message
      }, { status: 400 });
    }
  }

  return NextResponse.json({ template: data }, { status: 200 });
}
