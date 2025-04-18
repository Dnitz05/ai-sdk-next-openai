-- Script per solucionar el problema de política RLS
-- Executa aquest script al SQL Editor de Supabase

-- Assegurar que RLS està activat
alter table public.plantilla_configs enable row level security;

-- Eliminar política anterior si existeix
drop policy if exists test_insert on public.plantilla_configs;

-- Crear una política temporal que permeti totes les insercions
-- NOTA: Això és només temporal per verificar si el problema és realment amb RLS
create policy test_insert
  on public.plantilla_configs
  for insert
  with check (true);

-- Un cop hagis verificat que la inserció funciona, canvia la política a:
/*
drop policy if exists user_inserts_own_configs on public.plantilla_configs;
create policy user_inserts_own_configs
  on public.plantilla_configs
  for insert
  with check (user_id = auth.uid());
*/
