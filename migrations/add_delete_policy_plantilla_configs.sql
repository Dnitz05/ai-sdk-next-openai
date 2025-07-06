-- Afegir política RLS per DELETE a plantilla_configs
-- Aquesta política permet als usuaris eliminar només les seves pròpies plantilles

CREATE POLICY "user_deletes_own_configs" 
ON "public"."plantilla_configs" 
AS PERMISSIVE 
FOR DELETE 
TO public 
USING (user_id = auth.uid());

-- També afegir política per UPDATE si no existeix
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'plantilla_configs' 
        AND cmd = 'UPDATE'
    ) THEN
        CREATE POLICY "user_updates_own_configs" 
        ON "public"."plantilla_configs" 
        AS PERMISSIVE 
        FOR UPDATE 
        TO public 
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());
    END IF;
END $$;
