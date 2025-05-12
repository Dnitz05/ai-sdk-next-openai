import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getToken } from 'next-auth/jwt'; // Assumint que utilitzes NextAuth per a la sessió

// Helper per obtenir l'usuari de Supabase a partir del token de NextAuth
// Aquesta funció pot variar depenent de com gestionis la sessió i els usuaris
// Si no utilitzes NextAuth, hauràs d'adaptar la manera d'obtenir el userId
async function getSupabaseUserId(req: NextRequest): Promise<string | null> {
  // Intenta obtenir el token de NextAuth. El 'secret' ha de coincidir amb el de la configuració de NextAuth.
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (token && token.sub) {
    // 'token.sub' normalment conté l'ID de l'usuari
    return token.sub;
  }
  // Si no hi ha token o 'sub', intenta obtenir l'usuari directament de Supabase si hi ha una sessió activa
  // Això requeriria un client Supabase configurat per llegir la sessió del costat del servidor
  // Per simplicitat, si el token de NextAuth no funciona, retornem null aquí.
  // Hauries d'implementar una lògica robusta per obtenir el userId autenticat.
  // Per exemple, si utilitzes el helper de Supabase Auth:
  // import { createServerSupabaseClient } from '@/lib/supabase/serverClient'; // o similar
  // const supabase = await createServerSupabaseClient();
  // const { data: { user } } = await supabase.auth.getUser();
  // return user?.id || null;
  return null;
}

export async function POST(request: NextRequest) {
  console.log("API /api/upload-original-docx rebuda petició POST");

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const userId = await getSupabaseUserId(request);

    if (!userId) {
      console.error("[API upload-original-docx] Usuari no autenticat.");
      return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 });
    }

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
    const originalFileName = file.name;
    const timestamp = Date.now();
    const storagePath = `user-${userId}/template-${templateId}/original/${timestamp}-${originalFileName}`;

    console.log(`[API upload-original-docx] Intentant pujar a Storage: ${storagePath}`);

    const { data, error: uploadError } = await supabaseAdmin.storage
      .from('template-docx') // Nom del bucket
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: true, // Considera si vols 'true' o 'false'. Amb timestamp, 'false' és més segur.
      });

    if (uploadError) {
      console.error('[API upload-original-docx] Error pujant a Supabase Storage:', uploadError);
      return NextResponse.json({ error: 'Error pujant el fitxer a Storage.', details: uploadError.message }, { status: 500 });
    }

    if (!data || !data.path) {
        console.error('[API upload-original-docx] La pujada a Supabase Storage no ha retornat una ruta (path).');
        return NextResponse.json({ error: 'Error confirmant la pujada del fitxer (no path).'}, { status: 500 });
    }
    
    // data.path hauria de ser igual a storagePath si la pujada va bé amb upsert:false i nom únic.
    // Si s'utilitza una funcionalitat de Supabase que generi el nom, s'hauria d'utilitzar data.path.
    // Com que construïm el path nosaltres, podem retornar el nostre storagePath.
    console.log(`[API upload-original-docx] Fitxer pujat correctament a: ${data.path}`);

    return NextResponse.json({ success: true, originalDocxPath: data.path }); // Retornem el path confirmat per Supabase

  } catch (error) {
    console.error("[API upload-original-docx] Error CRÍTIC processant la petició:", error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconegut.';
    return NextResponse.json({ error: 'Error intern processant la petició.', details: errorMessage }, { status: 500 });
  }
}