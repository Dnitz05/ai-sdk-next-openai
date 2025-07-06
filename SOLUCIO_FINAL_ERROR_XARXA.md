# Solució Final per l'Error de Xarxa

## Problema Identificat

L'error `net::ERR_INTERNET_DISCONNECTED` es deu a que **la taula `smart_generations` no existeix** a la base de dades de Supabase.

## Diagnòstic Complet

✅ **Verificat:**
- Service Role Key configurada correctament
- Variables d'entorn disponibles
- Base de dades Supabase operativa
- Taules existents: `plantilla_configs`, `projects`, `generations`, etc.

❌ **Problema:**
- Taula `smart_generations` no existeix
- Supabase no permet execució de SQL arbitrari des del client
- Els endpoints fallen quan intenten accedir a aquesta taula

## Solució: Aplicació Manual de la Migració

### Pas 1: Accedir al Dashboard de Supabase

1. Ves a: **https://supabase.com/dashboard**
2. Inicia sessió amb el teu compte
3. Selecciona el projecte: **`ypunjalpaecspihjeces`**
4. Navega a: **SQL Editor**

### Pas 2: Executar la Migració SQL

Copia i enganxa aquest SQL al **SQL Editor** i executa'l:

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

-- Habilitar RLS (Row Level Security)
ALTER TABLE smart_generations ENABLE ROW LEVEL SECURITY;

-- Crear polítiques RLS per seguretat
CREATE POLICY "Users can view own smart generations" ON smart_generations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create smart generations" ON smart_generations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own smart generations" ON smart_generations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own smart generations" ON smart_generations FOR DELETE USING (auth.uid() = user_id);
```

### Pas 3: Verificar la Migració

Després d'executar el SQL, verifica que funciona:

1. **Comprova que la taula existeix:**
   ```sql
   SELECT COUNT(*) FROM smart_generations;
   ```

2. **Testa l'endpoint de verificació:**
   ```
   GET http://localhost:3000/api/debug/create-smart-table
   ```

### Pas 4: Testejar el Sistema Intel·ligent

Un cop aplicada la migració:

1. **Test del sistema:**
   ```
   GET http://localhost:3000/api/debug/test-smart-system
   ```

2. **Endpoint principal:**
   ```
   POST http://localhost:3000/api/reports/generate-smart
   ```

## Resultat Esperat

Després d'aplicar la migració:

✅ **L'error `net::ERR_INTERNET_DISCONNECTED` desapareixerà**
✅ **La taula `smart_generations` existirà**
✅ **Els endpoints funcionaran correctament**
✅ **El sistema intel·ligent estarà operatiu**

## Endpoints Disponibles Després de la Migració

### Sistema Intel·ligent (NOU)
- `POST /api/reports/generate-smart` - Generar documents intel·ligents
- `GET /api/reports/generate-smart?generationId=uuid` - Estat de generació
- `GET /api/reports/download-smart/[generationId]/[documentIndex]` - Descarregar document
- `GET /api/debug/test-smart-system` - Test del sistema

### Sistema Existent
- `POST /api/reports/jobs-status` - Estat de jobs
- `GET /api/reports/download-document/[generationId]` - Descarregar document tradicional

## Configuració Actual

✅ **Variables d'entorn configurades:**
- `NEXT_PUBLIC_SUPABASE_URL`: https://ypunjalpaecspihjeces.supabase.co
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Configurada
- `SUPABASE_SERVICE_ROLE_KEY`: Configurada

✅ **Endpoints de migració creats:**
- `/api/debug/apply-smart-migration`
- `/api/debug/apply-migration-direct`
- `/api/debug/create-smart-table`

## Resum

**Causa de l'error:** Taula `smart_generations` no existeix
**Solució:** Aplicar migració SQL manualment des del Dashboard de Supabase
**Temps estimat:** 2-3 minuts
**Resultat:** Error de xarxa resolt i sistema intel·ligent operatiu

---

**Data:** 6 de juliol de 2025  
**Estat:** Pendent d'aplicació manual de migració  
**Prioritat:** Alta - Necessari per resoldre l'error de xarxa  
**Arquitecte:** Cline
