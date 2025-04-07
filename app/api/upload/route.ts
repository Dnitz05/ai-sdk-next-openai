
import { NextResponse } from 'next/server'
import mammoth from 'mammoth'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file || file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return NextResponse.json({ error: 'Només s’accepten arxius .docx' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const result = await mammoth.extractRawText({ buffer })
    const text = result.value?.trim()

    if (!text || text.length === 0) {
      return NextResponse.json({ error: 'No s’ha pogut extreure text del document.' }, { status: 422 })
    }

    return NextResponse.json({ text })
  } catch (error: any) {
    return NextResponse.json(
      { error: `Error intern del servidor: ${error.message}` },
      { status: 500 }
    )
  }
}
