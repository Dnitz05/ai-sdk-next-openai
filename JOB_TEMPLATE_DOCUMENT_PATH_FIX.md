# Resolució del problema: template_document_path null/undefined

## Problema identificat

**Error**: `[Worker] template_document_path és null o undefined per al job 19c9a134-7e62-4d63-99a3-c1de2ec0e497. No es pot continuar.`

### Causa del problema

El worker (`lib/workers/documentProcessor.ts`) no pot processar jobs perquè el camp `template_document_path` en la configuració del job (`job_config`) és null o undefined. Això succeeix quan la plantilla associada al projecte no té correctament configurats els camps de ruta de documents.

### Ubicació de l'error

- **Fitxer**: `lib/workers/documentProcessor.ts`
- **Línia**: ~44
- **Codi**: 
```typescript
if (!config.template_document_path) {
  throw new Error(`[Worker] template_document_path és null o undefined per al job ${jobId}. No es pot continuar.`);
}
```

### Com es construeix template_document_path

El camp `template_document_path` es construeix a `app/api/reports/generate-async/route.ts` amb aquesta lògica:

```typescript
template_document_path: (project.template.placeholder_docx_storage_path && project.template.placeholder_docx_storage_path.trim() !== '') 
                        ? project.template.placeholder_docx_storage_path 
                        : project.template.base_docx_storage_path,
```

## Solucions implementades

### 1. Eines de diagnòstic

#### Endpoint d'anàlisi general
```
GET /api/debug/analyze-job-issue
```

Proporciona una anàlisi completa del problema amb:
- Descripció del problema
- Causes possibles
- Passos de resolució
- Mesures de prevenció

#### Endpoint d'investigació específica de job
```
GET /api/debug/investigate-job/[jobId]
GET /api/debug/investigate-job/19c9a134-7e62-4d63-99a3-c1de2ec0e497
```

Consulta la base de dades per obtenir:
- Detalls del job
- Configuració de la plantilla associada
- Estat dels camps crítics
- Diagnòstic específic

#### Endpoint de reparació de job
```
GET /api/debug/fix-job-config/[jobId]   # Previsualitzar reparació
POST /api/debug/fix-job-config/[jobId]  # Aplicar reparació
```

Permet:
- Veure què es faria per reparar el job (GET)
- Aplicar efectivament la reparació (POST)

### 2. Millores al codi original

He millorat `app/api/reports/generate-async/route.ts` amb:

#### Validació més robusta
- Priorització clara: placeholder → base → indexed paths
- Validacions estrictes abans de crear jobs
- Logs detallats per debugging
- Errors descriptius per a l'usuari

#### Lògica millorada
```typescript
// Prioritzar placeholder_docx_storage_path si existeix i és vàlid
if (project.template.placeholder_docx_storage_path && project.template.placeholder_docx_storage_path.trim() !== '') {
  templateDocumentPath = project.template.placeholder_docx_storage_path;
} 
// Sinó, usar base_docx_storage_path si existeix i és vàlid
else if (project.template.base_docx_storage_path && project.template.base_docx_storage_path.trim() !== '') {
  templateDocumentPath = project.template.base_docx_storage_path;
}
// Com a últim recurs, intentar indexed_docx_storage_path
else if (project.template.indexed_docx_storage_path && project.template.indexed_docx_storage_path.trim() !== '') {
  templateDocumentPath = project.template.indexed_docx_storage_path;
}
```

## Com resoldre el problema actual

### Opció 1: Usar les eines de debug (Recomanat)

1. **Configurar credencials de Supabase**:
   ```bash
   # Actualitzar .env.local amb credencials reals
   NEXT_PUBLIC_SUPABASE_URL=https://your-real-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-real-service-role-key
   ```

2. **Investigar el job problemàtic**:
   ```bash
   curl -X GET "http://localhost:3000/api/debug/investigate-job/19c9a134-7e62-4d63-99a3-c1de2ec0e497"
   ```

3. **Previsualitzar la reparació**:
   ```bash
   curl -X GET "http://localhost:3000/api/debug/fix-job-config/19c9a134-7e62-4d63-99a3-c1de2ec0e497"
   ```

4. **Aplicar la reparació**:
   ```bash
   curl -X POST "http://localhost:3000/api/debug/fix-job-config/19c9a134-7e62-4d63-99a3-c1de2ec0e497"
   ```

### Opció 2: Reparació manual a la base de dades

Si les credencials de Supabase no estan disponibles:

1. **Consultar el job**:
   ```sql
   SELECT id, job_config, project_id FROM generation_jobs 
   WHERE id = '19c9a134-7e62-4d63-99a3-c1de2ec0e497';
   ```

2. **Consultar la plantilla associada**:
   ```sql
   SELECT p.template_id, pc.placeholder_docx_storage_path, pc.base_docx_storage_path, pc.indexed_docx_storage_path
   FROM projects p 
   JOIN plantilla_configs pc ON p.template_id = pc.id 
   WHERE p.id = '[project_id_del_job]';
   ```

3. **Actualitzar el job_config** amb el template_document_path correcte.

### Opció 3: Regenerar el job

Si la plantilla té rutes vàlides, es pot eliminar el job defectuós i crear-ne un de nou amb la lògica millorada.

## Prevenció de futurs problemes

### 1. Validacions implementades

El codi millorat ara:
- Valida estrictament les rutes abans de crear jobs
- Prioritza clarament les rutes disponibles
- Proporciona errors descriptius
- Registra logs detallats

### 2. Mesures addicionals recomanades

1. **Validació de plantilles**:
   - Assegurar que totes les plantilles tenen almenys una ruta vàlida
   - Implementar validació en crear/editar plantilles

2. **Monitoring millorat**:
   - Afegir alertes per jobs que fallen amb aquest error
   - Dashboard per monitoritzar l'estat de plantilles

3. **Tests automatitzats**:
   - Tests per assegurar que la creació de jobs funciona correctament
   - Tests de validació de plantilles

## Fitxers modificats/creats

### Nous fitxers de debug
- `app/api/debug/analyze-job-issue/route.ts` - Anàlisi general del problema
- `app/api/debug/investigate-job/[jobId]/route.ts` - Investigació específica de job
- `app/api/debug/fix-job-config/[jobId]/route.ts` - Reparació de job

### Fitxers millorats
- `app/api/reports/generate-async/route.ts` - Validacions i lògica millorades

### Documentació
- `JOB_TEMPLATE_DOCUMENT_PATH_FIX.md` - Aquest document

## Status de l'entorn

⚠️ **Important**: Les credencials de Supabase al `.env.local` són valors de placeholder. Per usar les eines de debug, cal configurar credencials reals.

```bash
# Valors actuals (placeholders)
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

Un cop configurades les credencials reals, totes les eines de debug funcionaran correctament.
