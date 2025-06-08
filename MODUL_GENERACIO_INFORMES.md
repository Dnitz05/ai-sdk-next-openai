# MÒDUL DE GENERACIÓ D'INFORMES - ESPECIFICACIÓ TÈCNICA

**Versió**: 1.0  
**Data**: Desembre 2024  
**Estat**: Aprovat per implementació  

---

## 📋 RESUM EXECUTIU

### Context Actual
El **Mòdul de Plantilles** està complet i operatiu. Els usuaris poden:
- ✅ Crear i editar plantilles DOCX amb prompts IA i links Excel
- ✅ Generar `placeholder.docx` amb "receptes" JSON
- ✅ Gestionar metadades i configuracions

### Objectiu del Nou Mòdul
Construir la funcionalitat central que permet:
- 🎯 Generar informes finals a partir de plantilles + dades Excel
- 🤖 Interactuar amb Mistral AI per refinar contingut
- 📊 Gestionar progrés de treball de manera persistent

---

## 🔬 ANÀLISI TÈCNICA REALITZADA

### Problemes Identificats en l'Especificació Original
1. **Esquema de BD insuficient**: Faltava persistència de dades Excel
2. **Performance crítica**: API síncrona causaria timeouts
3. **Gestió d'errors mancant**: Sense resilència davant fallides
4. **Seguretat oblidada**: Faltaven RLS policies
5. **Historial inexistent**: Sense versionat de refinaments

### Solucions Arquitectòniques Proposades
- **Esquema BD amb JSONB** per dades Excel i fila-específiques
- **Sistema async** amb cues per escalabilitat
- **Gestió d'errors** amb retry logic i fallback
- **Versionat de contingut** per historial de refinaments
- **Control de costos** amb limits per usuari

---

## 🏗️ PLA D'IMPLEMENTACIÓ PER FASES

### FASE 1: MVP Funcional i Segur ⏱️ [ACTUAL]

**Objectiu**: Cicle complet funcional per validar UX i qualitat IA

#### Base de Dades
```sql
-- Noves taules
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES plantilla_configs(id) ON DELETE CASCADE,
    project_name TEXT NOT NULL,
    excel_filename TEXT NOT NULL,
    excel_data JSONB, -- ✅ AFEGIT: Dades processades
    total_rows INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    excel_row_index INTEGER NOT NULL,
    row_data JSONB, -- ✅ AFEGIT: Dades de la fila específica
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT, -- ✅ AFEGIT: Gestió d'errors
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, excel_row_index)
);

CREATE TABLE generated_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
    placeholder_id TEXT NOT NULL,
    final_content TEXT,
    is_refined BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### APIs Backend
- `GET /api/reports/projects` - Llista projectes usuari
- `GET /api/reports/generations?project_id=[id]` - Estat informes
- `POST /api/generate-report-row` - **Motor Principal (síncron)**
- `PUT /api/refine-content/[contentId]` - Taller d'iteració

#### Frontend
- Pàgina `/informes` - Gestió de projectes
- Pàgina `/informes/[projectId]` - **Taller de Generació (3 panells)**
  - Esquerre: Files Excel amb estats
  - Central: Vista prèvia document
  - Dret: Refinament de contingut

#### Criteris de Qualitat
- ⚠️ **Risc calculat**: API síncrona (màx 15-20 segons)
- 🛡️ **Seguretat**: RLS policies obligatòries
- 🚨 **UX d'errors**: Visual feedback amb tooltips explicatius

### FASE 2: Sistema Production-Ready ⏱️ [FUTUR]

**Triggers per migració**:
- Temps de generació > 15-20 segons consistentment
- Més de 10 usuaris concurrent
- Demanda de funcionalitats avançades

#### Millores Arquitectòniques
```typescript
// Sistema de Cues Async
POST /api/start-generation → retorna job_id
GET /api/generation-status/[job_id] → polling
WebSocket /generations → real-time updates

// Control de Costos
CREATE TABLE api_usage (
    user_id UUID,
    date DATE,
    mistral_tokens_used INTEGER,
    cost_estimate DECIMAL(10,4)
);

// Versionat de Contingut
CREATE TABLE content_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generated_content_id UUID REFERENCES generated_content(id),
    version_number INTEGER,
    content TEXT,
    refinement_instruction TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Funcionalitats Avançades
- 🔄 **Cues asíncrones** amb Redis/BullMQ
- 💰 **Gestió de costos** amb límits per usuari
- 📚 **Historial de versions** per cada refinament
- ⚡ **Real-time updates** via WebSockets
- 🔁 **Retry logic** automàtic amb exponential backoff

---

## ⚙️ ARQUITECTURA TÈCNICA

### Motor de Processament de Placeholders

```
placeholder.docx → Extreure JSON placeholders → Per cada placeholder
                                                      ↓
                    ┌─────────────────────────────────┴─────────────────────────────────┐
                    ↓                                 ↓                                 ↓
                 Excel                               IA                            Combinat
                    ↓                                 ↓                                 ↓
        Substituir amb dades fila          Construir prompt                    Excel + IA
                    ↓                                 ↓                                 ↓
              Contingut final                Crida Mistral AI                  Crida Mistral AI
                    ↓                                 ↓                                 ↓
                    └─────────────────────→ Desar a BD ←─────────────────────────────────┘
```

### Integració Mistral AI

```typescript
// System Prompt
export const ADMIN_ASSISTANT_PROMPT = `
Ets un assistent expert en la redacció de documents tècnics i administratius. 
La teva comunicació ha de ser sempre formal, objectiva i precisa. 
Basa les teves respostes estrictament en la informació i el context proporcionats.
No has d'inventar informació ni expressar opinions personals. 
El format de sortida ha de ser text pla, ben estructurat en paràgrafs.
`;

// Construcció de Prompts
const prompt = `
${ADMIN_ASSISTANT_PROMPT}

CONTEXT: ${aiInstruction.prompt}
DADES EXCEL: ${JSON.stringify(rowData)}
TEXT BASE: ${baseText}

INSTRUCCIÓ: Genera el contingut final per aquest paràgraf.
`;
```

---

## 🎯 CRITERIS DE DECISIÓ

### Quan Migrar a Fase 2?
- **Performance**: Temps > 15-20 segons consistentment
- **Escala**: >10 usuaris concurrent o >100 generacions/dia
- **Funcionalitat**: Demanda d'historial o control de costos

### Mètriques de Validació MVP
- ✅ **UX**: Usuaris entenen interfície 3 panells?
- ✅ **Qualitat IA**: Resultats Mistral són útils?
- ✅ **Workflow**: Procés refinament és intuïtiu?

---

## 📦 ENTREGABLES FASE 1

### Backend
- [ ] Migracions SQL amb esquema BD millorat
- [ ] 4 APIs implementades amb gestió d'errors
- [ ] Integració Mistral AI amb system prompts
- [ ] RLS policies per totes les taules

### Frontend
- [ ] Pàgina `/informes` amb gestió projectes
- [ ] Taller de generació amb 3 panells interactius
- [ ] Components per estats d'error i progrés
- [ ] Integració amb mòdul de plantilles existent

### Configuració
- [ ] Variable d'entorn `MISTRAL_API_KEY`
- [ ] System prompts a `lib/ai/system-prompts.ts`

---

## 🔐 CONFIGURACIÓ SEGURETAT

### Row Level Security Policies
```sql
-- Projects
CREATE POLICY "Users can only access their own projects" ON projects
FOR ALL USING (auth.uid() = user_id);

-- Generations
CREATE POLICY "Users can only access generations from their projects" ON generations
FOR ALL USING (
    project_id IN (
        SELECT id FROM projects WHERE user_id = auth.uid()
    )
);

-- Generated Content
CREATE POLICY "Users can only access their generated content" ON generated_content
FOR ALL USING (
    generation_id IN (
        SELECT g.id FROM generations g
        JOIN projects p ON g.project_id = p.id
        WHERE p.user_id = auth.uid()
    )
);
```

---

## 🚀 ESTAT ACTUAL

**APROVAT** per implementació immediata de **FASE 1**

**Pròxims passos**:
1. ✅ Configurar variables d'entorn
2. ✅ Executar migracions SQL
3. ✅ Implementar APIs backend
4. ✅ Construir interfícies frontend
5. ✅ Integrar amb mòdul existent

---

## 📚 CONFIGURACIÓ API MISTRAL

### Variables d'entorn
```env
MISTRAL_API_KEY=6FaWCBugO4u5ZuOB98VWm5thDMfkox83
```

### Endpoints Mistral
- **Base URL**: `https://api.mistral.ai/v1/`
- **Model recomanat**: `mistral-large-latest` per qualitat òptima
- **Model alternatiu**: `mistral-medium-latest` per cost/velocitat

### Configuració de Requests
```typescript
const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
  },
  body: JSON.stringify({
    model: 'mistral-large-latest',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1, // Baixa per consistència
    max_tokens: 1000  // Ajustar segons necessitat
  })
});
```

---

*Document creat com a referència tècnica per al desenvolupament del Mòdul de Generació d'Informes*
