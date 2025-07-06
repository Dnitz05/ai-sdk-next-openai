-- Migració: Crear taula smart_generations per al nou sistema de generació intel·ligent
-- Data: 6 de juliol de 2025
-- Objectiu: Substituir el sistema complex de generation_jobs + generated_content per una taula simple

CREATE TABLE smart_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Configuració simple
  template_id UUID REFERENCES plantilla_configs(id) ON DELETE SET NULL,
  template_content TEXT NOT NULL,  -- Document complet amb placeholders intel·ligents
  excel_data JSONB NOT NULL,       -- Totes les dades d'entrada (array d'objectes)
  
  -- Resultats
  generated_documents JSONB,       -- Array amb els documents finals generats
  processing_time INTEGER,         -- Temps de processament en millisegons
  
  -- Estat simple (només 4 estats possibles)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  
  -- Metadades
  num_documents INTEGER NOT NULL DEFAULT 0, -- Nombre de documents a generar
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Índexs per rendiment
CREATE INDEX idx_smart_generations_user_id ON smart_generations(user_id);
CREATE INDEX idx_smart_generations_status ON smart_generations(status);
CREATE INDEX idx_smart_generations_template_id ON smart_generations(template_id);
CREATE INDEX idx_smart_generations_created_at ON smart_generations(created_at DESC);

-- RLS (Row Level Security) per seguretat
ALTER TABLE smart_generations ENABLE ROW LEVEL SECURITY;

-- Política: Els usuaris només poden veure les seves pròpies generacions
CREATE POLICY "Users can view own smart generations" ON smart_generations
  FOR SELECT USING (auth.uid() = user_id);

-- Política: Els usuaris poden crear noves generacions
CREATE POLICY "Users can create smart generations" ON smart_generations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política: Els usuaris poden actualitzar les seves pròpies generacions
CREATE POLICY "Users can update own smart generations" ON smart_generations
  FOR UPDATE USING (auth.uid() = user_id);

-- Política: Els usuaris poden eliminar les seves pròpies generacions
CREATE POLICY "Users can delete own smart generations" ON smart_generations
  FOR DELETE USING (auth.uid() = user_id);

-- Comentaris per documentació
COMMENT ON TABLE smart_generations IS 'Taula simplificada per al nou sistema de generació intel·ligent d''informes';
COMMENT ON COLUMN smart_generations.template_content IS 'Document plantilla amb placeholders intel·ligents format {ID: instrucció}';
COMMENT ON COLUMN smart_generations.excel_data IS 'Array JSON amb totes les files de dades Excel a processar';
COMMENT ON COLUMN smart_generations.generated_documents IS 'Array JSON amb els paths dels documents finals generats';
COMMENT ON COLUMN smart_generations.processing_time IS 'Temps total de processament en millisegons per mètriques de rendiment';
