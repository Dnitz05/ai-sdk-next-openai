import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Carreguem la clau API d'OpenAI des de les variables d'entorn
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const maxDuration = 60; // Mantenim el màxim permès pel pla Pro (o Hobby si no es va canviar)
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Validem que la clau d'OpenAI estigui configurada
    if (!process.env.OPENAI_API_KEY) {
      console.error('API Key d\'OpenAI no trobada a les variables d\'entorn.');
      return NextResponse.json({ error: 'La clau API d\'OpenAI no està configurada al servidor.' }, { status: 500 });
    }

    // Obtenim la URL de la imatge del cos de la petició
    const { image } = await req.json();

    if (!image) {
      console.warn('No s\'ha rebut cap URL d\'imatge a la petició.');
      return NextResponse.json({ error: 'No s\'ha proporcionat cap imatge.' }, { status: 400 });
    }

    // --- PROMPT REFINAT AMB MÉS DETALL DE FORMAT ---
    const analysisPrompt = `
Analitza la següent imatge, que correspon a una pàgina d'un document PDF. Extreu tot el contingut textual amb la màxima precisió (OCR). Identifica l'estructura semàntica de la pàgina, classificant cada bloc de contingut (títols H1-H6 segons jerarquia visual, paràgrafs, llistes ordenades/desordenades amb els seus ítems, taules, possibles capçaleres/peus de pàgina, signatures, dates, etc.).

Per a cada element identificat:
1.  Descriu el format visual observat amb el màxim detall possible:
    * **alignment**: "left", "center", "right", "justify".
    * **style**: Array amb "bold", "italics" si s'aplica, o [].
    * **decoration**: Array amb "underline", "strikethrough" si s'aplica, o [].
    * **relative_size**: Classifica la mida relativa del text en: "xlarge", "large", "medium", "normal", "small", "xsmall".
    * **font_family_type**: Intenta identificar si la font és "serif", "sans-serif", "monospace" o "unknown" basant-te en la seva aparença.
    * **color**: Indica el color bàsic si és clarament diferent del negre (ex: "gray", "blue", "red"). Per defecte, assumeix "black".
    * **indentation**: Indica 'true' si l'element (paràgraf, ítem de llista) té un sagnat clar, altrament 'false'.
2.  Si és una taula, extreu les seves dades de manera estructurada (array de files, on cada fila és un array de cel·les com a string).
3.  Si és una llista, extreu els ítems textuals.

Genera la teva resposta **EXCLUSIVAMENT** en format JSON vàlid, seguint aquesta estructura exacta per a cada element detectat dins de l'array "elements". Omet les claus opcionals si no pots determinar el valor o no aplica:

{
  "elements": [
    {
      "type": "tipus_element", // "heading", "paragraph", "list", "list_item", "table", "footer", "signature", "date", "other"
      "level": numero, // Opcional: per a headings (1-6)
      "text_content": "text extret via OCR",
      "formatting": {
        "alignment": "string",
        "style": ["string"],
        "decoration": ["string"], // Opcional
        "relative_size": "string",
        "font_family_type": "string", // Opcional
        "color": "string", // Opcional
        "indentation": boolean // Opcional
      },
      "list_items": ["string"], // Opcional: per a 'list'
      "table_data": [["string"]] // Opcional: per a 'table'
    }
    // ... més elements en ordre d'aparició
  ]
}

No incloguis comentaris, explicacions ni text addicional fora de l'estructura JSON principal. Sigues extremadament precís amb el text extret (OCR). La qualitat del format descrit és important.
`;
    // ------------------------------------------

    console.log(`🧠 Enviant imatge a GPT-4o per anàlisi (prompt REFINAT)...`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Assegura't que és un model amb capacitat visual
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: analysisPrompt },
            {
              type: "image_url",
              image_url: {
                url: image, // URL de CloudConvert
                detail: "high" // Podem demanar alta resolució per a millor OCR/anàlisi
              },
            },
          ],
        },
      ],
      max_tokens: 4090, // Deixem un marge ampli
      temperature: 0.1, // Baixem temperatura per a més consistència en l'estructura JSON
    });

    console.log(`✅ Resposta rebuda de GPT-4o (prompt refinat).`);
    const rawResult = response.choices[0]?.message?.content;

    if (!rawResult) {
      console.error('La resposta de la IA estava buida.');
      throw new Error('La resposta de la IA estava buida.');
    }

    // Intentem parsejar el resultat com a JSON, netejant possibles marcadors
    let jsonResult;
    try {
        const cleanedJsonString = rawResult.replace(/^```json\s*|```\s*$/g, '').trim(); // Neteja ```json ... ```
        jsonResult = JSON.parse(cleanedJsonString);
        console.log(`📊 JSON parsejat correctament (prompt refinat).`);
        // Validació mínima de l'estructura esperada
        if (!jsonResult || !Array.isArray(jsonResult.elements)) {
          console.warn("El JSON retornat per la IA no té l'estructura esperada {elements: []}:", jsonResult);
          throw new Error("El JSON retornat per la IA no té l'estructura esperada {elements: []}");
        }
    } catch (parseError: any) {
        console.error('❌ Error parsejant JSON de la IA (prompt refinat):', parseError);
        console.error('Raw result rebut de la IA:', rawResult); // Mostrem el text cru per debug
        throw new Error(`La IA no ha retornat un JSON vàlid (prompt refinat). Error: ${parseError.message}`);
    }

    // Retornem el resultat JSON parsejat
    return NextResponse.json({ result: jsonResult });

  } catch (err: any) {
    console.error('❌ Error general a /api/analyze-image:', err);
    const errorMessage = err.message || 'Error desconegut analitzant la imatge';
    // Retornem l'error en format JSON
    return NextResponse.json({ error: `Error intern del servidor: ${errorMessage}` }, { status: 500 });
  }
}
