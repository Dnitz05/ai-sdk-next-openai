import { NextRequest, NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient'; // Per verificar l'usuari
import { createClient } from '@supabase/supabase-js'; // Per al client de servei

// Interfície per a les dades esperades al body (pot ser més específica)
interface UpdateTemplatePayload {
  config_name?: string;
  base_docx_name?: string | null; // Nom original del fitxer DOCX
  excel_file_name?: string | null;
  final_html?: string;
  excel_headers?: string[];
  link_mappings?: any[]; // Especificar tipus més concret si és possible
  ai_instructions?: IAInstruction[];
  originalDocxPath?: string | null; // Ruta del DOCX original a Supabase Storage
}

// Interfície per a les instruccions d'IA (ja existent)
interface IAInstruction {
  id?: string;
  paragraphId?: string;
  content?: string;
  prompt?: string;
  status?: string;
  order?: number;
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  // 1. Verificar autenticació
  // (La lògica d'autenticació existent sembla utilitzar un token Bearer personalitzat.
  // Es manté aquesta lògica. Si s'utilitza l'autenticació de Supabase directament,
  // es podria simplificar amb createServerSupabaseClient com a save-configuration)

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autenticat. Falten credencials.' }, { status: 401 });
  }
  const accessToken = authHeader.replace('Bearer ', '').trim();
  
  const userSupabaseClient = createUserSupabaseClient(accessToken); // Client per verificar l'usuari
  const { data: userData, error: userError } = await userSupabaseClient.auth.getUser();

  if (userError || !userData?.user) {
    console.error("[API UPDATE-TEMPLATE] Error verificant usuari:", userError);
    return NextResponse.json({ error: 'Usuari no autenticat o token invàlid.', details: userError?.message }, { status: 401 });
  }
  const userId = userData.user.id;
  console.log("[API UPDATE-TEMPLATE] Usuari autenticat:", userId);
  
  // 2. Crear client amb service role key
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // Extreu l'id de la URL (paràmetre dinàmic)
  const id = params.id;
  console.log('[API UPDATE-TEMPLATE] ID de la plantilla a actualitzar:', id);
  
  if (!id) {
    return NextResponse.json({ error: 'Falta l\'id de la plantilla.' }, { status: 400 });
  }

  const body = (await request.json()) as UpdateTemplatePayload;
  console.log('[API UPDATE-TEMPLATE] Body rebut:', JSON.stringify(body, null, 2).substring(0,500) + "...");

  // Camps permesos per actualitzar directament
  const allowedFields: Array<keyof UpdateTemplatePayload> = [
    'config_name',
    'base_docx_name', // Nom original del fitxer
    'excel_file_name',
    'final_html',
    'excel_headers',
    'link_mappings',
    // 'ai_instructions' i 'originalDocxPath' es gestionen per separat
  ];

  const updateData: Record<string, any> = {};
  for (const key of allowedFields) {
    if (key in body && body[key] !== undefined) { // Només incloure si està present al body
      updateData[key] = body[key];
    }
  }
  
  // Gestió especial per a 'ai_instructions'
  if (body.ai_instructions && Array.isArray(body.ai_instructions)) {
    updateData.ai_instructions = body.ai_instructions.map((instr: IAInstruction) => ({
      id: instr.id || `ia-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      paragraphId: instr.paragraphId || '',
      prompt: instr.content || instr.prompt || '',
      content: instr.content || instr.prompt || '',
      status: instr.status || 'saved',
      order: instr.order || 0
    }));
  }

  // Gestió especial per a 'originalDocxPath' per actualitzar 'base_docx_storage_path'
  // Permet enviar null per desvincular el DOCX.
  if (body.originalDocxPath !== undefined) {
    updateData.base_docx_storage_path = body.originalDocxPath;
  }
  // Si originalDocxPath no ve al body, base_docx_storage_path no es modifica.

  // Assegurar que user_id no es pot canviar des del body i s'estableix correctament
  // updateData.user_id = userId; // No cal, ja que el filtre .eq('user_id', userId) ho protegeix

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ message: 'No hi ha camps per actualitzar.', template: null }, { status: 200 });
  }
  
  console.log('[API UPDATE-TEMPLATE] Dades a actualitzar (updateData):', JSON.stringify(updateData, null, 2));

  // 3. Actualitzar plantilla
  const { data: updatedTemplate, error: dbError } = await serviceClient
    .from('plantilla_configs')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', userId) // Important: assegurar que l'usuari només actualitza les seves plantilles
    .select()
    .single();

  if (dbError) {
    console.error('[API UPDATE-TEMPLATE] Error actualitzant la plantilla a la BD:', dbError);
    // ... (gestió d'errors existent)
    let userMessage = 'Error actualitzant la plantilla.';
    if (dbError.code === 'PGRST116') userMessage = 'No s\'ha trobat la plantilla per actualitzar o no pertany a l\'usuari.';
    // ... (altres codis d'error)
    return NextResponse.json({ error: userMessage, details: dbError.message, code: dbError.code }, { status: 400 });
  }

  if (!updatedTemplate) {
    console.warn('[API UPDATE-TEMPLATE] No s\'ha trobat la plantilla per actualitzar (ID: ${id}, UserID: ${userId}) o no hi ha hagut canvis.');
    return NextResponse.json({ error: 'No s\'ha trobat la plantilla per actualitzar o no pertany a l\'usuari.', template: null }, { status: 404 });
  }

  console.log('[API UPDATE-TEMPLATE] Plantilla actualitzada correctament:', updatedTemplate);
  return NextResponse.json({ template: updatedTemplate }, { status: 200 });
}
