# ✅ ARQUITECTURA CORREGIDA PER DOCUMENTS SEPARATS

## 🔥 PROBLEMA RESOLT

**Problema Original**: El sistema intentava usar un sol document per dues tasques incompatibles:
- Proporcionar context ric a la IA 
- Servir com a plantilla per substitucions finals

**Resultat**: Error `template_document_path is null` i confusió arquitectònica.

## 🎯 NOVA ARQUITECTURA IMPLEMENTADA

### **Separació Clara de Documents**

```typescript
export interface JobConfig {
  // 🔥 SEPARACIÓ CLARA DE DOCUMENTS
  context_document_path: string;    // Document original per context IA
  template_document_path: string;   // Document plantilla per substitucions
  
  template_id: string;
  project_id: string | null;
  excel_data: any[];
  prompts: AIInstruction[];
}
```

### **Dos Documents, Dos Propòsits**

| Document | Propòsit | Quan s'usa | Contingut |
|----------|-----------|------------|-----------|
| **Context Document** (`context_document_path`) | Proporcionar context ric a la IA | FASE 1: Generació de contingut | Text original complet i coherent |
| **Template Document** (`template_document_path`) | Servir de motlle per substitucions | FASE 2: Aplicació de substitucions | Text amb placeholders `[AI_INSTRUCTION: ...]` |

## 🔄 NOU FLUX DEL WORKER

### **FASE 1: Generació de Contingut amb IA**
```typescript
// Llegir document original per obtenir context ric
fullDocumentText = await getDocxTextContent(config.context_document_path);

// Enviar context complet a Mistral AI
const mistralPrompt = CONTENT_GENERATION_PROMPT(
  prompt.prompt,
  rowData,
  fullDocumentText  // ✅ Context ric del document original
);
```

### **FASE 2: Substitucions Finals**
```typescript
// Aplicar substitucions al document plantilla
const finalDocumentBuffer = await applyFinalSubstitutions(
  config.template_document_path,    // ✅ Document amb placeholders
  generatedContentMap,              // Contingut generat per la IA
  rowData                          // Dades de l'Excel
);
```

## 📁 FITXERS MODIFICATS

### **1. Types (`app/types/index.ts`)**
- ✅ JobConfig actualitzat amb `context_document_path` i `template_document_path`
- ✅ Documentació clara dels propòsits de cada document

### **2. API de Generació (`app/api/reports/generate-async/route.ts`)**
- ✅ Validació separada dels dos paths
- ✅ Context document: `base_docx_storage_path`
- ✅ Template document: `placeholder_docx_storage_path` (amb fallbacks)

### **3. Worker (`lib/workers/documentProcessor.ts`)**
- ✅ FASE 1: Lectura de context original per la IA
- ✅ FASE 2: Aplicació de substitucions al document plantilla
- ✅ Import de nova utilitat `applyFinalSubstitutions`

### **4. Nova Utilitat (`util/docx/applyFinalSubstitutions.ts`)**
- ✅ Funció per aplicar substitucions finals
- ✅ Suport per placeholders AI_INSTRUCTION i EXCEL_LINK
- ✅ Backup amb substitucions de text pla

### **5. Lectura de Documents (`util/docx/readDocxFromStorage.ts`)**
- ✅ Nova funció `readDocxFromStorage` per llegir buffers
- ✅ Mantinguda la funció original `getDocxTextContent`

## 🎯 BENEFICIS DE LA NOVA ARQUITECTURA

### **✅ Context Ric per la IA**
- La IA rep el document original complet
- Context coherent i significatiu
- Millor qualitat en la generació de contingut

### **✅ Substitucions Precises**
- Document plantilla amb placeholders clars
- Substitucions exactes i controlades
- Separació neta entre generació i aplicació

### **✅ Robustesa**
- Fallbacks configurats per cada tipus de document
- Validacions estrictes abans de processar
- Errors més descriptius i específics

### **✅ Escalabilitat**
- Arquitectura preparada per futures millores
- Separació clara de responsabilitats
- Fàcil manteniment i depuració

## 🔧 CONFIGURACIÓ RECOMANADA

### **Per Plantilles Noves**
1. **base_docx_storage_path**: Document original carregat per l'usuari
2. **placeholder_docx_storage_path**: Document generat amb placeholders
3. **indexed_docx_storage_path**: Document amb IDs (opcional)

### **Prioritats de Fallback**
```typescript
// Context Document (per IA)
context_document_path = base_docx_storage_path || ERROR

// Template Document (per substitucions)  
template_document_path = placeholder_docx_storage_path || 
                        indexed_docx_storage_path || 
                        base_docx_storage_path
```

## 🚀 ESTAT ACTUAL

✅ **Implementació completa** - Tots els components actualitzats
✅ **Error `template_document_path is null` resolt**
✅ **Arquitectura robusta i escalable**
✅ **Separació clara de responsabilitats**
✅ **Fallbacks configurats per màxima compatibilitat**

La nova arquitectura garanteix que el worker sempre tingui:
1. **Context ric** del document original per generar contingut de qualitat
2. **Document plantilla** adequat per aplicar substitucions precises

## 🎉 RESULTAT

L'error `template_document_path is null` era un símptoma d'un **error de disseny arquitectònic fonamental**. Amb aquesta nova implementació:

- 🔥 **Error resolt completament**
- 🎯 **Arquitectura correcta i robusta**  
- ✅ **Sistema preparat per producci
