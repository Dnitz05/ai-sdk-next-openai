import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/serverClient';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';
import { getExcelInfoFromTemplate } from '@/util/excel/readExcelFromStorage';

/**
 * GET /api/reports/template-excel-info/[templateId]
 * Retorna informació bàsica de l'Excel associat a una plantilla (headers, totalRows)
 * sense carregar totes les dades per eficiència
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ templateId: string }> }
) {
  const params = await context.params;
  console.log(`[API template-excel-info] Rebuda petició GET per plantilla: ${params.templateId}`);
  
  try {
    const { templateId } = params;
    
    if (!templateId) {
      console.error("[API template-excel-info] ❌ templateId buit o undefined");
      return NextResponse.json({ error: 'templateId és obligatori.' }, { status: 400 });
    }

    // Verificar variables d'entorn críticas
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error("[API template-excel-info] ❌ NEXT_PUBLIC_SUPABASE_URL no està configurada");
      return NextResponse.json({ error: 'Error de configuració del servidor' }, { status: 500 });
    }
    
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[API template-excel-info] ❌ SUPABASE_SERVICE_ROLE_KEY no està configurada");
      return NextResponse.json({ error: 'Error de configuració del servidor' }, { status: 500 });
    }
    
    console.log("[API template-excel-info] ✅ Variables d'entorn correctes");

    // Autenticació de l'usuari
    let userId: string | null = null;
    let userError: any = null;
    
    console.log("[API template-excel-info] Iniciant autenticació...");
    
    const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const accessToken = authHeader.slice(7).trim();
      console.log("[API template-excel-info] Intentant autenticació via Bearer token");
      try {
        const userClient = createUserSupabaseClient(accessToken);
        const { data: userDataAuth, error: authError } = await userClient.auth.getUser();
        if (!authError && userDataAuth.user) {
          userId = userDataAuth.user.id;
          console.log("[API template-excel-info] ✅ Autenticat via Bearer token");
        } else {
          userError = authError;
          console.log("[API template-excel-info] ⚠️ Error autenticació Bearer:", authError);
        }
      } catch (e) {
        userError = e;
        console.log("[API template-excel-info] ⚠️ Excepció autenticació Bearer:", e);
      }
    }
    
    if (!userId) {
      console.log("[API template-excel-info] Intentant autenticació via cookies...");
      const supabaseServer = await createServerSupabaseClient();
      const { data: userDataAuth2, error: serverError } = await supabaseServer.auth.getUser();
      if (!serverError && userDataAuth2.user) {
        userId = userDataAuth2.user.id;
        console.log("[API template-excel-info] ✅ Autenticat via cookies");
      } else {
        userError = serverError;
        console.log("[API template-excel-info] ❌ Error autenticació cookies:", serverError);
      }
    }
    
    if (!userId) {
      console.error("[API template-excel-info] ❌ Error obtenint informació de l'usuari:", userError);
      return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 });
    }

    console.log(`[API template-excel-info] ✅ Usuari autenticat: ${userId}, templateId: ${templateId}`);

    // Obtenir informació de l'Excel de la plantilla
    console.log(`[API template-excel-info] Cridant getExcelInfoFromTemplate(${templateId}, ${userId})`);
    try {
      const excelInfo = await getExcelInfoFromTemplate(templateId, userId);
      
      console.log(`[API template-excel-info] ✅ Info Excel obtinguda per plantilla ${templateId}:`, {
        hasExcel: excelInfo.hasExcel,
        fileName: excelInfo.fileName,
        headersCount: excelInfo.headers?.length,
        totalRows: excelInfo.totalRows
      });

      return NextResponse.json(excelInfo, { status: 200 });
      
    } catch (excelError) {
      console.error("[API template-excel-info] Error obtenint info Excel:", excelError);
      
      // Si l'error és perquè no hi ha Excel, no és un error 500
      if (excelError instanceof Error && excelError.message.includes('no té Excel associat')) {
        return NextResponse.json({ hasExcel: false }, { status: 200 });
      }
      
      return NextResponse.json({ 
        error: 'Error obtenint informació de l\'Excel de la plantilla.',
        details: excelError instanceof Error ? excelError.message : String(excelError)
      }, { status: 500 });
    }
    
  } catch (err) {
    console.error("[API template-excel-info] Error general:", err);
    return NextResponse.json(
      { error: 'Error intern del servidor.', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
