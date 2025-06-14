-- Migration: Afegir columna excel_headers a plantilla_configs
-- Data: 2025-06-14
-- Descripció: Afegeix la columna excel_headers per emmagatzemar les capçaleres 
--            de l'Excel processades i poder mostrar-les al TemplateEditor

-- Afegir columna excel_headers si no existeix
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plantilla_configs' 
        AND column_name = 'excel_headers'
    ) THEN
        ALTER TABLE plantilla_configs 
        ADD COLUMN excel_headers jsonb;
        
        COMMENT ON COLUMN plantilla_configs.excel_headers 
        IS 'Array JSON amb les capçaleres de l''Excel (primera fila del fitxer). Utilitzat per mostrar les opcions disponibles per vincular al text del document i per generar informes automatitzats.';
        
        RAISE NOTICE 'Columna excel_headers afegida a plantilla_configs';
    ELSE
        RAISE NOTICE 'Columna excel_headers ja existeix a plantilla_configs';
    END IF;
END $$;

-- Verificar que la columna s'ha afegit correctament
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'plantilla_configs' 
  AND column_name = 'excel_headers';

-- Mostrar estat actual de les columnes Excel a plantilla_configs
SELECT 
    'plantilla_configs' as table_name,
    STRING_AGG(column_name, ', ' ORDER BY ordinal_position) as excel_columns
FROM information_schema.columns 
WHERE table_name = 'plantilla_configs'
  AND column_name LIKE '%excel%'
GROUP BY table_name;
