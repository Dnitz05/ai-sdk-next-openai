# Diagnòstic del Worker - Variables d'Entorn

## Problema Identificat

El worker falla amb l'error:
```
Error obtenint el document de context: Error descarregant el document "user-xxx/template-xxx/original/original.docx": {}
```

## Anàlisi Arquitectònica

### Frontend ✅ SOLUCIONAT
- AsyncJobProgress funciona perfectament
- No més bucle infinit
- Detecta correctament quan els jobs fallen
- Logs clars i informatius

### Backend ❌ PROBLEMA ACTUAL
- El worker no pot accedir a Supabase Storage
- Error `{}` indica problema de configuració
- Variables d'entorn probablement no disponibles

## Diagnòstic Implementat

### 1. Logs Detallats Afegits

**Fitxer**: `lib/workers/documentProcessor.ts`
```typescript
// Verificar variables d'entorn del worker
console.log(`[DocumentProcessor] NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'PRESENT' : 'MISSING'}`);
console.log(`[DocumentProcessor] SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'PRESENT' : 'MISSING'}`);
console.log(`[DocumentProcessor] MISTRAL_API_KEY: ${process.env.MISTRAL_API_KEY ? 'PRESENT' : 'MISSING'}`);
```

**Fitxer**: `util/docx/readDocxFromStorage.ts`
```typescript
// Verificar variables d'entorn abans de crear el client
console.log(`[readDocxFromStorage] NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'PRESENT' : 'MISSING'}`);
console.log(`[readDocxFromStorage] SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'PRESENT' : 'MISSING'}`);
```

### 2. Validació Robusta

Ara el worker fallarà immediatament amb missatges clars si les variables d'entorn no estan disponibles:

```typescript
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL no està definida en les variables d\'entorn del worker');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY no està definida en les variables d\'entorn del worker');
}
```

## Pròxims Passos per Solucionar

### 1. Verificar Variables d'Entorn a Vercel (PRIORITAT MÀXIMA)

Anar a [Vercel Dashboard](https://vercel.com/dashboard):
1. Seleccionar projecte `ai-sdk-next-openai`
2. Settings → Environment Variables
3. Verificar que existeixen:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MISTRAL_API_KEY`

### 2. Redeploy Després de Configurar Variables

Després d'afegir les variables d'entorn:
1. Anar a Deployments
2. Fer redeploy de l'última versió
3. Verificar els logs del deployment

### 3. Verificar Logs de Vercel

Després del redeploy, els logs haurien de mostrar:
```
[DocumentProcessor] ✅ Client Supabase del worker creat correctament
[readDocxFromStorage] ✅ Client Supabase creat correctament
```

Si les variables falten, veurem:
```
[DocumentProcessor] NEXT_PUBLIC_SUPABASE_URL: MISSING
[DocumentProcessor] SUPABASE_SERVICE_ROLE_KEY: MISSING
```

## Diagnòstic Esperat

### Si les Variables d'Entorn Falten
```
Error: NEXT_PUBLIC_SUPABASE_URL no està definida en les variables d'entorn del worker
```

### Si les Variables d'Entorn Són Incorrectes
```
[readDocxFromStorage] Error de Supabase Storage en descarregar "path":
  Nom de l'error: StorageApiError
  Missatge: Invalid JWT
  Status: 401
```

### Si Tot Funciona Correctament
```
[DocumentProcessor] ✅ Client Supabase del worker creat correctament
[readDocxFromStorage] ✅ Client Supabase creat correctament
[Worker] ✅ Context del document original obtingut per al job xxx. Longitud: 1234
```

## Variables d'Entorn Requerides

### Per Obtenir de Supabase Dashboard

1. Anar a [Supabase Dashboard](https://app.supabase.com)
2. Seleccionar el projecte
3. Settings → API
4. Copiar:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Per Mistral AI

```bash
MISTRAL_API_KEY=your-mistral-api-key-here
```

## Resultat Esperat

Després de configurar correctament les variables d'entorn:

1. ✅ El worker podrà accedir a Supabase Storage
2. ✅ Els documents es descarregaran correctament
3. ✅ Els jobs es completaran amb èxit
4. ✅ No més error `{}`
5. ✅ Logs clars i informatius

## Notes Importants

- **Les funcions serverless de Vercel** necessiten les variables d'entorn configurades explícitament
- **No hereten** les variables d'entorn del frontend automàticament
- **Cada deployment** necessita que les variables estiguin configurades abans del build
- **El redeploy és obligatori** després de canviar variables d'entorn

## Arquitectura del Sistema

```
Frontend (AsyncJobProgress) ✅ FUNCIONA
    ↓ (polling)
API (/api/reports/jobs-status) ✅ FUNCIONA
    ↓ (consulta BD)
Database (generation_jobs) ✅ FUNCIONA
    ↓ (webhook trigger)
Worker (/api/worker/trigger) ❌ VARIABLES D'ENTORN
    ↓ (DocumentProcessor)
Supabase Storage ❌ NO ACCESSIBLE
```

El problema està aïllat a la comunicació Worker → Supabase Storage per falta de variables d'entorn.
