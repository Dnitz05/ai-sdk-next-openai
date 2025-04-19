// app/api/save-configuration/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/serverClient'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

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
    // VALIDACIÓ EXPLÍCITA DEL PAYLOAD
    if (!configurationData || typeof configurationData !== 'object') {
      return NextResponse.json({ error: 'Payload invàlid.' }, { status: 400 })
    }
    // Validació bàsica de camps essencials
    if (
      typeof configurationData.finalHtml !== 'string' ||
      configurationData.finalHtml.length === 0
    ) {
      return NextResponse.json({ error: 'finalHtml obligatori i ha de ser string.' }, { status: 400 })
    }
    if (
      !Array.isArray(configurationData.linkMappings) ||
      !Array.isArray(configurationData.aiInstructions)
    ) {
      return NextResponse.json({ error: 'linkMappings i aiInstructions han de ser arrays.' }, { status: 400 })
    }
    if (
      configurationData.config_name && typeof configurationData.config_name !== 'string'
    ) {
      return NextResponse.json({ error: 'config_name ha de ser string.' }, { status: 400 })
    }
    if (configurationData.finalHtml.length > 1_000_000) {
      return NextResponse.json(
        { error: 'HTML >1MB.', htmlSize: configurationData.finalHtml.length },
        { status: 413 }
      )
    }

// 3. ENFOQUE ALTERNATIVO: Usar directamente servicio con service role 
// para saltar las restricciones RLS
// IMPORTANTE: Esto solo debe usarse de manera segura cuando puedas verificar
// el usuario por otros medios

const cookieStore = cookies()
const supabase = await createServerSupabaseClient()

    // 4. Obtener usuario actual para verificar su identidad
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      console.error("Error obteniendo información del usuario:", userError)
      return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 })
    }
    
    // Obtener el ID del usuario para usar en la inserción
    const userId = userData.user.id
    console.log("Usuario autenticado identificado:", userId)
    
    // Usar un cliente con la service role key que bypasea RLS
    // pero solo después de verificar que el usuario está autenticado
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key bypasea RLS
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    )
    
    // NOTA: Este cliente ignora RLS, por lo que debemos asegurarnos manualmente
    // de que solo se permite al usuario actual modificar sus propios datos
    console.log("Cliente de servicio creado, preparando datos...")

    // 5. Serializar campos JSON con mayor seguridad
    let linkMappings: any[], aiInstructions: any[]
    try {
      // Manejar arrays vacíos
      if (!configurationData.linkMappings || !Array.isArray(configurationData.linkMappings)) {
        linkMappings = []
      } else {
        linkMappings = configurationData.linkMappings
      }
      
      if (!configurationData.aiInstructions || !Array.isArray(configurationData.aiInstructions)) {
        aiInstructions = []
      } else {
        aiInstructions = configurationData.aiInstructions
      }
    } catch (e) {
      console.error("Error procesando datos JSON:", e)
      return NextResponse.json(
        { error: 'Error en format JSON.', details: (e as Error).message },
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

    // 7. LOGS DETALLATS I ASSERTS
    console.log("Iniciant inserció amb payload:", JSON.stringify(configToInsert, null, 2), "userId:", userId)
    if (!configToInsert.user_id || configToInsert.user_id !== userId) {
      console.error("Assert fallit: user_id no coincideix amb userId autenticat!", { configToInsertUserId: configToInsert.user_id, userId })
      return NextResponse.json({ error: 'Assert: user_id no coincideix amb l’usuari autenticat.' }, { status: 500 })
    }
    // 7. Inserción con el cliente de servicio (bypasa RLS)
    const { data: insertedData, error: dbError } = await serviceClient
      .from('plantilla_configs')
      .insert([configToInsert])
      .select()
      .single()

    if (dbError) {
      console.error("Error detallado de inserción:", {
        code: dbError.code,
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint
      })
      
      let msg = 'Error al desar.'
      if (dbError.code === '23502') msg = 'Camp obligatori faltant.'
      else if (dbError.code === '23505') msg = 'Duplicat.'
      else if (dbError.code === '42P01') msg = 'Taula no trobada.'
      else if (dbError.code?.startsWith('42')) msg = 'Sintaxi SQL.'
      else if (dbError.code?.startsWith('28')) msg = 'RLS / permisos.'
      // RETORNAR MÉS INFO EN DEV
      const isDev = process.env.NODE_ENV === 'development' || process.env.SUPABASE_DEBUG === 'true'
      return NextResponse.json(
        isDev
          ? { error: msg, details: dbError }
          : { error: msg, details: dbError.message },
        { status: 500 }
      )
    }
    
    console.log("✅ Inserción completada con éxito:", insertedData?.id)

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
