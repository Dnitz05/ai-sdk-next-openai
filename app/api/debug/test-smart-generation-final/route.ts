import { NextRequest, NextResponse } from 'next/server';
import { SmartDocumentProcessor } from '@/lib/smart/SmartDocumentProcessor';
import { BatchProcessingConfig } from '@/lib/smart/types';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const maxDuration = 300;

async function handler(req: NextRequest) {
  try {
    console.log('🚀 [Test-Smart-Generation-Final] Iniciant test final de generació intel·ligent...');

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll().map(c => ({ name: c.name, value: c.value })),
          setAll: () => {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, template_id, excel_data')
      .eq('user_id', user.id)
      .neq('excel_data', null)
      .limit(1)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ success: false, error: 'No s\'ha trobat un projecte adequat per al test.' }, { status: 404 });
    }

    const { data: template, error: templateError } = await supabase
      .from('plantilla_configs')
      .select('final_html, docx_storage_path')
      .eq('id', project.template_id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ success: false, error: 'No s\'ha trobat la plantilla associada al projecte.' }, { status: 404 });
    }

    const config: BatchProcessingConfig = {
      templateId: project.template_id,
      templateContent: template.final_html,
      templateStoragePath: template.docx_storage_path,
      excelData: [project.excel_data[0]],
      userId: user.id,
    };

    const processor = new SmartDocumentProcessor();
    const result = await processor.processBatch(config);

    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Error en el processament', details: result.errorMessage }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Test final completat amb èxit!', result });

  } catch (error) {
    console.error('❌ [Test-Smart-Generation-Final] Error en el test:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconegut';
    return NextResponse.json({ success: false, error: 'Error intern en el test', details: errorMessage }, { status: 500 });
  }
}

export { handler as GET, handler as POST };
