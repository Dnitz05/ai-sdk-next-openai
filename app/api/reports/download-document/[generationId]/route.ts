import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/serverClient';
import { createClient } from '@supabase/supabase-js';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';

/**
 * GET /api/reports/download-document/[generationId]
 * Descarrega el document final generat per una generació específica
 */
export async function GET(request: NextRequest) {
  // Extraiem el generationId de la URL manualment segons la nova API de Next.js 15
  let generationId: string | undefined;
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    generationId = pathParts[pathParts.length - 1];
  } catch {
    generationId = undefined;
  }

  console.log("[API download-document] Rebuda petició GET per generationId:", generationId);
  
  try {
    
    if (!generationId) {
      return NextResponse.json({ error: 'generationId és obligatori.' }, { status: 400 });
    }
    
    // Autenticació de l'usuari
    let userId: string | null = null;
    let userError: any = null;
    
    const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const accessToken = authHeader.slice(7).trim();
      try {
        const userClient = createUserSupabaseClient(accessToken);
        const { data: userDataAuth, error: authError } = await userClient.auth.getUser();
        if (!authError && userDataAuth.user) {
          userId = userDataAuth.user.id;
        } else {
          userError = authError;
        }
      } catch (e) {
        userError = e;
      }
    }
    
    if (!userId) {
      const supabaseServer = await createServerSupabaseClient();
      const { data: userDataAuth2, error: serverError } = await supabaseServer.auth.getUser();
      if (!serverError && userDataAuth2.user) {
        userId = userDataAuth2.user.id;
      } else {
        userError = serverError;
      }
    }
    
    if (!userId) {
      console.error("[API download-document] Error obtenint informació de l'usuari:", userError);
      return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 });
    }
    
    console.log("[API download-document] Usuari autenticat:", userId);
    
    // Client amb service role key
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    
    // Verificar que la generació pertany a l'usuari i obtenir el path del document final
    const { data: jobData, error: jobError } = await serviceClient
      .from('generation_jobs')
      .select(`
        id,
        final_document_path,
        generation:generations!inner(
          id,
          excel_row_index,
          projects!inner(
            user_id,
            project_name
          )
        )
      `)
      .eq('generation_id', generationId)
      .single();
    
    if (jobError || !jobData) {
      console.error("[API download-document] Job no trobat:", jobError);
      return NextResponse.json({ 
        error: 'Document no trobat o sense permisos d\'accés.' 
      }, { status: 404 });
    }
    
    // Verificar permisos d'usuari
    if ((jobData.generation as any).projects.user_id !== userId) {
      console.error("[API download-document] Usuari sense permisos per aquesta generació");
      return NextResponse.json({ 
        error: 'No tens permís per accedir a aquest document.' 
      }, { status: 403 });
    }
    
    // Verificar que el document final existeix
    if (!jobData.final_document_path) {
      console.error("[API download-document] Document final no disponible per la generació:", generationId);
      return NextResponse.json({ 
        error: 'El document final encara no està disponible. Assegura\'t que la generació s\'ha completat correctament.' 
      }, { status: 404 });
    }
    
    console.log("[API download-document] Descarregant document des de:", jobData.final_document_path);
    
    // Descarregar el document de Supabase Storage
    const { data: documentData, error: downloadError } = await serviceClient.storage
      .from('documents')
      .download(jobData.final_document_path);
    
    if (downloadError || !documentData) {
      console.error("[API download-document] Error descarregant document de Storage:", downloadError);
      return NextResponse.json({ 
        error: 'Error descarregant el document de Storage.',
        details: downloadError?.message 
      }, { status: 500 });
    }
    
    console.log("[API download-document] Document descarregat correctament. Mida:", documentData.size);
    
    // Generar nom de fitxer descriptiu
    const projectName = (jobData.generation as any).projects.project_name;
    const rowIndex = (jobData.generation as any).excel_row_index;
    const fileName = `${projectName}_Informe_${rowIndex + 1}.docx`
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_') // Netejar caràcters especials
      .replace(/_+/g, '_'); // Eliminar guions baixos duplicats
    
    // Convertir Blob a ArrayBuffer per crear Response
    const arrayBuffer = await documentData.arrayBuffer();
    
    // Retornar el document com a descàrrega
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (err) {
    console.error("[API download-document] Error general:", err);
    return NextResponse.json(
      { 
        error: 'Error intern del servidor.', 
        details: err instanceof Error ? err.message : String(err) 
      },
      { status: 500 }
    );
  }
}
