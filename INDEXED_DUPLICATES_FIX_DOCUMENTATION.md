# Solució al Problema de Fitxers Indexats Duplicats

## 📋 Resum del Problema

**Problema Identificat**: Inconsistència en la nomenclatura de fitxers indexats que causava la creació de fitxers duplicats amb noms diferents:
- ✅ Correcte: `/indexed/indexed.docx`
- ❌ Problemàtic: `/indexed/original.docx`

**Causa Arrel**: Línia 150 de `app/api/update-template/[id]/route.ts` utilitzava una lògica de substitució incorrecta que no canviava el nom del fitxer.

## 🔍 Anàlisi Tècnic Detallat

### **Endpoints Analitzats**:

1. **`upload-original-docx/route.ts`** ✅ **CORRECTE**
   ```javascript
   // Línia 89: CORRECTA
   const indexedStoragePath = `user-${userId}/template-${templateId}/indexed/indexed.docx`;
   ```

2. **`update-template/[id]/route.ts`** ❌ **PROBLEMÀTIC** → ✅ **CORREGIT**
   ```javascript
   // ABANS (línia 150): PROBLEMÀTICA
   const indexedPath = originalPathToUse.replace('/original/', '/indexed/').replace('.docx', '.docx');
   
   // DESPRÉS: CORREGIDA
   const indexedPath = originalPathToUse.replace('/original/', '/indexed/').replace(/\/[^\/]+\.docx$/, '/indexed.docx');
   ```

3. **`regenerate-placeholder-docx/[templateId]/route.ts`** ✅ **CORRECTE**
   ```javascript
   // Línia 207: CORRECTA
   const indexedPath = originalPath.replace('/original/', '/indexed/').replace(/\/[^\/]+$/, '/indexed.docx');
   ```

### **Explicació de la Correcció**:

**Regex Utilitzada**: `/\/[^\/]+\.docx$/`
- `\/` - Coincideix amb una barra literal
- `[^\/]+` - Coincideix amb un o més caràcters que NO siguin barres (nom del fitxer)
- `\.docx` - Coincideix amb l'extensió .docx literal
- `$` - Final de cadena

**Resultat**: Substitueix qualsevol nom de fitxer .docx per `/indexed.docx`, garantint nomenclatura consistent.

## 🛠️ Solució Implementada

### **1. Correcció del Codi Principal**
- ✅ Modificada línia 150 de `app/api/update-template/[id]/route.ts`
- ✅ Aplicada regex correcta per unificar nomenclatura

### **2. Endpoint de Cleanup**
- ✅ Creat `app/api/cleanup/indexed-duplicates/route.ts`
- **POST**: Elimina fitxers duplicats `/indexed/original.docx`
- **GET**: Escaneja i reporta fitxers duplicats sense eliminar-los

### **3. Endpoint de Testing**
- ✅ Creat `app/api/debug/test-indexed-fix/route.ts`
- **POST**: Executa tests de verificació de la lògica corregida
- **GET**: Analitza l'estat actual dels fitxers indexats

## 🧪 Tests de Verificació

### **Test Cases Implementats**:

1. **Test de Nomenclatura Corregida**:
   - Ruta estàndard: `original/original.docx` → `indexed/indexed.docx` ✅
   - Nom personalitzat: `original/document.docx` → `indexed/indexed.docx` ✅
   - Nom llarg: `original/my-custom-document-name.docx` → `indexed/indexed.docx` ✅

2. **Test de Lògica Antiga (Confirmació del Problema)**:
   - Verifica que la lògica antiga creava: `indexed/original.docx` ✅

3. **Test de Consistència entre Endpoints**:
   - Verifica que tots els endpoints generin la mateixa nomenclatura ✅

## 📊 Impacte de la Solució

### **Abans de la Correcció**:
- `upload-original-docx`: Creava `/indexed/indexed.docx` ✅
- `update-template`: Creava `/indexed/original.docx` ❌
- `regenerate-placeholder-docx`: Creava `/indexed/indexed.docx` ✅
- **Resultat**: Fitxers duplicats i inconsistència

### **Després de la Correcció**:
- `upload-original-docx`: Crea `/indexed/indexed.docx` ✅
- `update-template`: Crea `/indexed/indexed.docx` ✅
- `regenerate-placeholder-docx`: Crea `/indexed/indexed.docx` ✅
- **Resultat**: Nomenclatura unificada i consistent

## 🚀 Instruccions d'Ús

### **1. Verificar la Correcció**:
```bash
POST /api/debug/test-indexed-fix
# Executa tests de verificació
```

### **2. Escanejar Fitxers Duplicats Existents**:
```bash
GET /api/cleanup/indexed-duplicates
# Mostra fitxers duplicats sense eliminar-los
```

### **3. Netejar Fitxers Duplicats**:
```bash
POST /api/cleanup/indexed-duplicates
# Elimina tots els fitxers /indexed/original.docx
```

### **4. Verificar Estat Actual**:
```bash
GET /api/debug/test-indexed-fix
# Mostra l'estat actual dels fitxers indexats
```

## 🔒 Seguretat i Autenticació

Tots els endpoints implementats requereixen:
- ✅ Autenticació via Bearer token
- ✅ Verificació d'usuari vàlid
- ✅ Accés només als fitxers de l'usuari autenticat
- ✅ Utilització de Service Role Key per operacions d'emmagatzematge

## 📈 Beneficis de la Solució

1. **Eliminació de Duplicats**: No es crearan més fitxers `/indexed/original.docx`
2. **Nomenclatura Consistent**: Tots els endpoints utilitzen `/indexed/indexed.docx`
3. **Neteja Automàtica**: Endpoint per eliminar duplicats existents
4. **Testing Robust**: Verificació automàtica de la correcció
5. **Documentació Completa**: Anàlisi detallat del problema i solució

## 🎯 Conclusió

La solució implementada resol completament el problema de fitxers indexats duplicats mitjançant:

- **Correcció de la causa arrel** a `update-template/[id]/route.ts`
- **Unificació de nomenclatura** entre tots els endpoints
- **Eines de neteja** per eliminar duplicats existents
- **Sistema de testing** per verificar la correcció
- **Documentació completa** per futures referències

**Estat**: ✅ **RESOLT COMPLETAMENT**

---

*Documentació creada el 6 de juliol de 2025*
*Autor: Cline AI Assistant*
