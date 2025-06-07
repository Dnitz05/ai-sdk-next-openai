-- Migration: Afegir columna placeholder_docx_storage_path a plantilla_configs
-- Data: 2025-06-07
-- Descripció: Afegeix columna específica per emmagatzemar la ruta del document placeholder
--            per diferenciar-la clarament del document original (base_docx_storage_path)

ALTER TABLE plantilla_configs 
ADD COLUMN placeholder_docx_storage_path text;

-- Afegir comentari descriptiu per documentar l'ús de la columna
COMMENT ON COLUMN plantilla_configs.placeholder_docx_storage_path 
IS 'Ruta dins del bucket template-docx on s''emmagatzema el DOCX placeholder amb placeholders aplicats. Generat a partir del document original amb les substitucions de linkMappings i aiInstructions aplicades.';

-- Verificar que la columna s'ha afegit correctament
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'plantilla_configs' 
  AND column_name = 'placeholder_docx_storage_path';
