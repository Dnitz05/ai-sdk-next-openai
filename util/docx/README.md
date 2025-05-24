# Sistema d'Indexació i Verificació de Documents DOCX

Aquest directori conté les utilitats per a la indexació de documents DOCX amb Structure Document Tags (SDTs) i la posterior generació de placeholders basats en IDs.

## Mòduls principals

### 1. `indexDocxWithSdts.ts`

Encarregat d'indexar documents DOCX, envoltant cada paràgraf amb un SDT que conté un ID únic (amb prefix `docproof_pid_`).

```typescript
import { indexDocxWithSdts, isDocxIndexed } from './indexDocxWithSdts';

// Verificar si un document ja està indexat
const checkResult = await isDocxIndexed(docxBuffer);

// Indexar un document
const result = await indexDocxWithSdts(docxBuffer);
// result.indexedBuffer - El document indexat
// result.idMap - Mapa d'IDs assignats a cada paràgraf
```

### 2. `generatePlaceholderDocxWithIds.ts`

Utilitza els IDs assignats per `indexDocxWithSdts` per a generar placeholders precisos.

```typescript
import { generatePlaceholderDocxWithIds } from './generatePlaceholderDocxWithIds';

const placeholderBuffer = await generatePlaceholderDocxWithIds(
  indexedDocxBuffer,
  linkMappings,
  aiInstructions
);
```

### 3. `verifySdtPersistence.ts`

Verifica la integritat dels SDTs en un document DOCX, especialment després d'editar-lo amb MS Word.

```typescript
import { checkIndexedDocxIntegrity, generateSdtDetailedReport } from './verifySdtPersistence';

// Verificar la integritat
const result = await checkIndexedDocxIntegrity(docxBuffer);
// result.isIntegrityPreserved - true si els SDTs s'han mantingut

// Generar un informe detallat
const report = await generateSdtDetailedReport(docxBuffer);
```

## Script de test

El script `test-sdt-persistence.ts` facilita provar tot el procés:

### Indexar un document

```bash
node -r ts-node/register util/docx/test-sdt-persistence.ts index path/to/original.docx output/indexed.docx
```

### Verificar la persistència després d'editar amb MS Word

```bash
node -r ts-node/register util/docx/test-sdt-persistence.ts verify path/to/edited.docx
```

### Generar un informe detallat sobre els SDTs d'un document

```bash
node -r ts-node/register util/docx/test-sdt-persistence.ts report path/to/document.docx > report.txt
```

## Flux de treball per a validar la persistència

1. **Indexar un document de prova:**
   ```bash
   node -r ts-node/register util/docx/test-sdt-persistence.ts index test.docx test_indexed.docx
   ```

2. **Obrir el document indexat amb MS Word:**
   - Fer petits canvis (modificar text, afegir/esborrar contingut)
   - Desar el document (amb el mateix nom o un de nou)

3. **Verificar la persistència:**
   ```bash
   node -r ts-node/register util/docx/test-sdt-persistence.ts verify test_indexed.docx
   ```

4. **Analitzar detalladament si hi ha problemes:**
   ```bash
   node -r ts-node/register util/docx/test-sdt-persistence.ts report test_indexed.docx > report.txt
   ```

## Notes tècniques

- Els SDTs inclouen un ID numèric únic (`<w:id w:val="número">`) i un tag amb format específic (`<w:tag w:val="docproof_pid_UUID">`)
- La verificació comprova específicament els tags amb el prefix `docproof_pid_`
- S'utilitzen namespaces XML correctes per assegurar la compatibilitat amb MS Word
- El sistema funciona amb paràgrafs dins de taules i altres estructures complexes
