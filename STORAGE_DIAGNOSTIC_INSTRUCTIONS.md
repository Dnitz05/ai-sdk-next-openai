# Instruccions per Diagnosticar el Problema de Storage

## Problema Actual
```
Error obtenint el document de context: Error descarregant el document 
"user-2c439ad3-2097-4f17-a1a3-1b4fa8967075/template-e30433b1-e688-4949-aa0f-fc1f2ca6c719/original/original.docx": {}
```

## Diagnòstics Implementats

### 1. Endpoint de Test de Storage
**URL**: `/api/debug/storage-test`

Aquest endpoint permet verificar:
- ✅ Variables d'entorn del worker
- ✅ Connectivitat amb Supabase Storage
- ✅ Existència del bucket 'documents'
- ✅ Llistat de fitxers
- ✅ Test de descàrrega d'un fitxer específic

### 2. Logs Avançats al Worker
Implementats a `util/docx/readDocxFromStorage.ts`:
- Verificació d'existència del fitxer abans de descarregar
- Logs detallats d'errors de Supabase Storage
- Verificació de permisos del bucket

## Com Utilitzar els Diagnòstics

### Pas 1: Test General de Storage
```bash
curl https://ai-sdk-next-openai-94c61ocle-dnitzs-projects.vercel.app/api/debug/storage-test
```

Això et dirà:
- Si les variables d'entorn estan disponibles
- Si el bucket 'documents' existeix
- Quins fitxers hi ha al primer nivell

### Pas 2: Test del Path Específic
```bash
curl "https://ai-sdk-next-openai-94c61ocle-dnitzs-projects.vercel.app/api/debug/storage-test?path=user-2c439ad3-2097-4f17-a1a3-1b4fa8967075/template-e30433b1-e688-4949-aa0f-fc1f2ca6c719/original/original.docx"
```

Això verificarà:
- Si el directori existeix
- Si el fitxer `original.docx` està present
- Si es pot descarregar correctament

### Pas 3: Revisar Logs del Worker
Quan es produeixi l'error, els logs de Vercel haurien de mostrar:
```
[readDocxFromStorage] Verificant variables d'entorn...
[readDocxFromStorage] NEXT_PUBLIC_SUPABASE_URL: PRESENT
[readDocxFromStorage] SUPABASE_SERVICE_ROLE_KEY: PRESENT
[readDocxFromStorage] ✅ Client Supabase creat correctament
[readDocxFromStorage] Verificant si el fitxer existeix...
[readDocxFromStorage] Fitxers trobats al directori: [...]
[readDocxFromStorage] Fitxer "original.docx" existeix: true/false
```

## Possibles Resultats i Solucions

### Resultat 1: Variables d'Entorn Faltants
```json
{
  "success": false,
  "error": "Variables d'entorn faltants",
  "details": {
    "NEXT_PUBLIC_SUPABASE_URL": "MISSING",
    "SUPABASE_SERVICE_ROLE_KEY": "MISSING"
  }
}
```
**Solució**: Configurar variables d'entorn a Vercel i fer redeploy.

### Resultat 2: Bucket 'documents' No Trobat
```json
{
  "success": false,
  "error": "Bucket \"documents\" no trobat",
  "availableBuckets": ["other-bucket"]
}
```
**Solució**: Crear el bucket 'documents' a Supabase Storage.

### Resultat 3: Fitxer No Existeix
```json
{
  "pathTest": {
    "success": true,
    "fileExists": false,
    "filesInDirectory": ["other-file.docx"]
  }
}
```
**Solució**: El fitxer no s'ha pujat correctament o el path és incorrecte.

### Resultat 4: Error de Permisos
```json
{
  "pathTest": {
    "downloadTest": {
      "success": false,
      "error": "Error descarregant fitxer",
      "details": {
        "message": "Unauthorized",
        "status": 401
      }
    }
  }
}
```
**Solució**: Verificar polítiques RLS del bucket 'documents'.

### Resultat 5: Tot Funciona Correctament
```json
{
  "success": true,
  "pathTest": {
    "fileExists": true,
    "downloadTest": {
      "success": true,
      "fileSize": 12345,
      "contentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }
  }
}
```
**Conclusió**: El problema no és de Storage, sinó d'una altra part del codi.

## Pròxims Passos Segons el Resultat

### Si el Test de Storage Funciona
- El problema està en el codi del worker
- Revisar la lògica de `documentProcessor.ts`
- Verificar que el path es construeix correctament

### Si el Test de Storage Falla
- Problema de configuració de Supabase
- Variables d'entorn incorrectes
- Permisos RLS massa restrictius

## Verificació de Polítiques RLS

Si el problema són els permisos, verificar a Supabase Dashboard:
1. Storage → Policies
2. Bucket 'documents'
3. Assegurar-se que la `service_role` té permisos de `SELECT` i `INSERT`

Exemple de política correcta:
```sql
-- Política per service_role
CREATE POLICY "service_role_access" ON storage.objects
FOR ALL USING (auth.role() = 'service_role');
```

## Logs Esperats en Cas d'Èxit

Quan tot funcioni correctament, hauràs de veure:
```
[DocumentProcessor] ✅ Client Supabase del worker creat correctament
[readDocxFromStorage] ✅ Client Supabase creat correctament
[readDocxFromStorage] Fitxer "original.docx" existeix: true
[Worker] ✅ Context del document original obtingut per al job xxx. Longitud: 1234
```

## Contacte per Debugging

Si necessites ajuda interpretant els resultats:
1. Executa els tests de diagnòstic
2. Copia els resultats JSON complets
3. Revisa els logs de Vercel Functions
4. Proporciona aquesta informació per a una anàlisi més profunda
