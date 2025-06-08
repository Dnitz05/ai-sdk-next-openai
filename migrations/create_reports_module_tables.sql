-- Migració per al Mòdul de Generació d'Informes
-- Crea les taules necessàries per a la gestió de projectes i generació de contingut

-- Taula per agrupar les generacions en "Projectes" o "Carpetes"
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES plantilla_configs(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    excel_filename TEXT NOT NULL,
    excel_data JSONB, -- Dades processades de l'Excel
    total_rows INTEGER, -- Nombre total de files a l'Excel
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Taula per registrar l'estat de cada informe individual (fila de l'Excel)
CREATE TABLE IF NOT EXISTS generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    excel_row_index INTEGER NOT NULL,
    row_data JSONB, -- Dades específiques de la fila
    status TEXT NOT NULL DEFAULT 'pending', -- Valors: pending, generated, reviewed, completed, error
    error_message TEXT, -- Missatge d'error si la generació falla
    retry_count INTEGER DEFAULT 0, -- Comptador de reintempts
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, excel_row_index) -- No es pot repetir la mateixa fila al mateix projecte
);

-- Taula per emmagatzemar el text final generat per la IA per a cada paràgraf
CREATE TABLE IF NOT EXISTS generated_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
    placeholder_id TEXT NOT NULL, -- Correspon al 'paragraphId' del placeholder
    final_content TEXT,
    is_refined BOOLEAN DEFAULT FALSE, -- Indica si el contingut ha estat refinat
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activar Row Level Security (RLS) per a totes les taules
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;

-- Polítiques RLS per a la taula projects
CREATE POLICY "Users can only access their own projects" ON projects
FOR ALL USING (auth.uid() = user_id);

-- Polítiques RLS per a la taula generations
CREATE POLICY "Users can only access generations from their projects" ON generations
FOR ALL USING (
    project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
    )
);

-- Polítiques RLS per a la taula generated_content
CREATE POLICY "Users can only access their generated content" ON generated_content
FOR ALL USING (
    generation_id IN (
        SELECT g.id FROM generations g
        JOIN projects p ON g.project_id = p.id
        WHERE p.user_id = auth.uid()
    )
);

-- Índexs per millorar el rendiment
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_template_id ON projects(template_id);
CREATE INDEX IF NOT EXISTS idx_generations_project_id ON generations(project_id);
CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);
CREATE INDEX IF NOT EXISTS idx_generated_content_generation_id ON generated_content(generation_id);
CREATE INDEX IF NOT EXISTS idx_generated_content_placeholder_id ON generated_content(placeholder_id);

-- Triggers per actualitzar automàticament el camp updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generations_updated_at BEFORE UPDATE ON generations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generated_content_updated_at BEFORE UPDATE ON generated_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
