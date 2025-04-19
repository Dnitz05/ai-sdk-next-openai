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
    console.log('API Route POST rebuda.')

    // 1️⃣ Parseja el JSON
    let payload: SaveConfigPayload
    try {
      payload = (await request.json()) as SaveConfigPayload
    } catch (e) {
      console.error('JSON invàlid:', e)
      return NextResponse.json({ error: 'JSON invàlid' }, { status: 400 })
    }

    // 2️⃣ Validacions
    if (!payload.finalHtml) {
      return NextResponse.json({ error: 'Manca finalHtml.' }, { status: 400 })
    }
    if (payload.finalHtml.length > 1_000_000) {
      console.warn('HTML massa gran:', payload.finalHtml.length)
      return NextResponse.json(
        { error: 'HTML >1MB.', htmlSize: payload.finalHtml.length },
        { status: 413 }
      )
    }

    // 3️⃣ Crea el client Supabase SSR
    const supabase = await createServerSupabaseClient()

    // 4️⃣ Obté l’usuari autenticat
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      console.error('Usuari no validat:', userError)
      return NextResponse.json({ error: 'Usuari no validat.' }, { status: 401 })
    }
    const userId = userData.user.id

    // 5️⃣ Stringify dels camps JSON
    let linkMappingsJson: string
    let aiInstructionsJson: string
    try {
      linkMappingsJson = JSON.stringify(payload.linkMappings || [])
      aiInstructionsJson = JSON.stringify(payload.aiInstructions || [])
      JSON.parse(linkMappingsJson)
      JSON.parse(aiInstructionsJson)
    } catch (e) {
      console.error('Camp JSON invàlid:', e)
      return NextResponse.json(
        { error: 'JSON de camp invàlid.', details: (e as Error).message },
        { status: 400 }
      )
    }

    // 6️⃣ Prepara l’objecte per inserir
    const toInsert = {
      user_id: userId,
      config_name:
        payload.config_name || payload.baseDocxName || 'Sense nom',
      base_docx_name: payload.baseDocxName,
      excel_file_name: payload.excelInfo?.fileName ?? null,
      excel_headers: payload.excelInfo?.headers ?? [],
      link_mappings: JSON.parse(linkMappingsJson),
      ai_instructions: JSON.parse(aiInstructionsJson),
      final_html: payload.finalHtml,
    }

    console.log('Payload insert:', toInsert)

    // 7️⃣ Inserta a Supabase
    const { data: inserted, error: dbError } = await supabase
      .from('plantilla_configs')
      .insert([toInsert])
      .select()
      .single()

    if (dbError) {
      console.error('DB Error:', dbError)
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

    // 8️⃣ Retorna 201 Created
    return NextResponse.json(
      { message: 'Configuració desada!', configId: inserted?.id },
      { status: 201 }
    )
  } catch (err) {
    console.error('Error general:', err)
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
  console.log('API Route GET rebuda.')
  return NextResponse.json({ message: 'GET pendent.' }, { status: 200 })
}
