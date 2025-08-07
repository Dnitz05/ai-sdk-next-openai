-- Migració: Afegir columnes per al sistema de migració de plantilles
-- Data: 7 d'agost de 2025
-- Objectiu: Suportar el sistema de migració legacy → simple

-- Afegir columnes per tracking de migració
ALTER TABLE plantilla_configs 
ADD COLUMN IF NOT EXISTS template_format VARCHAR(20) DEFAULT 'legacy',
ADD COLUMN IF NOT EXISTS legacy_placeholder_path TEXT,
ADD COLUMN IF NOT EXISTS migration_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS migration_stats JSONB;

-- Crear índex per optimitzar consultes de migració
CREATE INDEX IF NOT EXISTS idx_plantilla_configs_template_format 
ON plantilla_configs(template_format);

-- Comentaris per documentació
COMMENT ON COLUMN plantilla_configs.template_format IS 'Format de la plantilla: legacy, simple';
COMMENT ON COLUMN plantilla_configs.legacy_placeholder_path IS 'Path original abans de la migració';
COMMENT ON COLUMN plantilla_configs.migration_date IS 'Data de migració al format simple';
COMMENT ON COLUMN plantilla_configs.migration_stats IS 'Estadístiques de la migració (JSON)';
