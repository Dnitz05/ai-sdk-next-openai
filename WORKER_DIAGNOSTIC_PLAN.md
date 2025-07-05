# 🎯 PLA D'ACCIÓ: Diagnòstic i Solució del Worker

## **Situació Actual**

### ✅ **Descobertes Confirmades:**
1. **Vercel SSO activat** - Bloqueja tots els endpoints públics amb 401/403
2. **Sistema intern funciona** - Els logs de Vercel mostren activitat normal
3. **Worker s'executa** - Però falla en descarregar documents de Supabase Storage

### 🔍 **Logs Implementats:**
- **Variables d'entorn** - Verificació completa al worker
- **Paths de documents** - Logs detallats dels paths utilitzats
- **Errors serialitzats** - Captura completa d'errors amb totes les propietats
- **Diagnòstic de buckets** - Verificació de permisos i existència

## **Pla d'Execució**

### **FASE 1: Test Real del Worker**

#### **Objectiu:** Executar una generació d'informe real per capturar l'error exacte

#### **Passos:**
1. **Accedir a la interfície web** (amb autenticació SSO)
2. **Crear un nou informe** amb una plantilla existent
3. **Executar la generació** per activar el worker
4. **Revisar logs de Vercel** per veure l'error detallat

#### **Logs Esperats:**
```
[Worker] 🔍 DIAGNÒSTIC COMPLET - Intentant llegir document de context...
[Worker] Path del document de context: "user-xxx/template-xxx/original/original.docx"
[Worker] Variables d'entorn disponibles al worker: {...}
[readDocxFromStorage] Verificant variables d'entorn...
[readDocxFromStorage] NEXT_PUBLIC_SUPABASE_URL: PRESENT/MISSING
[readDocxFromStorage] SUPABASE_SERVICE_ROLE_KEY: PRESENT/MISSING
```

### **FASE 2: Anàlisi de Resultats**

#### **Escenari A: Variables d'Entorn Faltants**
```
[readDocxFromStorage] NEXT_PUBLIC_SUPABASE_URL: MISSING
```
**Solució:** Configurar variables d'entorn a Vercel

#### **Escenari B: Fitxer No Existeix**
```
[readDocxFromStorage] Fitxer "original.docx" existeix: false
```
**Solució:** Verificar pujada de fitxers o corregir paths

#### **Escenari C: Problemes de Permisos RLS**
```
[readDocxFromStorage] Error de Supabase Storage: "RLS policy violation"
```
**Solució:** Configurar polítiques RLS per service_role

#### **Escenari D: Bucket No Existeix**
```
[readDocxFromStorage] Bucket 'documents' NO trobat!
```
**Solució:** Crear bucket a Supabase Storage

### **FASE 3: Implementació de Solucions**

#### **Per Variables d'Entorn:**
1. Accedir a Vercel Dashboard
2. Configurar variables d'entorn:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MISTRAL_API_KEY`
3. Redeploy del projecte

#### **Per Problemes de Fitxers:**
1. Verificar estructura de directoris a Supabase Storage
2. Re-pujar fitxers si cal
3. Corregir paths a la base de dades

#### **Per Problemes RLS:**
1. Crear polítiques RLS per service_role
2. Permetre accés complet al bucket 'documents'
3. Testar amb client service_role

### **FASE 4: Verificació**

#### **Test de Verificació:**
1. Executar nova generació d'informe
2. Verificar logs mostren èxit:
```
[Worker] ✅ Context del document original obtingut per al job xxx. Longitud: 1234
[Worker] Primeres 200 caràcters del document: "Contingut del document..."
```

## **Comandes Útils**

### **Revisar Logs de Vercel:**
```bash
# Accedir a Vercel Dashboard > Project > Functions > Logs
# Filtrar per "Worker" o "readDocxFromStorage"
```

### **Test Local (si cal):**
```bash
# Executar localment amb variables d'entorn
npm run dev
```

## **Punts Crítics**

### ⚠️ **Important:**
- **No podem usar endpoints públics** a causa del Vercel SSO
- **Hem de diagnosticar via logs interns** del worker
- **El problema és intern**, no de connectivitat externa

### 🎯 **Objectiu Final:**
Identificar i solucionar exactament per què el worker no pot descarregar documents de Supabase Storage, utilitzant els logs detallats implementats.

## **Següent Pas Immediat**

**Executar un test real** accedint a la interfície web i generant un informe per veure els logs detallats del worker en acció.
