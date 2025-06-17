-- Migració per al Sistema de Processament Asíncron de Documents
-- Soluciona constraint missing i afegeix taula generation_jobs

-- Garanteix que totes les operacions s'executen juntes o cap.
BEGIN;

-- PAS 1: Solucionar el 'constraint' que faltava a la taula existent.
-- Això corregeix l'error 'ON CONFLICT' ('42P10') original i garanteix la integritat de les dades.
ALTER TABLE public.generated_content
ADD CONSTRAINT generated_content_unique_generation_placeholder
UNIQUE (generation_id, placeholder_id);

-- PAS 2: Crear la taula per gestionar les feines de generació, dissenyada per a actualitzacions ràpides.
CREATE TABLE IF NOT EXISTS public.generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generation_id UUID NOT NULL REFERENCES public.generations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- Valors possibles: pending, processing, completed, failed, cancelled
    progress NUMERIC(5, 2) NOT NULL DEFAULT 0.00, -- Emmagatzema el progrés com un percentatge (ex: 95.50) per a la UI.
    total_placeholders INTEGER NOT NULL,
    completed_placeholders INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    final_document_path TEXT, -- Path del document final a Storage
    job_config JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ, -- Per calcular el temps de processament.
    completed_at TIMESTAMPTZ -- Per calcular el temps total.
);

-- Donar permisos i afegir índexs per a un rendiment òptim.
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

-- Política RLS per a generation_jobs
CREATE POLICY "Allow authenticated users to manage their own jobs" ON public.generation_jobs 
FOR ALL TO authenticated 
USING (auth.uid() = user_id);

-- Permisos per a la taula
GRANT ALL ON TABLE public.generation_jobs TO authenticated, service_role;

-- Índexs per rendiment
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status_created_at ON public.generation_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_generation_id ON public.generation_jobs(generation_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_user_id ON public.generation_jobs(user_id);

-- Trigger per actualitzar updated_at (reutilitzem la funció existent)
CREATE TRIGGER update_generation_jobs_updated_at BEFORE UPDATE ON public.generation_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
