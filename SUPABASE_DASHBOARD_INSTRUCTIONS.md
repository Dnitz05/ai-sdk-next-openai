# 🎯 Instruccions per Supabase Dashboard - Eliminar Fitxer Duplicat

## 📋 **ACCIÓ URGENT REQUERIDA**

Necessites eliminar un fitxer duplicat problemàtic que està causant l'error `ERR_INTERNET_DISCONNECTED`.

---

## 🔧 **Pas a Pas al Supabase Dashboard**

### **1. Accedir al Storage**
1. Ves a [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona el projecte: `ypunjalpaecspihjeces`
3. Al menú lateral, clica **"Storage"**

### **2. Navegar al Bucket**
1. Clica al bucket **`template-docx`**
2. Navega a la carpeta: `user-2c439ad3-2097-4f17-a1a3-1b4fa8967075`
3. Entra a: `template-d338ef63-7656-4d16-a373-6d988b1fe73e`
4. Entra a la carpeta: **`indexed`**

### **3. Identificar el Fitxer Problemàtic**
Dins de la carpeta `indexed/` hauries de veure **DOS fitxers**:
- ✅ `indexed.docx` (258,195 bytes) - **MANTENIR**
- ❌ `original.docx` (258,195 bytes) - **ELIMINAR AQUEST**

### **4. Eliminar el Fitxer Duplicat**
1. Selecciona el fitxer **`original.docx`** dins de la carpeta `indexed/`
2. Clica el botó **"Delete"** o icona de paperera
3. Confirma l'eliminació

---

## ✅ **Verificació Post-Eliminació**

Després d'eliminar el fitxer, la carpeta `indexed/` només hauria de contenir:
- ✅ `indexed.docx` (258,195 bytes)

---

## 🎯 **Path Complet del Fitxer a Eliminar**

```
Bucket: template-docx
Path: user-2c439ad3-2097-4f17-a1a3-1b4fa8967075/template-d338ef63-7656-4d16-a373-6d988b1fe73e/indexed/original.docx
```

---

## 📱 **Captura de Pantalla Recomanada**

Fes una captura abans i després per confirmar:
- **ABANS:** Dos fitxers a `indexed/` (indexed.docx + original.docx)
- **DESPRÉS:** Un sol fitxer a `indexed/` (només indexed.docx)

---

## 🔍 **Què Esperar Després**

Un cop eliminat el fitxer duplicat:
1. El worker podrà llegir correctament els documents
2. Els jobs de generació es completaran
3. L'error `ERR_INTERNET_DISCONNECTED` desapareixerà
4. L'endpoint `/api/reports/jobs-status` respondrà correctament

---

## ⚠️ **IMPORTANT**

- **NO eliminis** cap altre fitxer
- **Només elimina** `original.docx` de dins la carpeta `indexed/`
- **Mantén** tots els altres fitxers intactes

---

## 🆘 **Si No Veus els Fitxers**

Si no veus els fitxers al dashboard:
1. Verifica que estàs al projecte correcte: `ypunjalpaecspihjeces`
2. Comprova que tens permisos d'administrador
3. Refresca la pàgina del dashboard

---

## 📞 **Confirmació**

Després de fer l'eliminació, confirma que:
- [ ] Fitxer `indexed/original.docx` eliminat
- [ ] Fitxer `indexed/indexed.docx` encara present
- [ ] Altres carpetes (`original/`, `placeholder/`, `excel/`) intactes

## 🧪 **Verificació Automàtica**

Un cop eliminat el fitxer, pots verificar que el fix ha funcionat:

**Endpoint de verificació:**
```
GET http://localhost:3000/api/debug/verify-fix
```

Aquest endpoint:
- ✅ Testeja la lectura dels 3 documents (original, indexed, placeholder)
- ✅ Confirma que tots es poden llegir correctament
- ✅ Proporciona un resum complet del resultat

**Resultat esperat:**
```json
{
  "success": true,
  "message": "🎉 TOTS els documents es poden llegir correctament! El fix ha funcionat.",
  "summary": {
    "successful_reads": 3,
    "all_documents_readable": true
  }
}
```

**Un cop fet això, el problema hauria d'estar resolt!**
