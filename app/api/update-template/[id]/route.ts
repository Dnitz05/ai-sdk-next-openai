import { NextRequest, NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';
import { createClient } from '@supabase/supabase-js';

export async function PUT(request: NextRequest) {
  // 1. Verificar autenticació amb el token JWT
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autenticat. Falten credencials.' }, { status: 401 });
  }
  const accessToken = authHeader.replace('Bearer ', '').trim();
  
  // Utilitzem primer el client d'usuari per verificar la identitat
  const userClient = createUserSupabaseClient(accessToken);
  
  // Obtenim informació de l'usuari per verificar que està autenticat
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    console.error("[API UPDATE-TEMPLATE] Error verificant usuari:", userError);
    return NextResponse.json({ error: 'Usuari no autenticat o token invàlid.', details: userError?.message }, { status: 401 });
  }
  
  // Guarda l'ID de l'usuari per a verificacions posteriors
  const userId = userData.user.id;
  console.log("[API UPDATE-TEMPLATE] Usuari autenticat:", userId);
  
  // 2. Crear client amb service role key per bypasejar RLS
  // (com fa save-configuration/route.ts)
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );

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
    'link_mappings'
  ];
  const updateData: Record<string, any> = {};
  for (const key of fields) {
    if (key in body) updateData[key] = body[key];
  }
  
  // Interfície per a les instruccions d'IA
  interface IAInstruction {
    id?: string;
    paragraphId?: string;
    content?: string;
    prompt?: string;
    status?: string;
    order?: number;
  }
  
  // Processament especial per a 'ai_instructions' per assegurar que es desa correctament
  if ('ai_instructions' in body && Array.isArray(body.ai_instructions)) {
    // Assegurar que el format sigui correcte i tots els camps necessaris hi siguin
    console.log('[API UPDATE-TEMPLATE] Processant ai_instructions. Rebut:', JSON.stringify(body.ai_instructions));
    updateData.ai_instructions = body.ai_instructions.map((instr: IAInstruction, index: number) => {
      console.log(`[API UPDATE-TEMPLATE] Instrucció IA [${index}] rebuda:`, JSON.stringify(instr));
      const processedInstr = {
        id: instr.id || `ia-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        paragraphId: instr.paragraphId || '',
        prompt: instr.content || instr.prompt || '',  // Suporta ambdós formats
        content: instr.content || instr.prompt || '',  // Duplicar per compatibilitat
        status: instr.status || 'saved',
        order: instr.order || 0
      };
      console.log(`[API UPDATE-TEMPLATE] Instrucció IA [${index}] processada:`, JSON.stringify(processedInstr));
      return processedInstr;
    });
  }

  // LOG del body rebut i del payload d'update
  console.log('[API UPDATE-TEMPLATE] body rebut:', JSON.stringify(body).substring(0, 200) + '...');
  console.log('[API UPDATE-TEMPLATE] ai_instructions processades:', 
    JSON.stringify(updateData.ai_instructions).substring(0, 200) + '...');
  console.log('[API UPDATE-TEMPLATE] updateData preparat');

  // 3. Actualitzar plantilla utilitzant el service client (bypass RLS)
  console.log('[API UPDATE-TEMPLATE] Intentant actualitzar plantilla amb ID:', id, 'per usuari:', userId);
  
  // Afegim el camp user_id a les dades per actualitzar per assegurar que només modifica plantilles del propi usuari
  updateData.user_id = userId;
  
  const { data, error } = await serviceClient
    .from('plantilla_configs')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', userId) // Assegurem que només s'actualitza si pertany a l'usuari
    .select()
    .single();

  if (error) {
    console.error('[API UPDATE-TEMPLATE] error:', error);
    
    try {
      // Informació d'usuari ja la tenim, no cal consultar-la de nou
      
      // Preparar informació detallada de l'error per a la resposta
      const errorDetails = {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        userId: userId,
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
