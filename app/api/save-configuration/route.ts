import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/serverClient';

interface SaveConfigPayload {
  baseDocxName: string | null;
  config_name?: string;
  excelInfo: { fileName: string | null; headers: string[] | null; } | null;
  linkMappings: { id: string; excelHeader: string; selectedText: string; }[];
  aiInstructions: { id: string; prompt: string; originalText?: string; }[];
  finalHtml: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log("API Route POST rebuda.");
    const allCookies = await cookies();
    if (typeof allCookies.getAll === 'function') {
      console.log("Cookies:", allCookies.getAll());
    } else {
      console.log("sb-access-token:", allCookies.get('sb-access-token'));
    }

    console.log("HEADERS:", request.headers);
    const bodyText = await request.text();
    console.log("RAW BODY:", bodyText);

    let configurationData: SaveConfigPayload;
    try {
      configurationData = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: 'JSON invàlid' }, { status: 400 });
    }
    if (!configurationData || typeof configurationData !== 'object') {
      return NextResponse.json({ error: 'Payload invàlid.' }, { status: 400 });
    }

    if (configurationData.finalHtml.length > 1_000_000) {
      console.warn("HTML massa gran:", configurationData.finalHtml.length);
      return NextResponse.json({
        error: 'HTML >1MB.',
        htmlSize: configurationData.finalHtml.length
      }, { status: 413 });
    }

    const supabase = createServerSupabaseClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Usuari no validat.' }, { status: 401 });
    }
    const userId = userData.user.id;

    // JSON stringify + parse per assegurar validesa
    let linkMappingsJson: string;
    let aiInstructionsJson: string;
    try {
      linkMappingsJson = JSON.stringify(configurationData.linkMappings || []);
      aiInstructionsJson = JSON.stringify(configurationData.aiInstructions || []);
      JSON.parse(linkMappingsJson);
      JSON.parse(aiInstructionsJson);
    } catch (e) {
      return NextResponse.json({
        error: 'JSON de camp invàlid.',
        details: e instanceof Error ? e.message : String(e)
      }, { status: 400 });
    }

    const configToInsert = {
      user_id: userId,
      config_name: configurationData.config_name || configurationData.baseDocxName || 'Sense nom',
      base_docx_name: configurationData.baseDocxName,
      excel_file_name: configurationData.excelInfo?.fileName ?? null,
      excel_headers: configurationData.excelInfo?.headers ?? [],
      link_mappings: JSON.parse(linkMappingsJson),
      ai_instructions: JSON.parse(aiInstructionsJson),
      final_html: configurationData.finalHtml
    };
    console.log("Payload insert:", configToInsert);

    const { data: insertedData, error: dbError } = await supabase
      .from('plantilla_configs')
      .insert([configToInsert])
      .select()
      .single();

    if (dbError) {
      console.error("DB Error:", dbError);
      let msg = 'Error al desar.';
      if (dbError.code === '23502') msg = 'Camp obligatori faltant.';
      else if (dbError.code === '23505') msg = 'Duplicat.';
      else if (dbError.code === '42P01') msg = 'Taula no trobada.';
      else if (dbError.code?.startsWith('42')) msg = 'Sintaxi SQL.';
      else if (dbError.code?.startsWith('28')) msg = 'RLS / permisos.';
      return NextResponse.json({ error: msg, details: dbError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Configuració desada!',
      configId: insertedData?.id
    }, { status: 201 });

  } catch (err) {
    console.error("Error general:", err);
    return NextResponse.json({
      error: 'Error intern',
      details: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  console.log("API Route GET rebuda.");
  return NextResponse.json({ message: "GET pendent." }, { status: 200 });
}
