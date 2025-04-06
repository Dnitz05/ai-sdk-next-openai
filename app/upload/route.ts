import { NextResponse } from 'next/server'
import mammoth from 'mammoth'

export const config = {
  api: {
    bodyParser: false,
  },
}

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File

  if (!file || file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return NextResponse.json({ error: 'Només s’accepten arxius .docx' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const result = await mammoth.extractRawText({ buffer })
  const text = result.value

  return NextResponse.json({ text })
}

