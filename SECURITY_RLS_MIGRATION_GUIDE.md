# Guia de Migració de Seguretat: Implementació Completa de RLS

## Resum Executiu

Aquesta migració resol el **risc de seguretat més crític** del projecte: la dependència de la `service_role_key` per accedir a les dades, que bypassa tots els controls d'autorització.

### Què fa aquesta migració:

✅ **Activa Row-Level Security (RLS)** a totes les taules principals  
✅ **Crea polítiques completes** per a SELECT, INSERT, UPDATE i DELETE  
✅ **Garanteix que cada usuari només pot accedir a les seves dades**  
✅ **Prepara el terreny** per eliminar la `service_role_key` del codi  

## Fitxers Afectats

- **Nova migració:** `migrations/add_full_rls_policies.sql`
- **Taules protegides:** `plantilla_configs`, `projects`, `generations`, `generation_jobs`, `smart_generations`

## Com Aplicar la Migració

### Opció 1: Via Supabase Dashboard (Recomanat)
1. Obre el teu projecte a [Supabase Dashboard](https://app.supabase.com)
2. Ves a **Database** > **SQL Editor**
3. Copia i enganxa tot el contingut de `migrations/add_full_rls_policies.sql`
4. Executa la consulta (botó "Run")
5. Verifica que veges els missatges de confirmació a la pestanya "Results"

### Opció 2: Via CLI de Supabase
```bash
# Si tens el CLI de Supabase instal·lat
supabase db push

# O aplicar la migració específica
supabase db reset --linked
```

### Opció 3: Via psql (Avançat)
```bash
psql -h db.<project-ref>.supabase.co -U postgres -d postgres < migrations/add_full_rls_policies.sql
```

## Verificació Post-Migració

### 1. Comprovar que les Polítiques s'han Creat
Executa aquesta consulta a Supabase per verificar:

```sql
SELECT 
  tablename, 
  policyname, 
  cmd as operation,
  CASE WHEN cmd = 'SELECT' THEN qual ELSE with_check END as policy_rule
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('plantilla_configs', 'projects', 'generations', 'generation_jobs', 'smart_generations')
ORDER BY tablename, cmd, policyname;
```

**Resultat esperat:** Has de veure almenys 16 polítiques (4 per cada taula principal).

### 2. Comprovar que RLS està Activat
```sql
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('plantilla_configs', 'projects', 'generations', 'generation_jobs', 'smart_generations')
ORDER BY tablename;
```

**Resultat esperat:** La columna `rls_enabled` ha de ser `true` per a totes les taules.

## ⚠️ Impacte Potencial

### Què pot trencar-se:
- **Endpoints que utilitzen `service_role_key`** deixaran de funcionar correctament
- **Consultes sense context d'usuari** retornaran resultats buits
- **Tests automatitzats** que no simulin un usuari autenticat fallaran

### Senyals d'alarma a vigilar:
- Errors `new row violates row-level security policy` a Supabase logs
- Usuaris que veuen llistes buides en lloc de les seves dades
- Endpoints que retornen error 500 en lloc de 403

## Pla de Rollback d'Emergència

Si alguna cosa va malament, pots revertir la migració:

```sql
-- NOMÉS EN CAS D'EMERGÈNCIA
-- Deshabilitar RLS temporalment (NO recomanat per producció)

ALTER TABLE public.plantilla_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_generations DISABLE ROW LEVEL SECURITY;
```

**IMPORTANT:** Això torna al estat insegur anterior. Només usar en casos extrems.

## Següents Passos (Post-Migració)

### Pas 1: Actualitzar el Backend (CRÍTIC)
Ara que RLS està actiu, has de refactoritzar els endpoints per utilitzar el client estàndard de Supabase en lloc de la `service_role_key`.

**Exemple de refactorització:**

**❌ ABANS (Insegur):**
```typescript
const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const { data } = await serviceClient
  .from('projects')
  .select('*')
  .eq('user_id', userId); // Hem de recordar fer aquest filtre!
```

**✅ DESPRÉS (Segur):**
```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server';

const supabase = await createServerSupabaseClient();
const { data } = await supabase
  .from('projects')
  .select('*'); // RLS fa el filtratge automàticament!
```

### Pas 2: Testing Immediat
- Testeja la funcionalitat principal: crear projectes, veure llistes, generar documents
- Verifica que cada usuari només veu les seves dades
- Comprova que els logs de Supabase no mostren errors relacionats amb RLS

### Pas 3: Protecció dels Endpoints de Debug
Implementa la **Tasca 1.3** del pla: protegir `/api/debug/*` en producció.

## FAQ

### P: Per què no puc veure les meves dades després de la migració?
**R:** Probablement l'endpoint encara utilitza la `service_role_key`. Refactoritza'l per utilitzar el client estàndard.

### P: Com sé si un endpoint utilitzava la clau de servei?
**R:** Cerca a l'endpoint: `SUPABASE_SERVICE_ROLE_KEY` o `createClient(..., process.env.SUPABASE_SERVICE_ROLE_KEY`.

### P: Puc aplicar aquesta migració en producció directament?
**R:** És recomanable testejar-la primer en un entorn de desenvolupament/staging. Les polítiques utilitzen `IF NOT EXISTS`, així que és segura de re-executar.

### P: Què passa amb els workers o jobs que s'executen en segon pla?
**R:** Hauran de ser refactoritzats per utilitzar un context d'usuari específic o es definiran polítiques especials per a ells.

## Checklist Final

- [ ] Migració aplicada sense errors
- [ ] Verificades les polítiques a la base de dades
- [ ] Testejada la funcionalitat principal de l'aplicació
- [ ] Identificats els endpoints que necessiten refactorització
- [ ] Planificada la refactorització del backend
- [ ] Documentat qualsevol comportament inesperat

---

## Notes Tècniques

### Arquitectura de Seguretat Implementada

Aquesta migració implementa un model de seguretat **multi-tenant** on:

1. **Cada usuari és un "tenant" separat**
2. **La base de dades garanteix l'aïllament** (no el codi de l'aplicació)
3. **Les polítiques utilitzen `auth.uid()`** per identificar l'usuari actual
4. **Les relacions entre taules es respecten** (ex: generations → projects → user)

### Rendiment de les Polítiques RLS

Les polítiques implementades estan optimitzades per rendiment:
- Utilitzen índexs existents (`user_id`, `project_id`)
- Eviten consultes costoses quan és possible
- Es beneficien del cache de consultes de PostgreSQL

Si detectes problemes de rendiment, contacta amb l'equip per optimitzar consultes específiques.

---

**Data de creació:** 2025-01-10  
**Versió:** 1.0  
**Autor:** Auditoria Tècnica Automatitzada
