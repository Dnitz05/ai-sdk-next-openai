import { NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { put } from '@vercel/blob'

export const maxDuration = 60
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
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    const pageCount = pdfDoc.getPageCount()

    console.log(`📚 PDF amb ${pageCount} pàgines`)

    const pages: string[] = []

    for (let i = 0; i < pageCount; i++) {
      console.log(`🖨️ Processant pàgina ${i + 1}`)

      const singlePagePdf = await PDFDocument.create()
      const [page] = await singlePagePdf.copyPages(pdfDoc, [i])
      singlePagePdf.addPage(page)
      const pdfBytes = await singlePagePdf.save()

      const pngBuffer = await sharp(pdfBytes, { density: 150 })
        .png()
        .toBuffer()

      const blob = await put(`page-${Date.now()}-${i}.png`, pngBuffer, {
        access: 'public',
        contentType: 'image/png',
      })

      console.log(`✅ Pujada pàgina ${i + 1}: ${blob.url}`)
      pages.push(blob.url)
    }

    console.log('🏁 Totes les pàgines processades correctament')
    return NextResponse.json({ pages })
  } catch (err: any) {
    console.error('❌ Error al processar el PDF:', err)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
