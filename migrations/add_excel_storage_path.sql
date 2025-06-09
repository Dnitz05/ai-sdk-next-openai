-- Migration: Afegir columna excel_storage_path a plantilla_configs
-- Data: 2025-06-09
-- Descripció: Afegeix columna per emmagatzemar la ruta del fitxer Excel original
--            a Supabase Storage per al mòdul de generació d'informes

ALTER TABLE plantilla_configs 
ADD COLUMN excel_storage_path text;

-- Afegir comentari descriptiu per documentar l'ús de la columna
COMMENT ON COLUMN plantilla_configs.excel_storage_path 
IS 'Ruta dins del bucket template-docx on s''emmagatzema el fitxer Excel original (.xlsx/.xls) associat a la plantilla. Utilitzat pel mòdul de generació d''informes per llegir les dades completes de l''Excel i generar informes automàticament.';

-- Verificar que la columna s'ha afegit correctament
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'plantilla_configs' 
  AND column_name = 'excel_storage_path';
