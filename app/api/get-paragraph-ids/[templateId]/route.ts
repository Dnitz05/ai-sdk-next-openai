import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';
import { createServerSupabaseClient } from '@/lib/supabase/serverClient';

/**
 * API per obtenir els IDs de paràgrafs indexats d'una plantilla específica
 * 
 * Aquesta ruta retorna els mappings de paràgrafs amb els seus IDs de SDT
 * generats durant el procés d'indexació automàtica
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ templateId: string }> }
) {
  const params = await context.params;
  console.log(`[API get-paragraph-ids] Obtenint IDs per plantilla: ${params.templateId}`);
  
  try {
    // Autenticació de l'usuari: primer via header Authorization (Bearer), després cookies
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
          console.log("[API get-paragraph-ids] Usuari autenticat via Bearer token:", userId);
        } else {
          userError = authError;
        }
      } catch (e) {
        userError = e;
      }
    }
    
    if (!userId) {
      try {
        const supabaseServer = await createServerSupabaseClient();
        const { data: userDataAuth2, error: serverError } = await supabaseServer.auth.getUser();
        if (!serverError && userDataAuth2.user) {
          userId = userDataAuth2.user.id;
          console.log("[API get-paragraph-ids] Usuari autenticat via cookies:", userId);
        } else {
          userError = serverError;
        }
      } catch (e) {
        userError = e;
      }
    }
    
    if (!userId) {
      console.error("[API get-paragraph-ids] Error obtenint informació de l'usuari:", userError);
      return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 });
    }

    // Client amb service role key per bypassejar RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    
    // Obtenir les dades de la plantilla
    console.log(`[API get-paragraph-ids] Obtenint dades de plantilla des de BD...`);
    const { data: template, error: templateError } = await supabase
      .from('plantilla_configs')
      .select('paragraph_mappings, indexed_docx_storage_path, base_docx_storage_path')
      .eq('id', params.templateId)
      .eq('user_id', userId)
      .single();
    
    if (templateError || !template) {
      console.error(`[API get-paragraph-ids] Error obtenint plantilla:`, templateError);
      return NextResponse.json({ error: 'No s\'ha trobat la plantilla' }, { status: 404 });
    }

    console.log(`[API get-paragraph-ids] Plantilla trobada. Mappings: ${template.paragraph_mappings?.length || 0}`);
    
    // Si no hi ha mappings guardats, retornar array buit amb informació
    if (!template.paragraph_mappings || !Array.isArray(template.paragraph_mappings)) {
      console.log(`[API get-paragraph-ids] No hi ha mappings guardats. Document indexat: ${template.indexed_docx_storage_path ? 'Sí' : 'No'}`);
      
      return NextResponse.json({
        success: true,
        paragraphMappings: [],
        totalParagraphs: 0,
        indexedDocumentExists: !!template.indexed_docx_storage_path,
        message: template.indexed_docx_storage_path 
          ? 'El document està indexat però no hi ha mappings guardats'
          : 'El document no està indexat. Cal pujar-lo de nou per generar els IDs.'
      });
    }
    
    // Processar els mappings per retornar en format útil pel frontend
    const processedMappings = template.paragraph_mappings.map((mapping: any, index: number) => ({
      paragraphId: mapping.id || mapping.paragraphId,
      text: mapping.text || mapping.content || '',
      numericId: mapping.numericId || index + 1,
      originalIndex: mapping.originalIndex || index
    }));
    
    console.log(`[API get-paragraph-ids] Retornant ${processedMappings.length} mappings processats`);
    
    return NextResponse.json({
      success: true,
      paragraphMappings: processedMappings,
      totalParagraphs: processedMappings.length,
      indexedDocumentPath: template.indexed_docx_storage_path,
      indexedDocumentExists: !!template.indexed_docx_storage_path
    });
    
  } catch (error) {
    console.error(`[API get-paragraph-ids] Error no controlat:`, error);
    return NextResponse.json({ 
      error: 'Error intern del servidor',
      details: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 });
  }
}
