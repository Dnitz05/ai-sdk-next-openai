# 📁 Estructura Completa de Documents al Bucket Supabase

## 🎯 **Bucket Principal: `template-docx`**

### 📂 **Estructura de Directoris per Plantilla:**

```
template-docx/
├── user-{userId}/
│   └── template-{templateId}/
│       ├── original/
│       │   └── original.docx          # Document original pujat per l'usuari
│       ├── indexed/
│       │   └── indexed.docx           # Document original amb SDTs (IDs únics)
│       └── placeholder/
│           └── placeholder.docx       # Document amb placeholders per substitució
```

---

## 🔄 **Flux de Creació de Documents:**

### **1. Pujada del Document Original**
**Endpoint:** `POST /api/upload-original-docx`
**Fitxer creat:**
```
user-{userId}/template-{templateId}/original/original.docx
```
- **Nom fix:** `original.docx`
- **Contingut:** Document DOCX original pujat per l'usuari
- **BD:** `plantilla_configs.base_docx_storage_path`

### **2. Indexació Automàtica (si cal)**
**Procés:** Automàtic durant la pujada
**Fitxer creat:**
```
user-{userId}/template-{templateId}/indexed/indexed.docx
```
- **Nom fix:** `indexed.docx`
- **Contingut:** Document original amb SDTs (Structure Document Tags) per identificar paràgrafs
- **BD:** `plantilla_configs.indexed_docx_storage_path`
- **Quan es crea:** Només si el document original no té SDTs

### **3. Generació de Placeholder**
**Endpoint:** `POST /api/regenerate-placeholder-docx/[templateId]`
**Fitxer creat:**
```
user-{userId}/template-{templateId}/placeholder/placeholder.docx
```
- **Nom fix:** `placeholder.docx`
- **Contingut:** Document amb placeholders `{{placeholder_id}}` per substitució
- **BD:** `plantilla_configs.placeholder_docx_storage_path`

---

## 🔧 **Ús dels Documents pel Worker:**

### **Context Document (per IA):**
- **Path:** `config.context_document_path`
- **Normalment:** `user-{userId}/template-{templateId}/original/original.docx`
- **Propòsit:** Proporcionar context ric a la IA per generar contingut

### **Template Document (per substitucions):**
- **Path:** `config.template_document_path`
- **Prioritat:**
  1. `placeholder.docx` (si existeix)
  2. `indexed.docx` (fallback)
  3. `original.docx` (últim recurs)
- **Propòsit:** Document base per aplicar substitucions finals

---

## 📋 **Exemples Reals de Paths:**

### **Usuari:** `2c439ad3-2097-4f17-a1a3-1b4fa8967075`
### **Plantilla:** `e30433b1-e688-4949-aa0f-fc1f2ca6c719`

```
user-2c439ad3-2097-4f17-a1a3-1b4fa8967075/template-e30433b1-e688-4949-aa0f-fc1f2ca6c719/original/original.docx
user-2c439ad3-2097-4f17-a1a3-1b4fa8967075/template-e30433b1-e688-4949-aa0f-fc1f2ca6c719/indexed/indexed.docx
user-2c439ad3-2097-4f17-a1a3-1b4fa8967075/template-e30433b1-e688-4949-aa0f-fc1f2ca6c719/placeholder/placeholder.docx
```

---

## 🗃️ **Relació amb Base de Dades:**

### **Taula:** `plantilla_configs`
```sql
- base_docx_storage_path      → original/original.docx
- indexed_docx_storage_path   → indexed/indexed.docx  
- placeholder_docx_storage_path → placeholder/placeholder.docx
- paragraph_mappings          → Mappings d'IDs dels SDTs
```

---

## ⚠️ **Problemes Identificats:**

### **1. Error de Bucket Incorrecte (RESOLT)**
- **Problema:** Codi utilitzava bucket `'documents'` inexistent
- **Solució:** Canviat a `'template-docx'` (bucket real)

### **2. Error "Could not find file in options"**
- **Possible causa:** Document placeholder no existeix
- **Solució:** Verificar que s'ha executat la generació de placeholder

### **3. Migració de Configuracions Antigues**
- **Problema:** Jobs antics sense `context_document_path` i `template_document_path`
- **Solució:** Worker fa migració automàtica basada en `plantilla_configs`

---

## 🔍 **Diagnòstic Ràpid:**

### **Verificar existència de documents:**
```bash
# Via endpoint de debug
GET /api/debug/storage-test?path=user-{userId}/template-{templateId}/original/original.docx
```

### **Verificar configuració de plantilla:**
```sql
SELECT 
  base_docx_storage_path,
  indexed_docx_storage_path,
  placeholder_docx_storage_path
FROM plantilla_configs 
WHERE id = '{templateId}' AND user_id = '{userId}';
```

---

## 📝 **Notes Importants:**

1. **Noms de fitxers són FIXOS** - sempre `original.docx`, `indexed.docx`, `placeholder.docx`
2. **Estructura de directoris és CONSISTENT** - sempre `user-{userId}/template-{templateId}/{type}/`
3. **Bucket és ÚNIC** - tot es desa a `template-docx`
4. **Worker utilitza 2 documents** - un per context (IA) i un per substitucions (final)
5. **Indexació és AUTOMÀTICA** - es fa durant la pujada si el document no té SDTs
