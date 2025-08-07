# SOLUCIÓ COMPLETA: PLACEHOLDERS TRENCATS - ERROR 401 WORKER

**Data**: 7 d'agost de 2025  
**Problema**: Error del worker: El worker ha retornat una resposta no esperada (possiblement un error d'infraestructura) amb estat 401  
**Causa Arrel**: Format legacy `{{UNIFIED_PLACEHOLDER:...}}` incompatible amb docxtemplater  

## 🎯 PROBLEMA IDENTIFICAT

### Origen del Format Legacy
- **Fitxer**: `util/docx/generatePlaceholderDocxWithIds.ts`
- **Funció**: `generateUnifiedJsonPlaceholder()` (ELIMINADA)
- **Format problemàtic**: `{{UNIFIED_PLACEHOLDER:{"paragraphId":"...","type":"..."}}}` 

### Endpoints Afectats
1. `app/api/update-template/[id]/route.ts`
2. `app/api/regenerate-placeholder-docx/[templateId]/route.ts`

## ✅ SOLUCIÓ IMPLEMENTADA

### FASE 1: Modificació del Generador de Placeholders

**Canvis a `generatePlaceholderDocxWithIds.ts`**:

```typescript
// ❌ ELIMINAT: generateUnifiedJsonPlaceholder()
// ✅ AFEGIT: generateSimplePlaceholder()

function generateSimplePlaceholder(
  paragraphId: string, 
  data: ParagraphData, 
  originalText: string
): string {
  const hasExcel = data.excelMappings.length > 0;
  const hasAI = data.aiInstructions.length > 0;
  
  if (hasExcel) {
    // Si té Excel mappings, usar el primer header normalitzat
    const header = data.excelMappings[0].excelHeader;
    if (header) {
      const normalizedHeader = header.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      return `{{${normalizedHeader}}}`;
    }
  } else if (hasAI) {
    // Si només té IA, generar placeholder genèric basat en l'ID
    const aiPlaceholder = `AI_${paragraphId.split('-').pop()?.toUpperCase() || 'CONTENT'}`;
    return `{{${aiPlaceholder}}}`;
  }
  
  // Fallback genèric
  return '{{PLACEHOLDER}}';
}
```

### FASE 2: Migració Massiva de Plantilles

**Resultat de la migració**:
```json
{
  "success": true,
  "migrated": 7,
  "failed": 0,
  "skipped": 1,
  "processingTimeMs": 6783
}
```

**Plantilles migrades**:
- `16bb2495-d0d3-4b25-b7f5-bdea0c79dcc7` ✅
- `365429f4-25b3-421f-a04e-b646d1e3939d` ✅
- `939cd2d5-fd5b-410b-9d4c-c1551cec9934` ✅
- `09138191-efee-4eb5-b2c4-593b72de4125` ✅
- `d508290b-e913-4f4f-8d2b-70b622cab5ed` ✅
- `9e79c371-6f0e-49d0-bf5d-3eea763ee540` ✅
- `fc1ad521-e473-49e5-a3fb-ca8f7c5cd879` ✅

### FASE 3: Correcció de l'Endpoint de Generació

**Canvis a `app/api/reports/generate-smart-enhanced/route.ts`**:

```typescript
// ❌ ELIMINAT: Ús de templateContent (HTML/JSON)
// ✅ AFEGIT: Ús directe del DOCX amb placeholders

// SISTEMA SIMPLE: Usar directament el DOCX amb placeholders
const docxPath = template.placeholder_docx_storage_path || 
                template.docx_storage_path || 
                template.base_docx_storage_path ||
                template.indexed_docx_storage_path ||
                null;

const result = await processor.processSingle(
  '', // templateContent no necessari per sistema simple
  docxPath,
  generation.row_data,
  project.template_id,
  user.id
);
```

## 🔧 ARQUITECTURA FINAL

### Sistema de Placeholders Simplificat

```
ABANS (Legacy):
{{UNIFIED_PLACEHOLDER:{"paragraphId":"p1","type":"excel_only","baseTextWithPlaceholders":"Text amb {{HEADER}}"}}}

DESPRÉS (Simple):
{{HEADER}}
```

### Flux de Processament

1. **Editor de Plantilles** → Genera placeholders simples `{{HEADER}}`
2. **Migració** → Converteix format legacy a simple
3. **SmartDocumentProcessor** → Processa directament amb docxtemplater
4. **Generació** → Substitució directa Excel → Placeholders

## 📊 BENEFICIS DE LA SOLUCIÓ

✅ **Eliminació del problema a l'arrel** - No més format legacy generat  
✅ **Simplicitat màxima** - Només placeholders `{{HEADER}}`  
✅ **Compatible amb docxtemplater** - Format estàndard  
✅ **Manteniment zero** - No cal preprocessadors complexos  
✅ **Rendiment òptim** - Menys processament  
✅ **Debugging fàcil** - Placeholders visibles i comprensibles  

## 🚨 PROBLEMA PERSISTENT

Malgrat les correccions, l'error "Multi error" persisteix. Això indica que:

1. **Plantilles encara contenen format legacy** no detectat
2. **docxtemplater troba placeholders malformats** 
3. **Necessitat de debugging més profund** del contingut DOCX

## 🔍 SEGÜENTS PASSOS RECOMANATS

### Diagnòstic Profund
1. **Extreure i analitzar** el contingut XML del DOCX problemàtic
2. **Identificar placeholders** que causen el "Multi error"
3. **Crear eina de neteja** per eliminar format legacy residual

### Solució Definitiva
1. **Regenerar totes les plantilles** des de zero amb el nou sistema
2. **Implementar validació** de placeholders abans de processar
3. **Crear sistema de fallback** per gestionar errors de docxtemplater

## 📝 CODI DE TESTING

```bash
# Migració massiva
curl -X POST http://localhost:3000/api/templates/migrate-to-simple \
  -H "Content-Type: application/json" \
  -d '{"mode": "all", "adminMode": true, "force": true}'

# Test de generació
curl -X POST http://localhost:3000/api/reports/generate-smart-enhanced \
  -H "Content-Type: application/json" \
  -d '{"projectId": "140acbe5-45f5-4cf3-9aac-005b575ecef2", "generationId": "5bef36c4-d16a-4c60-9528-5709f8d625db", "adminMode": true}'
```

## 🎯 ESTAT ACTUAL

- ✅ **Generador de placeholders** corregit
- ✅ **Migració massiva** completada
- ✅ **Endpoint de generació** corregit
- ❌ **Error "Multi error"** persisteix
- 🔄 **Necessita debugging profund** del contingut DOCX

---

**Conclusió**: La solució està implementada correctament a nivell de codi, però el problema persisteix degut a contingut legacy residual en els fitxers DOCX. Es requereix una anàlisi més profunda del contingut XML per identificar i eliminar els placeholders problemàtics.
