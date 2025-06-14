# Solució per l'Error "column plantilla_configs.excel_storage_path does not exist"

## Problema Identificat
L'API `/api/reports/template-excel-info/[templateId]` estava fallant perquè intentava accedir a columnes que no existien a la taula `plantilla_configs`:
- `excel_storage_path` 
- `excel_file_name`

## Solució Implementada

### 1. Migració Creada
He creat el fitxer `migrations/add_excel_columns_complete.sql` que afegeix ambdues columnes de manera segura.

### 2. Passos per Aplicar la Migració

#### Opció A: Via Supabase Dashboard (Recomanat)
1. Accedeix al teu projecte Supabase
2. Ves a la secció "SQL Editor"
3. Copia i enganxa tot el contingut de `migrations/add_excel_columns_complete.sql`
4. Executa la consulta
5. Verifica que veus els missatges de confirmació

#### Opció B: Via CLI de Supabase
```bash
# Assegura't que tens les credencials configurades a .env.local
supabase db push
```

#### Opció C: Via psql (si tens accés directe)
```bash
psql "your-supabase-connection-string" -f migrations/add_excel_columns_complete.sql
```

### 3. Configuració d'Entorn Requerida
Abans d'executar la migració, assegura't que tens configurades les variables reals a `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-real-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-real-service-role-key
```

### 4. Verificació de la Solució

#### Comprovar columnes afegides
Executa aquesta consulta per verificar que les columnes existeixen:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'plantilla_configs' 
  AND column_name IN ('excel_storage_path', 'excel_file_name')
ORDER BY column_name;
```

Hauries de veure dues files amb les columnes afegides.

#### Provar l'API
1. Assegura't que el servidor Next.js està executant-se:
   ```bash
   npm run dev
   ```

2. Prova l'endpoint que abans fallava:
   ```bash
   curl -X GET "http://localhost:3000/api/reports/template-excel-info/a71f6910-3e1e-4020-8d2f-bae57c5c15ba" \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
   ```

3. O simplement navega a la interfície web i prova la funcionalitat d'informes.

### 5. Resultats Esperats

Després d'aplicar la migració:
- ✅ L'error "column plantilla_configs.excel_storage_path does not exist" desapareixerà
- ✅ L'API respondrà correctament amb `{ hasExcel: false }` per plantilles sense Excel
- ✅ L'API funcionarà correctament per plantilles amb Excel associat

### 6. Funcionalitat Relacionada

Aquestes columnes són necessàries per:
- Emmagatzemar la ruta del fitxer Excel a Supabase Storage (`excel_storage_path`)
- Guardar el nom original del fitxer Excel (`excel_file_name`)
- Generar informes automàtics basats en dades Excel
- Mostrar informació de plantilles amb Excel associat

### 7. Arxius Modificats/Creats
- `migrations/add_excel_columns_complete.sql` (nou)
- `MIGRATION_INSTRUCTIONS.md` (aquest arxiu)

## Troubleshooting

### Si la migració falla:
1. Verifica que tens permisos d'administrador a Supabase
2. Comprova que la taula `plantilla_configs` existeix
3. Revisa els logs de Supabase per errors específics

### Si l'API encara falla:
1. Reinicia el servidor Next.js
2. Verifica que les variables d'entorn són correctes
3. Comprova els logs del servidor per altres errors

### Per revertir la migració (si és necessari):
```sql
ALTER TABLE plantilla_configs DROP COLUMN IF EXISTS excel_storage_path;
ALTER TABLE plantilla_configs DROP COLUMN IF EXISTS excel_file_name;
