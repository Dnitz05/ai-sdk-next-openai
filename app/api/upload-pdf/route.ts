import { NextResponse } from 'next/server'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js'
import { createCanvas } from 'canvas'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Només s’accepten arxius PDF' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const pdfData = new Uint8Array(arrayBuffer)

    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise
    const images: string[] = []

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: 2 })

      const canvas = createCanvas(viewport.width, viewport.height)
      const context = canvas.getContext('2d')

      await page.render({ canvasContext: context, viewport }).promise
      const img = canvas.toDataURL('image/png')
      images.push(img)
    }

    return NextResponse.json({ pages: images })
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al processar el PDF: ' + error.message }, { status: 500 })
  }
}
