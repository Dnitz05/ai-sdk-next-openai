import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';
import { createServerSupabaseClient } from '@/lib/supabase/serverClient';

export async function POST(request: NextRequest) {
  console.log("API /api/upload-original-docx rebuda petició POST");

  // Obtenir l'usuari autenticat via token Bearer o cookies
  let userId: string | null = null;
  let userError: any = null;

  // 1. Prova d'obtenir el token d'accés de l'header Authorization
  const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
  console.log('[API upload-original-docx] HEADER Authorization:', authHeader);

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const accessToken = authHeader.slice(7).trim();
    if (!accessToken) {
      console.error('[API upload-original-docx] Token buit al header Authorization');
      return NextResponse.json({ error: 'Token buit o no proporcionat.' }, { status: 401 });
    }
    try {
      const { createUserSupabaseClient } = await import('@/lib/supabase/userClient');
      const supabase = createUserSupabaseClient(accessToken);
      const { data: userData, error } = await supabase.auth.getUser();
      if (error || !userData?.user) {
        console.error('[API upload-original-docx] Token rebut però invàlid', error);
        return NextResponse.json({ error: 'Token invàlid o caducat.' }, { status: 401 });
      } else {
        userId = userData.user.id;
      }
    } catch (e) {
      userError = e;
    }
  }

  // 2. Si no s'ha trobat via header, prova via cookies (App Router)
  if (!userId) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data: userData, error } = await supabase.auth.getUser();
      if (error || !userData?.user) {
        userError = error;
      } else {
        userId = userData.user.id;
      }
    } catch (e) {
      userError = e;
    }
  }

  if (!userId) {
    console.error("[API upload-original-docx] Error obtenint informació de l'usuari:", userError);
    return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const templateId = formData.get('templateId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No s\'ha pujat cap fitxer.' }, { status: 400 });
    }

    if (!templateId) {
      return NextResponse.json({ error: 'Falta el templateId.' }, { status: 400 });
    }

    // Validació bàsica del tipus de fitxer (opcional però recomanada)
    if (file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // Podries ser més flexible amb els tipus MIME per a .docx
        console.warn(`[API upload-original-docx] Tipus de fitxer rebut no esperat: ${file.type}`);
        // Decideix si vols rebutjar o continuar
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    // Ruta fixa per sobreescriure sempre el mateix fitxer
    const storagePath = `user-${userId}/template-${templateId}/original/original.docx`;

    console.log(`[API upload-original-docx] Intentant pujar a Storage (sobreescriptura): ${storagePath}`);

    const { data, error: uploadError } = await supabaseAdmin.storage
      .from('template-docx') // Nom del bucket
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: true, // Sobreescriu sempre el mateix fitxer
      });

    if (uploadError) {
      console.error('[API upload-original-docx] Error pujant a Supabase Storage:', uploadError);
      return NextResponse.json({ error: 'Error pujant el fitxer a Storage.', details: uploadError.message }, { status: 500 });
    }

    if (!data || !data.path) {
        console.error('[API upload-original-docx] La pujada a Supabase Storage no ha retornat una ruta (path).');
        return NextResponse.json({ error: 'Error confirmant la pujada del fitxer (no path).'}, { status: 500 });
    }
    
    console.log(`[API upload-original-docx] Fitxer pujat correctament a: ${data.path}`);

    return NextResponse.json({ success: true, originalDocxPath: data.path }); // Retornem el path confirmat per Supabase

  } catch (error) {
    console.error("[API upload-original-docx] Error CRÍTIC processant la petició:", error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconegut.';
    return NextResponse.json({ error: 'Error intern processant la petició.', details: errorMessage }, { status: 500 });
  }
}