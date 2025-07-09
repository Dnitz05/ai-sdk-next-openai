# Solució Òptima i Escalable per Generació Intel·ligent Individual

## Anàlisi del Problema Actual

### 1. Error "Plantilla no trobada" (404)
- **Causa arrel**: L'API `/api/reports/projects` retorna `excel_data: null` per projectes amb >100 files
- **Impacte**: El botó de generació intel·ligent no pot funcionar sense les dades Excel

### 2. Arquitectura Fragmentada
- **3 sistemes diferents**: Jobs asíncrons, Smart batch, Individual
- **Taules separades**: `generation_jobs`, `smart_generations`, `generations`
- **Duplicació de lògica**: Cada sistema reimplementa la generació

### 3. Requisits de l'Usuari
- **Human-in-the-loop**: Revisió i control sobre cada document
- **Generació individual intel·ligent**: No batch/massiva
- **Qualitat sobre velocitat**: Prefereix revisar cada document

## Solució Proposada: Sistema Unificat Intel·ligent

### Arquitectura Nova

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
├─────────────────────────────────────────────────────────────┤
│                  API Layer (Next.js)                        │
│  ┌─────────────────┐  ┌──────────────────┐                │
│  │ /generate-smart  │  │ /review-document │                │
│  │   -individual    │  │                  │                │
│  └────────┬─────────┘  └────────┬─────────┘                │
│           │                      │                          │
├───────────┴──────────────────────┴──────────────────────────┤
│                 Smart Generation Service                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         SmartDocumentProcessor (Modified)           │   │
│  │  - processSingle() - Nova funció per 1 document     │   │
│  │  - preserveContext() - Manté coherència entre docs  │   │
│  │  - reviewMode() - Permet edició post-generació      │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    Database Layer                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  generations (taula existent, reutilitzada)         │   │
│  │  + smart_content JSONB - Nou camp per IA content    │   │
│  │  + review_status - pendent/revisat/aprovat          │   │
│  │  + ai_metadata - Info sobre la generació IA         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Avantatges de la Solució

1. **Unificació**: Un sol sistema per totes les generacions
2. **Escalabilitat**: Pot processar 1 o 1000 documents
3. **Flexibilitat**: Suporta batch i individual
4. **Coherència**: Manté context entre documents
5. **Human-in-the-loop**: Revisió integrada en el flux

## Implementació Detallada

### Fase 1: Fix Immediat (1-2 hores)

1. **Corregir l'error 404**
   - Modificar `/api/reports/generate-smart` per carregar excel_data si és null
   - Alternativa: Passar només els IDs i carregar dades a demanda

2. **Afegir mode individual al SmartProcessor**
   ```typescript
   async processSingle(
     templateId: string,
     rowData: any,
     rowIndex: number,
     previousContext?: any
   ): Promise<SingleDocumentResult>
   ```

### Fase 2: Sistema Unificat (4-6 hores)

1. **Modificar taula `generations`**
   ```sql
   ALTER TABLE generations 
   ADD COLUMN smart_content JSONB,
   ADD COLUMN review_status TEXT DEFAULT 'pending',
   ADD COLUMN ai_metadata JSONB,
   ADD COLUMN ai_processing_time INTEGER;
   ```

2. **Nova API endpoint**
   ```typescript
   // /api/reports/generate-smart-individual
   - Accepta generation_id individual
   - Utilitza SmartDocumentProcessor.processSingle()
   - Guarda resultat a generations.smart_content
   - Retorna per revisió immediata
   ```

3. **UI Components nous**
   ```typescript
   // SmartGenerationButton.tsx
   - Botó per cada document individual
   - Modal de revisió post-generació
   - Opcions: Acceptar, Modificar, Regenerar
   
   // SmartReviewModal.tsx
   - Mostra document generat
   - Permet edició inline
   - Historial de canvis
   ```

### Fase 3: Migració i Optimització (2-3 hores)

1. **Script de migració**
   - Migrar dades de `smart_generations` a `generations`
   - Unificar lògica de jobs

2. **Optimitzacions**
   - Cache de plantilles en Redis
   - Lazy loading de excel_data
   - Streaming de resultats grans

## Flux de Treball Final

```mermaid
graph TD
    A[Usuari selecciona document] --> B[Click "Generar Intel·ligent"]
    B --> C[API carrega dades necessàries]
    C --> D[SmartProcessor.processSingle()]
    D --> E[Mistral AI genera contingut]
    E --> F[Mostra resultat en modal]
    F --> G{Usuari revisa}
    G -->|Accepta| H[Guarda a BD]
    G -->|Modifica| I[Editor inline]
    G -->|Regenera| D
    I --> J[Guarda canvis]
    H --> K[Següent document]
    J --> K
```

## Gestió d'Errors i Edge Cases

1. **Projectes grans (>100 files)**
   - Carregar excel_data sota demanda
   - Paginar resultats
   - Utilitzar streaming

2. **Coherència entre documents**
   - Mantenir context de documents previs
   - Opció de "aplicar a tots els similars"

3. **Errors de xarxa**
   - Retry automàtic amb backoff
   - Guardar drafts localment
   - Recuperació de sessió

## Mètriques i Monitorització

- Temps de generació per document
- Taxa d'acceptació vs modificació
- Errors per tipus
- Ús de tokens Mistral AI

## Conclusió

Aquesta solució unifica els sistemes existents, resol els problemes immediats i proporciona una base sòlida per al futur. És escalable, mantenible i alineada amb les necessitats de l'usuari.
