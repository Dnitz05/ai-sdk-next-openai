// app/api/save-configuration/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/serverClient'

interface SaveConfigPayload {
  baseDocxName: string | null
  config_name?: string
  excelInfo: { fileName: string | null; headers: string[] | null } | null
  linkMappings: { id: string; excelHeader: string; selectedText: string }[]
  aiInstructions: { id: string; prompt: string; originalText?: string }[]
  finalHtml: string
}

export async function POST(request: NextRequest) {
  try {
    // 1. Parseja el JSON
    const configurationData = (await request.json()) as SaveConfigPayload

    // 2. Validacions bàsiques
    if (!configurationData || typeof configurationData !== 'object') {
      return NextResponse.json({ error: 'Payload invàlid.' }, { status: 400 })
    }
    if (configurationData.finalHtml.length > 1_000_000) {
      return NextResponse.json(
        { error: 'HTML >1MB.', htmlSize: configurationData.finalHtml.length },
        { status: 413 }
      )
    }

// 3. Instància Supabase SSR amb gestió de cookies completa
const supabase = await createServerSupabaseClient()

    // 4. Obté l'usuari
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Usuari no validat.' }, { status: 401 })
    }
    const userId = userData.user.id

    // 5. Serialitza camps JSON
    let linkMappings, aiInstructions
    try {
      linkMappings = JSON.parse(JSON.stringify(configurationData.linkMappings || []))
      aiInstructions = JSON.parse(JSON.stringify(configurationData.aiInstructions || []))
    } catch (e) {
      return NextResponse.json(
        { error: 'JSON de camp invàlid.', details: (e as Error).message },
        { status: 400 }
      )
    }

    // 6. Prepara payload
    const configToInsert = {
      user_id: userId,
      config_name:
        configurationData.config_name ||
        configurationData.baseDocxName ||
        'Sense nom',
      base_docx_name: configurationData.baseDocxName,
      excel_file_name: configurationData.excelInfo?.fileName ?? null,
      excel_headers: configurationData.excelInfo?.headers ?? [],
      link_mappings: linkMappings,
      ai_instructions: aiInstructions,
      final_html: configurationData.finalHtml,
    }

    // 7. Inserció
    const { data: insertedData, error: dbError } = await supabase
      .from('plantilla_configs')
      .insert([configToInsert])
      .select()
      .single()

    if (dbError) {
      let msg = 'Error al desar.'
      if (dbError.code === '23502') msg = 'Camp obligatori faltant.'
      else if (dbError.code === '23505') msg = 'Duplicat.'
      else if (dbError.code === '42P01') msg = 'Taula no trobada.'
      else if (dbError.code?.startsWith('42')) msg = 'Sintaxi SQL.'
      else if (dbError.code?.startsWith('28')) msg = 'RLS / permisos.'
      return NextResponse.json(
        { error: msg, details: dbError.message },
        { status: 500 }
      )
    }

    // 8. Retorna èxit
    return NextResponse.json(
      { message: 'Configuració desada!', configId: insertedData?.id },
      { status: 201 }
    )
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Error intern',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: "GET pendent." }, { status: 200 })
}
