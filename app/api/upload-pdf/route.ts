import { NextResponse } from 'next/server'
// Important: Utilitza 'legacy' build per compatibilitat amb Node
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js'
import { createCanvas } from 'canvas' // Importem de canvas
import { put } from '@vercel/blob'

export const maxDuration = 60 // segons
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    console.log('📥 Rebent formulari...')
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      console.warn('⚠️ Cap fitxer rebut')
      return NextResponse.json({ error: 'No s’ha trobat cap fitxer' }, { status: 400 })
    }
    console.log(`📄 Fitxer rebut: ${file.name}`)

    const arrayBuffer = await file.arrayBuffer()
    // Important: Cal indicar el workerSrc (tot i que a Node no s'usa directament, és necessari per a pdfjs-dist)
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
    const pageCount = pdf.numPages;
    console.log(`📚 PDF amb ${pageCount} pàgines`)

    const pages: string[] = []

    for (let i = 1; i <= pageCount; i++) { // pdf.js comença les pàgines a 1
      console.log(`🖨️ Processant pàgina ${i}`)
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 1.5 }) // Escala per més qualitat

      // Creem un canvas amb les dimensions de la pàgina
      const canvas = createCanvas(viewport.width, viewport.height)
      const context = canvas.getContext('2d')

      // Renderitzem la pàgina del PDF al canvas
     await page.render({ canvasContext: context as any, viewport }).promise

      // Obtenim el buffer PNG del canvas
      const pngBuffer = canvas.toBuffer('image/png')

      // Pugem la imatge a Vercel Blob
      const blob = await put(`page-${Date.now()}-${i}.png`, pngBuffer, {
        access: 'public',
        contentType: 'image/png',
      })

      console.log(`✅ Pujada pàgina ${i}: ${blob.url}`)
      pages.push(blob.url)

      // Alliberem memòria (important en bucles)
      page.cleanup()
    }

    console.log('🏁 Totes les pàgines processades correctament')
    return NextResponse.json({ pages })

  } catch (err: any) {
    console.error('❌ Error al processar el PDF amb pdfjs/canvas:', err)
    return NextResponse.json({ error: 'Error intern del servidor processant PDF amb pdfjs/canvas' }, { status: 500 })
  }
}
