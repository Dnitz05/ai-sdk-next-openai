-- Migration: Afegir columnes completes per Excel a plantilla_configs
-- Data: 2025-06-11
-- Descripció: Afegeix les columnes necessàries per emmagatzemar informació
--            dels fitxers Excel associats a les plantilles

-- Afegir columna excel_storage_path si no existeix
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plantilla_configs' 
        AND column_name = 'excel_storage_path'
    ) THEN
        ALTER TABLE plantilla_configs 
        ADD COLUMN excel_storage_path text;
        
        COMMENT ON COLUMN plantilla_configs.excel_storage_path 
        IS 'Ruta dins del bucket template-docx on s''emmagatzema el fitxer Excel original (.xlsx/.xls) associat a la plantilla. Utilitzat pel mòdul de generació d''informes per llegir les dades completes de l''Excel i generar informes automàticament.';
        
        RAISE NOTICE 'Columna excel_storage_path afegida a plantilla_configs';
    ELSE
        RAISE NOTICE 'Columna excel_storage_path ja existeix a plantilla_configs';
    END IF;
END $$;

-- Afegir columna excel_file_name si no existeix
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plantilla_configs' 
        AND column_name = 'excel_file_name'
    ) THEN
        ALTER TABLE plantilla_configs 
        ADD COLUMN excel_file_name text;
        
        COMMENT ON COLUMN plantilla_configs.excel_file_name 
        IS 'Nom original del fitxer Excel pujat per l''usuari. Utilitzat per mostrar informació descriptiva i per a la gestió de fitxers.';
        
        RAISE NOTICE 'Columna excel_file_name afegida a plantilla_configs';
    ELSE
        RAISE NOTICE 'Columna excel_file_name ja existeix a plantilla_configs';
    END IF;
END $$;

-- Verificar que les columnes s'han afegit correctament
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'plantilla_configs' 
  AND column_name IN ('excel_storage_path', 'excel_file_name')
ORDER BY column_name;

-- Mostrar estat actual de la taula plantilla_configs
SELECT 
    'plantilla_configs' as table_name,
    COUNT(*) as total_columns,
    STRING_AGG(column_name, ', ' ORDER BY ordinal_position) as all_columns
FROM information_schema.columns 
WHERE table_name = 'plantilla_configs'
GROUP BY table_name;
