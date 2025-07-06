# Pla de Resolució de l'Error de Xarxa

## Problema Identificat

L'error `net::ERR_INTERNET_DISCONNECTED` indica un problema de connectivitat de xarxa, no un problema amb el codi. Això pot ser degut a:

1. **Problemes de connectivitat temporal**
2. **Configuració de xarxa de Vercel**
3. **Taula `smart_generations` no existeix** (causa més probable)

## Estat Actual de la Base de Dades

✅ **Taules existents verificades:**
- `generated_content`
- `generation_jobs` 
- `generations`
- `plantilla_configs`
- `projects`

❌ **Taula faltant:**
- `smart_generations` (necessària pel sistema intel·ligent)

## Solució Immediata

### Pas 1: Aplicar Migració Manualment

Accedeix al **Dashboard de Supabase** i executa aquesta migració SQL:

```sql
-- Crear taula principal per al sistema intel·ligent
CREATE TABLE IF NOT EXISTS smart_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    template_id UUID REFERENCES plantilla_configs(id) ON DELETE SET NULL,
    template_content TEXT NOT NULL,
    excel_data JSONB NOT NULL,
    generated_documents JSONB,
    processing_time INTEGER,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    num_documents INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Crear índexs per optimitzar consultes
CREATE INDEX IF NOT EXISTS idx_smart_generations_user_id ON smart_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_generations_status ON smart_generations(status);
CREATE INDEX IF NOT EXISTS idx_smart_generations_created_at ON smart_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smart_generations_template_id ON smart_generations(template_id) WHERE template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_smart_generations_user_status_created ON smart_generations(user_id, status, created_at DESC);

-- Habilitar RLS
ALTER TABLE smart_generations ENABLE ROW LEVEL SECURITY;

-- Crear polítiques RLS
CREATE POLICY "Users can view own smart generations" ON smart_generations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create smart generations" ON smart_generations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own smart generations" ON smart_generations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own smart generations" ON smart_generations FOR DELETE USING (auth.uid() = user_id);
```

### Pas 2: Verificar la Migració

Després d'aplicar la migració, verifica que funciona accedint a:

```
https://ai-sdk-next-openai-94c61ocle-dnitzs-projects.vercel.app/api/debug/test-smart-system
```

### Pas 3: Testejar el Sistema Intel·ligent

Un cop la taula estigui creada, pots utilitzar:

1. **Endpoint principal:**
   ```
   POST /api/reports/generate-smart
   ```

2. **Endpoint de test:**
   ```
   GET /api/debug/test-smart-system
   ```

3. **Endpoint de descàrrega:**
   ```
   GET /api/reports/download-smart/[generationId]/[documentIndex]
   ```

## Instruccions per Accedir al Dashboard de Supabase

1. Ves a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Inicia sessió amb el teu compte
3. Selecciona el projecte: `ypunjalpaecspihjeces`
4. Ves a **SQL Editor**
5. Enganxa la migració SQL de dalt
6. Executa la consulta

## Verificació Post-Migració

Després d'aplicar la migració, comprova que:

1. ✅ La taula `smart_generations` existeix
2. ✅ Els índexs s'han creat correctament
3. ✅ Les polítiques RLS estan actives
4. ✅ L'endpoint de test retorna èxit

## Endpoints Disponibles Després de la Migració

### Sistema Intel·ligent (NOU)
- `POST /api/reports/generate-smart` - Generar documents intel·ligents
- `GET /api/reports/generate-smart?generationId=uuid` - Estat de generació
- `GET /api/reports/download-smart/[generationId]/[documentIndex]` - Descarregar document
- `GET /api/debug/test-smart-system` - Test del sistema

### Sistema Existent
- `POST /api/reports/jobs-status` - Estat de jobs
- `GET /api/reports/download-document/[generationId]` - Descarregar document tradicional

## Resolució de l'Error de Xarxa

L'error `net::ERR_INTERNET_DISCONNECTED` es resoldrà automàticament quan:

1. ✅ La taula `smart_generations` existeixi
2. ✅ Els endpoints puguin accedir a la base de dades
3. ✅ No hi hagi errors de SQL per taules inexistents

## Monitorització

Després de la migració, monitora:

1. **Logs de Vercel** per errors de base de dades
2. **Dashboard de Supabase** per consultes fallides
3. **Endpoints de debug** per verificar funcionalitat

---

**Data:** 6 de juliol de 2025  
**Estat:** Pendent d'aplicació manual de migració  
**Prioritat:** Alta - Necessari per resoldre l'error de xarxa
