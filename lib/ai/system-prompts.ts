/**
 * System Prompts per a la integració amb Mistral AI
 * Mòdul de Generació d'Informes
 */

export const ADMIN_ASSISTANT_PROMPT = `Ets un assistent expert en la redacció de documents tècnics i administratius. La teva comunicació ha de ser sempre formal, objectiva i precisa. Basa les teves respostes estrictament en la informació i el context proporcionats. No has d'inventar informació ni expressar opinions personals. El format de sortida ha de ser text pla, ben estructurat en paràgrafs.`;

/**
 * Prompt per a la generació de contingut inicial
 * S'utilitza quan es processen placeholders d'IA per primera vegada
 */
export const CONTENT_GENERATION_PROMPT = (instruction: string, excelData: any, baseText?: string) => `
${ADMIN_ASSISTANT_PROMPT}

CONTEXT: ${instruction}

${excelData ? `DADES EXCEL DISPONIBLES: ${JSON.stringify(excelData, null, 2)}` : ''}

${baseText ? `TEXT BASE DEL DOCUMENT: ${baseText}` : ''}

INSTRUCCIÓ: La teva tasca és completar el paràgraf proporcionat a "TEXT BASE DEL DOCUMENT". Aquest text conté placeholders (marcadors de posició) que has de substituir amb els valors corresponents de les "DADES EXCEL DISPONIBLES".

Regles importants:
1.  **Substitució directa**: Reemplaça cada placeholder (p. ex., \`[NOM]\`, \`[IMPORT]\`) únicament amb el valor corresponent de les dades Excel.
2.  **No modificar el text base**: Conserva l'estructura, la redacció i la puntuació del text base intactes. No has d'afegir paraules, frases ni canviar el format.
3.  **No interpretar**: No generis frases noves ni facis resums. La teva única funció és omplir els buits.

Retorna només el paràgraf complet amb les dades inserides, sense cap explicació addicional.
`;

/**
 * Prompt per al refinament de contingut existent
 * S'utilitza quan l'usuari vol millorar o modificar contingut ja generat
 */
export const CONTENT_REFINEMENT_PROMPT = (currentContent: string, refinementInstruction: string, excelData?: any) => `
${ADMIN_ASSISTANT_PROMPT}

CONTINGUT ACTUAL:
${currentContent}

${excelData ? `DADES EXCEL DISPONIBLES: ${JSON.stringify(excelData, null, 2)}` : ''}

INSTRUCCIÓ DE REFINAMENT: ${refinementInstruction}

INSTRUCCIÓ: Millora el contingut actual aplicant la instrucció de refinament proporcionada. Mantén la coherència amb el document i utilitza les dades Excel si és necessari. Retorna només el text refinat, sense explicacions addicionals.
`;

/**
 * Configuració per defecte per a les crides a Mistral AI
 */
export const MISTRAL_CONFIG = {
  model: 'mistral-large-latest',
  temperature: 0.1, // Baixa per garantir consistència
  max_tokens: 1000, // Ajustable segons necessitat
  top_p: 0.9,
} as const;

/**
 * Model alternatiu per a casos que requereixen menys precisió però més velocitat
 */
export const MISTRAL_CONFIG_FAST = {
  model: 'mistral-medium-latest',
  temperature: 0.2,
  max_tokens: 500,
  top_p: 0.95,
} as const;
