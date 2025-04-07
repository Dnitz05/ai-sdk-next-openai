// /app/api/analyze-image/route.ts
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(req: Request) {
  try {
    const { image } = await req.json()

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Falta la imatge' }, { status: 400 })
    }

    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Ets un assistent expert en anàlisi de documents legals. Llegeix la imatge i transcriu fidelment el contingut, indicant també la jerarquia i format si és clar. No inventis informació.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: image }
            }
          ]
        }
      ],
    })

    const result = chatCompletion.choices?.[0]?.message?.content || 'Cap resposta'
    return NextResponse.json({ result })
  } catch (err: any) {
    return NextResponse.json({ error: 'Error al parlar amb l’IA: ' + err.message }, { status: 500 })
  }
}
