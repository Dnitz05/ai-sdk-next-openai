-- Migration: Afegir columnes per indexació automàtica
-- Data: 2025-06-07
-- Descripció: Afegeix columnes per emmagatzemar la ruta del document indexat 
--            i els mappings de paràgrafs amb els seus IDs de SDT

-- Afegir columna per la ruta del document indexat
ALTER TABLE plantilla_configs 
ADD COLUMN IF NOT EXISTS indexed_docx_storage_path text;

-- Afegir columna per els mappings de paràgrafs (array JSON)
ALTER TABLE plantilla_configs 
ADD COLUMN IF NOT EXISTS paragraph_mappings jsonb;

-- Afegir comentaris descriptius
COMMENT ON COLUMN plantilla_configs.indexed_docx_storage_path 
IS 'Ruta dins del bucket template-docx on s''emmagatzema el DOCX indexat amb SDTs aplicats automàticament';

COMMENT ON COLUMN plantilla_configs.paragraph_mappings 
IS 'Array JSON amb els mappings de paràgrafs: [{id: "docproof_pid_xxx", text: "contingut", numericId: 1}, ...]';

-- Verificar que les columnes s'han afegit correctament
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'plantilla_configs' 
  AND column_name IN ('indexed_docx_storage_path', 'paragraph_mappings')
ORDER BY column_name;
