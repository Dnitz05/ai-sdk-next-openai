# 🔧 PLA DE REFACTORITZACIÓ: ELIMINACIÓ DE `service_role_key`

## Resum Executiu

S'han identificat **80 endpoints** que utilitzen `SUPABASE_SERVICE_ROLE_KEY`. Amb RLS ja implementat, la majoria d'aquests endpoints ja no necessiten la clau de servei i poden utilitzar el client estàndard de Supabase amb autenticació d'usuari.

---

## 📊 Anàlisi dels Endpoints Trobats

### **Endpoints de Producció Crítics** (Prioritat ALTA)
Aquests endpoints són utilitzats activament pels usuaris i poden estar causant l'error original:

1. **`app/api/save-configuration/route.ts`** ⚠️ CRÍTICA
   - Desa configuracions de plantilles
   - Comentari: "per bypassejar RLS (només després de verificar l'usuari)"

2. **`app/api/reports/generate-smart-enhanced/route.ts`** ⚠️ MOLT CRÍTICA
   - **Probablement relacionat amb l'error original**
   - Generació intel·ligent de documents

3. **`app/api/reports/projects/route.ts`** ⚠️ CRÍTICA
   - Llista projectes de l'usuari
   - Comentari: "per bypassejar RLS (només després de verificar l'usuari)"

4. **`app/api/update-template/[id]/route.ts`** ⚠️ CRÍTICA
   - Actualització de plantilles

5. **`app/api/delete-project/[id]/route.ts`** ⚠️ ALTA
   - Eliminació de projectes

6. **`app/api/upload-excel/route.ts`** ⚠️ ALTA
   - Pujada de fitxers Excel

### **Endpoints de Reports** (Prioritat ALTA)
7. `app/api/reports/generate/route.ts`
8. `app/api/reports/jobs-status/route.ts`
9. `app/api/reports/download-document/[generationId]/route.ts`
10. `app/api/reports/content/route.ts`
11. `app/api/reports/generations/route.ts`
12. `app/api/reports/generate-async/route.ts`

### **Endpoints de Gestió de Plantilles** (Prioritat MITJA)
13. `app/api/get-paragraph-ids/[templateId]/route.ts`
14. `app/api/regenerate-placeholder-docx/[templateId]/route.ts`
15. `app/api/upload-original-docx/route.ts`
16. `app/api/process-document/route.ts`

### **Endpoints de Debug/Testing** (Prioritat BAIXA)
17-40. Tots els endpoints `app/api/debug/*` (poden mantenir service_role_key per testing)

---

## 🎯 Estratègia de Refactorització

### **Fase A: Endpoints Crítics** (Implementar IMMEDIATAMENT)
Refactoritzar els 6 endpoints més crítics que probablement causen l'error original.

### **Fase B: Endpoints de Reports** (Següent setmana)
Refactoritzar tots els endpoints de `/reports/`

### **Fase C: Endpoints Auxiliars** (Quan sigui convenient)
Refactoritzar la resta d'endpoints de producció

### **Fase D: Endpoints de Debug** (Opcional)
Mantenir o refactoritzar segons necessitat

---

## 🔄 Patró de Refactorització

### **ABANS** (Problemàtic):
```typescript
// ❌ Utilitza service_role_key per bypassejar RLS
const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// ❌ Accedeix a totes les dades sense filtrar
const { data } = await serviceClient
  .from('plantilla_configs')
  .select('*')
  .eq('id', templateId);
```

### **DESPRÉS** (Segur amb RLS):
```typescript
// ✅ Utilitza client estàndard amb autenticació
import { createClient } from '@/lib/supabase/server';

// ✅ RLS filtra automàticament per user_id
const supabase = createClient();
const { data } = await supabase
  .from('plantilla_configs')
  .select('*')
  .eq('id', templateId); // RLS garanteix que només veu les seves
```

---

## 🚀 Pla d'Implementació Immediata

### **Endpoint 1: `app/api/reports/generate-smart-enhanced/route.ts`**
- **PRIORITAT MÀXIMA** (probablement causa l'error original)
- Refactoritzar per utilitzar client estàndard
- Eliminar dependència de service_role_key

### **Endpoint 2: `app/api/save-configuration/route.ts`**
- Crítica per a la funcionalitat de plantilles
- Refactoritzar verificació d'usuari + client estàndard

### **Endpoint 3: `app/api/reports/projects/route.ts`**
- Crítica per a la listado de projectes
- Simplificar amb RLS automàtic

---

## ✅ Beneficis Esperats

### **Resolució de l'Error Original:**
L'error "Plantilla no trobada" probablement es resol perquè:
- Les consultes seran coherents amb el que l'usuari pot veure
- No hi haurà inconsistències entre frontend i backend
- RLS garanteix filtratge automàtic correcte

### **Millora de Seguretat:**
- Eliminació completa del risc de service_role_key
- Simplificació del codi (menys clients diferents)
- Reducció de la superfície d'atac

### **Millora de Manteniment:**
- Codi més simple i consistent
- Menys configuració de variables d'entorn
- Logging i debugging més fàcil

---

## 📋 Checklist de Refactorització

### Per a cada endpoint:
- [ ] Identificar operacions que es fan amb service_role_key
- [ ] Verificar que RLS cobreix aquests casos d'ús
- [ ] Substituir `createClient` amb service_role_key per client estàndard
- [ ] Eliminar verificacions manuals d'user_id (RLS ho fa automàticament)
- [ ] Testejar que l'endpoint funciona correctament
- [ ] Verificar que no pot accedir a dades d'altres usuaris

### Validació final:
- [ ] L'error "Plantilla no trobada" es resol
- [ ] Tots els endpoints funcionen amb autenticació normal
- [ ] Cap endpoint pot accedir a dades d'altres usuaris
- [ ] Tests de seguretat passen correctament

---

## ⚠️ Riscos i Mitigacions

### **Risc: Endpoints que realment necessiten privileges elevats**
- **Mitigació**: Revisar cas per cas els endpoints d'administració
- **Exemples**: Cleanup, estadístiques globals, migracions

### **Risc: Trencar funcionalitat existent**
- **Mitigació**: Refactoritzar un endpoint cada vegada
- **Mitigació**: Testejar exhaustivament cada canvi

### **Risc: Problemes de rendiment amb RLS**
- **Mitigació**: Monitoritzar consultes després dels canvis
- **Mitigació**: Optimitzar índexos si cal

---

## 📅 Timeline Proposat

### **Dia 1-2: Fase A - Endpoints Crítics**
- `app/api/reports/generate-smart-enhanced/route.ts`
- `app/api/save-configuration/route.ts`
- `app/api/reports/projects/route.ts`

### **Dia 3-4: Fase A continuació**
- `app/api/update-template/[id]/route.ts`
- `app/api/delete-project/[id]/route.ts`
- `app/api/upload-excel/route.ts`

### **Setmana següent: Fase B**
- Tots els endpoints `/reports/`

---

## 🎯 Objectiu Final

**Eliminar completament l'ús de `SUPABASE_SERVICE_ROLE_KEY`** de tots els endpoints de producció, deixant només els endpoints de debug/administració que realment necessitin privileges elevats.

**Resultat esperat:** L'error "Plantilla no trobada" es resol i el sistema és 100% segur per defecte.
