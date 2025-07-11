-- =============================================================================
-- MIGRACIÓ: IMPLEMENTACIÓ COMPLETA DE POLÍTIQUES RLS
-- Objectiu: Garantir que totes les taules principals tenen polítiques RLS 
-- completes per a SELECT, INSERT, UPDATE i DELETE
-- 
-- Aquesta migració implementa el principi de seguretat per defecte: 
-- cap usuari pot accedir a dades que no són seves
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TAULA: plantilla_configs
-- Descripció: Configuracions de plantilles que pertanyen a usuaris específics
-- -----------------------------------------------------------------------------

-- Activar RLS si no està activat
ALTER TABLE public.plantilla_configs ENABLE ROW LEVEL SECURITY;

-- Política SELECT: Un usuari pot veure les seves pròpies plantilles
CREATE POLICY IF NOT EXISTS "user_selects_own_plantilla_configs"
ON public.plantilla_configs FOR SELECT
USING (auth.uid() = user_id);

-- Política INSERT: Un usuari pot crear plantilles per a si mateix
CREATE POLICY IF NOT EXISTS "user_inserts_own_plantilla_configs"
ON public.plantilla_configs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política UPDATE: Un usuari pot actualitzar les seves pròpies plantilles
-- NOTA: La política existent "user_updates_own_configs" es mantindrà si existeix
DROP POLICY IF EXISTS "user_updates_own_configs" ON public.plantilla_configs;
CREATE POLICY "user_updates_own_plantilla_configs"
ON public.plantilla_configs FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política DELETE: Un usuari pot esborrar les seves pròpies plantilles
-- NOTA: La política existent "user_deletes_own_configs" es mantindrà si existeix
DROP POLICY IF EXISTS "user_deletes_own_configs" ON public.plantilla_configs;
CREATE POLICY "user_deletes_own_plantilla_configs"
ON public.plantilla_configs FOR DELETE
USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- TAULA: projects
-- Descripció: Projectes que contenen instàncies de plantilles per usuaris
-- -----------------------------------------------------------------------------

-- Activar RLS si no està activat
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Política SELECT: Un usuari pot veure els seus propis projectes
CREATE POLICY IF NOT EXISTS "user_selects_own_projects"
ON public.projects FOR SELECT
USING (auth.uid() = user_id);

-- Política INSERT: Un usuari pot crear projectes per a si mateix
CREATE POLICY IF NOT EXISTS "user_inserts_own_projects"
ON public.projects FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política UPDATE: Un usuari pot actualitzar els seus propis projectes
CREATE POLICY IF NOT EXISTS "user_updates_own_projects"
ON public.projects FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política DELETE: Un usuari pot esborrar els seus propis projectes
CREATE POLICY IF NOT EXISTS "user_deletes_own_projects"
ON public.projects FOR DELETE
USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- TAULA: generations
-- Descripció: Documents individuals generats dins d'un projecte
-- -----------------------------------------------------------------------------

-- Activar RLS si no està activat
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- Política SELECT: Un usuari pot veure les generacions dels seus projectes
-- NOTA: Utilitzem una subconsulta per verificar que el projecte pertany a l'usuari
CREATE POLICY IF NOT EXISTS "user_selects_own_generations"
ON public.generations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = generations.project_id 
    AND projects.user_id = auth.uid()
  )
);

-- Política INSERT: Un usuari pot crear generacions per als seus projectes
CREATE POLICY IF NOT EXISTS "user_inserts_own_generations"
ON public.generations FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = generations.project_id 
    AND projects.user_id = auth.uid()
  )
);

-- Política UPDATE: Un usuari pot actualitzar generacions dels seus projectes
CREATE POLICY IF NOT EXISTS "user_updates_own_generations"
ON public.generations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = generations.project_id 
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = generations.project_id 
    AND projects.user_id = auth.uid()
  )
);

-- Política DELETE: Un usuari pot esborrar generacions dels seus projectes
CREATE POLICY IF NOT EXISTS "user_deletes_own_generations"
ON public.generations FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = generations.project_id 
    AND projects.user_id = auth.uid()
  )
);

-- -----------------------------------------------------------------------------
-- TAULA: generation_jobs
-- Descripció: Jobs asíncrons per a la generació de documents
-- -----------------------------------------------------------------------------

-- Activar RLS si no està activat
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

-- Política SELECT: Un usuari pot veure els jobs dels seus projectes
-- NOTA: El projecte_id està dins del camp JSON job_config
CREATE POLICY IF NOT EXISTS "user_selects_own_generation_jobs"
ON public.generation_jobs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = (generation_jobs.job_config->>'project_id')::uuid
    AND projects.user_id = auth.uid()
  )
);

-- Política INSERT: Un usuari pot crear jobs per als seus projectes
CREATE POLICY IF NOT EXISTS "user_inserts_own_generation_jobs"
ON public.generation_jobs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = (generation_jobs.job_config->>'project_id')::uuid
    AND projects.user_id = auth.uid()
  )
);

-- Política UPDATE: Un usuari pot actualitzar jobs dels seus projectes
CREATE POLICY IF NOT EXISTS "user_updates_own_generation_jobs"
ON public.generation_jobs FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = (generation_jobs.job_config->>'project_id')::uuid
    AND projects.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = (generation_jobs.job_config->>'project_id')::uuid
    AND projects.user_id = auth.uid()
  )
);

-- Política DELETE: Un usuari pot cancel·lar jobs dels seus projectes
CREATE POLICY IF NOT EXISTS "user_deletes_own_generation_jobs"
ON public.generation_jobs FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = (generation_jobs.job_config->>'project_id')::uuid
    AND projects.user_id = auth.uid()
  )
);

-- -----------------------------------------------------------------------------
-- TAULA: smart_generations (si existeix)
-- Descripció: Generacions intel·ligents amb IA
-- -----------------------------------------------------------------------------

-- Verificar si la taula existeix abans d'aplicar polítiques
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'smart_generations') THEN
    
    -- Activar RLS
    ALTER TABLE public.smart_generations ENABLE ROW LEVEL SECURITY;
    
    -- Política SELECT: Un usuari pot veure les seves smart generations
    CREATE POLICY IF NOT EXISTS "user_selects_own_smart_generations"
    ON public.smart_generations FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.projects 
        WHERE projects.id = smart_generations.project_id 
        AND projects.user_id = auth.uid()
      )
    );
    
    -- Política INSERT: Un usuari pot crear smart generations per als seus projectes
    CREATE POLICY IF NOT EXISTS "user_inserts_own_smart_generations"
    ON public.smart_generations FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.projects 
        WHERE projects.id = smart_generations.project_id 
        AND projects.user_id = auth.uid()
      )
    );
    
    -- Política UPDATE: Un usuari pot actualitzar les seves smart generations
    CREATE POLICY IF NOT EXISTS "user_updates_own_smart_generations"
    ON public.smart_generations FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.projects 
        WHERE projects.id = smart_generations.project_id 
        AND projects.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.projects 
        WHERE projects.id = smart_generations.project_id 
        AND projects.user_id = auth.uid()
      )
    );
    
    -- Política DELETE: Un usuari pot esborrar les seves smart generations
    CREATE POLICY IF NOT EXISTS "user_deletes_own_smart_generations"
    ON public.smart_generations FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM public.projects 
        WHERE projects.id = smart_generations.project_id 
        AND projects.user_id = auth.uid()
      )
    );
    
    RAISE NOTICE 'Polítiques RLS aplicades a smart_generations';
  ELSE
    RAISE NOTICE 'Taula smart_generations no existeix, saltant polítiques';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- VERIFICACIÓ I DIAGNÒSTIC
-- -----------------------------------------------------------------------------

-- Mostrar totes les polítiques creades per verificar
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  RAISE NOTICE '=== RESUM DE POLÍTIQUES RLS APLICADES ===';
  
  FOR policy_record IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('plantilla_configs', 'projects', 'generations', 'generation_jobs', 'smart_generations')
    ORDER BY tablename, cmd, policyname
  LOOP
    RAISE NOTICE 'Taula: % | Política: % | Operació: %', 
      policy_record.tablename, 
      policy_record.policyname, 
      policy_record.cmd;
  END LOOP;
  
  RAISE NOTICE '=== FI DEL RESUM ===';
END $$;

-- Verificar que RLS està activat per a totes les taules
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('plantilla_configs', 'projects', 'generations', 'generation_jobs', 'smart_generations')
ORDER BY tablename;

-- =============================================================================
-- IMPORTANT: INSTRUCCIONS POST-MIGRACIÓ
-- =============================================================================
-- 
-- Després d'executar aquesta migració:
-- 
-- 1. VERIFICAR que totes les polítiques s'han creat correctament executant:
--    SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
-- 
-- 2. TESTEJAR que les polítiques funcionen:
--    - Intentar accedir a dades amb un usuari autenticat (hauria de funcionar)
--    - Intentar accedir a dades sense autenticació (hauria de fallar)
-- 
-- 3. REFACTORITZAR els endpoints de l'API per eliminar l'ús de service_role_key
--    i utilitzar el client estàndard de Supabase
-- 
-- 4. MONITORITZAR els logs de Supabase per detectar possibles consultes que fallin
--    després del canvi
-- 
-- =============================================================================
