-- Script avanzado para solucionar problemas de políticas RLS en Supabase
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Diagnóstico: Verificar el esquema de la tabla y las políticas actuales
SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM 
  information_schema.columns 
WHERE 
  table_name = 'plantilla_configs';

-- Verificar políticas RLS existentes
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual, 
  with_check 
FROM 
  pg_policies 
WHERE 
  tablename = 'plantilla_configs';

-- 2. Asegurar que RLS está habilitado
ALTER TABLE public.plantilla_configs ENABLE ROW LEVEL SECURITY;

-- 3. Eliminar cualquier política problemática existente
DROP POLICY IF EXISTS "users_insert_own" ON public.plantilla_configs;
DROP POLICY IF EXISTS "test_insert" ON public.plantilla_configs;
DROP POLICY IF EXISTS "user_inserts_own_configs" ON public.plantilla_configs;

-- 4. Crear política correcta para INSERT que usa auth.uid()
CREATE POLICY "users_insert_own_quantum_fix" 
  ON public.plantilla_configs 
  FOR INSERT 
  WITH CHECK (
    auth.uid()::text = user_id::text  -- Conversión explícita a texto para evitar problemas de tipo
  );

-- 5. Crear política para SELECT
CREATE POLICY "users_select_own_quantum_fix" 
  ON public.plantilla_configs 
  FOR SELECT 
  USING (
    auth.uid()::text = user_id::text  -- Mismo enfoque que en INSERT
  );

-- 6. Crear política para UPDATE
CREATE POLICY "users_update_own_quantum_fix" 
  ON public.plantilla_configs 
  FOR UPDATE 
  USING (
    auth.uid()::text = user_id::text
  ) 
  WITH CHECK (
    auth.uid()::text = user_id::text
  );

-- 7. Crear política para DELETE
CREATE POLICY "users_delete_own_quantum_fix" 
  ON public.plantilla_configs 
  FOR DELETE 
  USING (
    auth.uid()::text = user_id::text
  );

-- 8. Verificar que las políticas se crearon correctamente
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual, 
  with_check 
FROM 
  pg_policies 
WHERE 
  tablename = 'plantilla_configs';

-- 9. Si aún hay problemas, se puede probar temporalmente con una política permisiva
-- NO USAR EN PRODUCCIÓN - Solo para diagnóstico
-- Descomenta las líneas siguientes solo para pruebas

/*
DROP POLICY IF EXISTS "temp_debug_policy" ON public.plantilla_configs;
CREATE POLICY "temp_debug_policy"
  ON public.plantilla_configs
  FOR ALL
  USING (true)
  WITH CHECK (true);
*/

-- 10. Verificar que las restricciones de clave foránea para user_id están correctas
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM
  information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE
  tc.table_name = 'plantilla_configs'
  AND kcu.column_name = 'user_id';
