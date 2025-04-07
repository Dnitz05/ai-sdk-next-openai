import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Carreguem la clau API d'OpenAI des de les variables d'entorn
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const maxDuration = 60; // Mantenim el màxim permès per Hobby
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Validem que la clau d'OpenAI estigui configurada
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'La clau API d\'OpenAI no està configurada al servidor.' }, { status: 500 });
    }

    // Obtenim la URL de la imatge (o dades base64) del cos de la petició
    const { image } = await req.json();

    if (!image) {
      return NextResponse.json({ error: 'No s\'ha proporcionat cap imatge.' }, { status: 400 });
    }

    // ---- NOU PROMPT DETALLAT PER A GPT-4o ----
    const analysisPrompt = `
Analitza la següent imatge, que correspon a una pàgina d'un document PDF. Extreu tot el contingut textual amb la màxima precisió (OCR). Identifica l'estructura semàntica de la pàgina, classificant cada bloc de contingut (títols H1-H6 segons jerarquia visual, paràgrafs, llistes ordenades/desordenades amb els seus ítems, taules, possibles capçaleres/peus de pàgina, signatures, dates, etc.). Per a cada element identificat, descriu breument el format visual observat (alineació: left/center/right/justify; estil: bold/italics; mida relativa: large/medium/small/normal). Si detectes taules, extreu les seves dades de manera estructurada (files i columnes).

Genera la teva resposta EXCLUSIVAMENT en format JSON, seguint aquesta estructura:

{
  "elements": [
    {
      "type": "tipus_element", // ex: "heading", "paragraph", "list", "list_item", "table", "footer", "signature", "date", "other"
      "level": numero, // Opcional: per a headings (1-6)
      "text_content": "text extret", // Text exacte via OCR
      "formatting": {
        "alignment": "alineació", // ex: "left", "center", "right", "justify"
        "style": ["estil1", "estil2"], // ex: ["bold", "italics"] o [] si no n'hi ha
        "relative_size": "mida" // ex: "large", "medium", "normal", "small"
      },
      "list_items": [ // Opcional: per a 'list', array de strings amb el text de cada ítem
        "Ítem 1",
        "Ítem 2"
      ],
      "table_data": [ // Opcional: per a 'table', array d'arrays (files) de strings (cel·les)
        ["Capçalera 1", "Capçalera 2"],
        ["Dada 1.1", "Dada 1.2"]
      ]
    }
    // ... més elements en l'ordre que apareixen a la pàgina
  ]
}

Assegura't que el JSON sigui vàlid. No incloguis comentaris ni text introductori/final fora del JSON. Extreu el text amb la màxima fidelitat possible.
`;
    // ------------------------------------------

    console.log(`🧠 Enviant imatge a GPT-4o per anàlisi estructurada...`);

    // Fem la crida a l'API d'OpenAI amb el model vision i el nou prompt
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // O el model vision més recent disponible
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: analysisPrompt },
            {
              type: "image_url",
              image_url: {
                url: image, // La URL de la imatge que ve de CloudConvert
              },
            },
          ],
        },
      ],
      max_tokens: 4000, // Augmentem tokens per si la pàgina és densa
       // Important per assegurar sortida JSON (si el model ho suporta bé)
       // Si dona problemes, treure aquesta línia i parsejar manualment el content
       // response_format: { type: "json_object" },
    });

    console.log(`✅ Resposta rebuda de GPT-4o.`);

    // Obtenim el contingut de la resposta
    const rawResult = response.choices[0]?.message?.content;

    if (!rawResult) {
      throw new Error('La resposta de la IA estava buida.');
    }

    // Intentem parsejar el resultat com a JSON
    // Cal netejar possibles ```json ... ``` que pot afegir la IA
    let jsonResult;
    try {
        const cleanedJsonString = rawResult.replace(/```json\n?([\s\S]*?)\n?```/g, '$1').trim();
        jsonResult = JSON.parse(cleanedJsonString);
        console.log(`📊 JSON parsejat correctament.`);
    } catch (parseError) {
        console.error('❌ Error parsejant JSON de la IA:', parseError);
        console.error('Raw result:', rawResult); // Mostrem el text cru per debug
        throw new Error('La IA no ha retornat un JSON vàlid.');
    }

    // Retornem el resultat JSON parsejat
    return NextResponse.json({ result: jsonResult });

  } catch (err: any) {
    console.error('❌ Error a /api/analyze-image:', err);
    const errorMessage = err.message || 'Error desconegut analitzant la imatge';
    return NextResponse.json({ error: `Error intern del servidor: ${errorMessage}` }, { status: 500 });
  }
}
