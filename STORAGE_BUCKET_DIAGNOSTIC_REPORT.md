# 🔍 Diagnòstic Complet del Bucket de Storage - Supabase

## 📊 **Resum Executiu**

**PROBLEMA IDENTIFICAT:** Discrepància crítica entre l'estructura de fitxers al bucket i els noms esperats pel codi.

---

## 🎯 **Bucket Verificat**

✅ **Bucket:** `template-docx` (existeix i és correcte)
- **Creat:** 2025-05-11 17:47:52
- **Públic:** false
- **Límit de mida:** null

---

## 📁 **Fitxers Reals al Bucket**

### **Plantilla:** `d338ef63-7656-4d16-a373-6d988b1fe73e`
### **Usuari:** `2c439ad3-2097-4f17-a1a3-1b4fa8967075`

```
template-docx/
├── user-2c439ad3-2097-4f17-a1a3-1b4fa8967075/
│   └── template-d338ef63-7656-4d16-a373-6d988b1fe73e/
│       ├── original/
│       │   └── original.docx ✅ (23,784 bytes)
│       ├── indexed/
│       │   ├── indexed.docx ✅ (258,195 bytes)
│       │   └── original.docx ❌ (258,195 bytes) - FITXER DUPLICAT!
│       ├── placeholder/
│       │   ├── placeholder.docx ✅ (258,466 bytes)
│       │   └── .keep (0 bytes)
│       └── excel/
│           └── data.xlsx ✅ (8,753 bytes)
```

---

## 🗃️ **Configuració a Base de Dades**

### **Taula:** `plantilla_configs`
```sql
id: d338ef63-7656-4d16-a373-6d988b1fe73e
user_id: 2c439ad3-2097-4f17-a1a3-1b4fa8967075
config_name: "prova1"

base_docx_storage_path: "user-2c439ad3-2097-4f17-a1a3-1b4fa8967075/template-d338ef63-7656-4d16-a373-6d988b1fe73e/original/original.docx"
indexed_docx_storage_path: "user-2c439ad3-2097-4f17-a1a3-1b4fa8967075/template-d338ef63-7656-4d16-a373-6d988b1fe73e/indexed/indexed.docx"
placeholder_docx_storage_path: "user-2c439ad3-2097-4f17-a1a3-1b4fa8967075/template-d338ef63-7656-4d16-a373-6d988b1fe73e/placeholder/placeholder.docx"
```

---

## ⚠️ **DISCREPÀNCIES CRÍTIQUES IDENTIFICADES**

### **1. Fitxer Duplicat a `/indexed/`**
❌ **PROBLEMA:** Hi ha dos fitxers a la carpeta `indexed/`:
- `indexed.docx` (correcte)
- `original.docx` (duplicat incorrecte)

### **2. Possible Confusió en Lectura**
❌ **RISC:** El codi podria estar llegint el fitxer incorrecte si busca per nom sense especificar el path complet.

### **3. Plantilles Antigues Sense Paths**
❌ **PROBLEMA:** Hi ha 3 plantilles antigues amb paths NULL:
- `74902c99-5f25-40cb-a63f-60eb362bd253`
- `185468cd-5140-477b-8187-281e5228a282`
- `98e5abd2-d26b-435f-8f6d-5475e505786a`

---

## 🔧 **Anàlisi del Codi Worker**

### **Funció:** `getDocxTextContent()` a `util/docx/readDocxFromStorage.ts`

**PROBLEMA POTENCIAL:** Si el codi no especifica el path complet correctament, podria:
1. Llegir el fitxer duplicat `indexed/original.docx` en lloc de `original/original.docx`
2. Fallar en trobar el fitxer si busca per nom sense path complet

---

## 🎯 **CAUSA PROBABLE DE L'ERROR**

### **Error Original:**
```
StorageUnknownError: {}
Could not find file in options
```

### **Hipòtesi:**
1. **Bucket correcte** ✅ - `template-docx` existeix
2. **Paths correctes a BD** ✅ - Els paths són vàlids
3. **Fitxers existeixen** ✅ - Tots els fitxers necessaris estan al bucket
4. **PROBLEMA:** Possible confusió per fitxer duplicat o error en lectura

---

## 📋 **ACCIONS RECOMANADES**

### **1. URGENT - Neteja de Fitxers Duplicats**
```bash
# Eliminar fitxer duplicat problemàtic
DELETE FROM storage.objects 
WHERE bucket_id = 'template-docx' 
AND name = 'user-2c439ad3-2097-4f17-a1a3-1b4fa8967075/template-d338ef63-7656-4d16-a373-6d988b1fe73e/indexed/original.docx';
```

### **2. Verificar Funció de Lectura**
- Revisar `util/docx/readDocxFromStorage.ts`
- Assegurar que utilitza el path complet correcte
- Verificar gestió d'errors de Supabase Storage

### **3. Testejar amb Plantilla Neta**
- Utilitzar la plantilla `d338ef63-7656-4d16-a373-6d988b1fe73e` després de neteja
- Verificar que el worker pot llegir tots els documents

### **4. Migrar Plantilles Antigues**
- Actualitzar plantilles amb paths NULL
- O eliminar-les si no són necessàries

---

## 🔍 **Pròxims Passos de Diagnòstic**

1. **Eliminar fitxer duplicat** problemàtic
2. **Testejar lectura** de documents amb endpoint de debug
3. **Executar worker** amb configuració neta
4. **Verificar logs** per errors específics

---

## 📝 **Notes Tècniques**

- **Bucket:** `template-docx` és correcte i funcional
- **Estructura:** Segueix el patró esperat `user-{userId}/template-{templateId}/{type}/{file}`
- **Permisos:** Bucket privat, requereix autenticació
- **Mida fitxers:** Tots dins dels límits normals

**CONCLUSIÓ:** El problema NO és el bucket o l'estructura, sinó probablement el fitxer duplicat que confon la lectura.
