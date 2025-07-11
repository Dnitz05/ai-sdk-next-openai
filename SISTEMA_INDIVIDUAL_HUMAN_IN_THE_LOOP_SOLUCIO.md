# Sistema Individual amb Human-in-the-Loop - Solució Completa

**Data**: 10 de juliol de 2025  
**Problema resolt**: Error "Plantilla no trobada" en el flux principal individual  
**Enfocament**: Human-in-the-loop com a solució principal (NO generació massiva)  
**Estat**: Implementació completa i testejada

## 🎯 Problemes Resolts

### 1. Error "Plantilla no trobada"
- **Causa identificada**: La plantilla amb ID `365429f4-25b3-421f-a04e-b646d1e3939d` no existeix o està corrompuda
- **Solució**: Sistema step-by-step que permet a l'humà seleccionar plantilla vàlida

### 2. Falta d'interacció humana en el flux principal
- **Problema**: L'error s'ha de resoldre amb intervenció humana
- **Solució**: Sistema de 4 passos amb human-in-the-loop per cada generació individual

## 🚀 Solució Implementada: Sistema Human-in-the-Loop

### Endpoint Principal: `POST /api/reports/generate-individual-enhanced`

**Filosofia**: Cada generació de document individual passa per 4 passos amb confirmació humana

### 📋 Flux Step-by-Step

#### **STEP 1: PREPARE** - Selecció de Plantilla
L'humà selecciona la plantilla i revisa les dades

```javascript
// Petició: Iniciar procés
POST /api/reports/generate-individual-enhanced
{
  "step": "prepare",
  "templateId": "365429f4-25b3-421f-a04e-b646d1e3939d", // Opcional
  "documentData": {
    "contractista": "Empresa A",
    "obra": "Projecte 1",
    "import": 15000
  }
}

// Resposta: Opcions per l'humà
{
  "success": true,
  "step": "prepare",
  "humanInteractionRequired": true,
  "message": "Selecciona la plantilla i confirma les dades per continuar",
  "data": {
    "templateInvestigation": {
      "templateId": "365429f4-25b3-421f-a04e-b646d1e3939d",
      "exists": false,
      "issues": ["Plantilla no existeix a la base de dades"]
    },
    "availableTemplates": {
      "count": 3,
      "templates": [
        {"id": "abc123", "name": "Plantilla Contractes", "isValid": true}
      ]
    },
    "recommendations": [
      "Plantilla especificada té problemes: Plantilla no existeix a la base de dades",
      "Recomanació: Utilitzar 'Plantilla Contractes' (plantilla més recent)"
    ]
  },
  "userActions": {
    "required": [
      "Seleccionar plantilla vàlida",
      "Revisar dades del document",
      "Confirmar per continuar"
    ],
    "options": {
      "selectTemplate": "Tria un ID de plantilla de les disponibles",
      "useRecommended": "abc123"
    }
  }
}
```

#### **STEP 2: CONFIRM** - Confirmació de Configuració
L'humà revisa mapatge de dades i confirma

```javascript
// Petició: Confirmar configuració
POST /api/reports/generate-individual-enhanced
{
  "step": "confirm",
  "templateId": "abc123", // ID seleccionat per l'humà
  "documentData": {
    "contractista": "Empresa A",
    "obra": "Projecte 1",
    "import": 15000
  },
  "userInteraction": {
    "customInstructions": "Generar amb format professional"
  }
}

// Resposta: Previsualització per revisar
{
  "success": true,
  "step": "confirm",
  "humanInteractionRequired": true,
  "message": "Revisa la configuració i confirma per generar el document",
  "data": {
    "selectedTemplate": {
      "id": "abc123",
      "name": "Plantilla Contractes"
    },
    "placeholders": {
      "total": 5,
      "list": [
        {"id": "CONTRACTISTA", "instruction": "Nom del contractista"},
        {"id": "OBRA", "instruction": "Descripció de l'obra"}
      ]
    },
    "dataMapping": {
      "mapped": {"CONTRACTISTA": "Empresa A", "OBRA": "Projecte 1"},
      "unmapped": ["IMPORT"],
      "issues": ["1 placeholders no tenen dades corresponents"]
    },
    "preview": {
      "sampleSubstitution": [
        {"placeholder": "{CONTRACTISTA: Nom del contractista}", "value": "Empresa A"}
      ]
    }
  },
  "userActions": {
    "options": {
      "proceedWithGeneration": "Generar document amb aquesta configuració",
      "modifyData": "Modificar dades del document",
      "changeTemplate": "Canviar plantilla"
    }
  }
}
```

#### **STEP 3: GENERATE** - Generació del Document
El sistema genera el document amb la configuració confirmada

```javascript
// Petició: Generar document
POST /api/reports/generate-individual-enhanced
{
  "step": "generate",
  "templateId": "abc123",
  "documentData": {
    "contractista": "Empresa A",
    "obra": "Projecte 1",
    "import": 15000
  }
}

// Resposta: Document generat
{
  "success": true,
  "step": "generate",
  "humanInteractionRequired": true,
  "message": "Document generat amb èxit! Revisa el resultat",
  "data": {
    "generationId": "gen_1720634567890",
    "document": {
      "id": "doc_123",
      "status": "completed"
    },
    "processingTime": 8500,
    "placeholderValues": {
      "CONTRACTISTA": "Empresa A",
      "OBRA": "Projecte 1"
    }
  },
  "userActions": {
    "options": {
      "downloadDocument": "/api/reports/download-smart/gen_1720634567890/0",
      "reviewDocument": "Passar al step de revisió",
      "generateAnother": "Generar un altre document"
    }
  }
}
```

#### **STEP 4: REVIEW** - Revisió Final
L'humà revisa el document final i decideix els següents passos

```javascript
// Petició: Revisar resultat
POST /api/reports/generate-individual-enhanced
{
  "step": "review",
  "documentData": {
    "contractista": "Empresa A",
    "obra": "Projecte 1",
    "import": 15000
  }
}

// Resposta: Procés completat
{
  "success": true,
  "step": "review",
  "humanInteractionRequired": true,
  "message": "Procés completat. Revisa el document final",
  "data": {
    "completedAt": "2025-07-10T18:03:45.123Z"
  },
  "userActions": {
    "options": {
      "generateAnother": "Generar un altre document",
      "startNewProcess": "Començar nou procés de generació",
      "finishSession": "Finalitzar sessió"
    }
  }
}
```

## 🧑‍💼 Beneficis del Human-in-the-Loop

### 1. Resolució Intel·ligent d'Errors
- **Detecció automàtica** de plantilles problemàtiques
- **Recomanacions humanes** per seleccionar alternatives
- **Validació step-by-step** abans de processar

### 2. Control Total per l'Usuari
- **Selecció manual** de plantilla en cada generació
- **Revisió completa** de dades i mapatge
- **Confirmació explícita** abans de generar
- **Instruccions personalitzades** opcionals

### 3. Transparència Completa
- **Investigació detallada** de plantilles problemàtiques
- **Previsualització** del mapatge de dades
- **Informació clara** sobre que passarà en cada step

### 4. Flexibilitat Màxima
- **Canviar plantilla** en qualsevol moment
- **Modificar dades** abans de generar
- **Afegir instruccions** personalitzades
- **Cancel·lar procés** si cal

## 🔧 Implementació Tècnica

### Característiques del Sistema

1. **Gestió d'Estats**
   - Cada step té la seva lògica específica
   - Validacions independents per cada fase
   - Recuperació d'errors robusta

2. **Investigació de Plantilles**
   - Validació d'existència i contingut
   - Detecció de problemes específics
   - Recomanacions automàtiques

3. **Mapatge Intel·ligent**
   - Extracció automàtica de placeholders
   - Mapatge de dades flexible
   - Detecció de dades mancants

4. **Interfície Humana Clara**
   - Missatges descriptius per cada step
   - Opcions d'acció clares
   - Informació contextual completa

## 🧪 Com Utilitzar el Sistema

### Flux Complet d'Exemple

```javascript
// 1. Iniciar procés amb plantilla problemàtica
const step1 = await fetch('/api/reports/generate-individual-enhanced', {
  method: 'POST',
  body: JSON.stringify({
    step: 'prepare',
    templateId: '365429f4-25b3-421f-a04e-b646d1e3939d', // Problemàtica
    documentData: {contractista: 'Empresa A', obra: 'Projecte 1'}
  })
});
// → Resposta: Plantilla problemàtica, recomanacions d'alternatives

// 2. Confirmar amb plantilla vàlida
const step2 = await fetch('/api/reports/generate-individual-enhanced', {
  method: 'POST',
  body: JSON.stringify({
    step: 'confirm',
    templateId: 'abc123', // Plantilla vàlida seleccionada per l'humà
    documentData: {contractista: 'Empresa A', obra: 'Projecte 1'}
  })
});
// → Resposta: Previsualització, mapatge de dades per revisar

// 3. Generar document
const step3 = await fetch('/api/reports/generate-individual-enhanced', {
  method: 'POST',
  body: JSON.stringify({
    step: 'generate',
    templateId: 'abc123',
    documentData: {contractista: 'Empresa A', obra: 'Projecte 1'}
  })
});
// → Resposta: Document generat, URL de descàrrega

// 4. Revisió final
const step4 = await fetch('/api/reports/generate-individual-enhanced', {
  method: 'POST',
  body: JSON.stringify({
    step: 'review',
    documentData: {contractista: 'Empresa A', obra: 'Projecte 1'}
  })
});
// → Resposta: Procés completat, opcions per continuar
```

## ✅ Resolució del Problema Original

### Error "Plantilla no trobada"
**Abans**:
```
Failed to load resource: the server responded with a status of 404
Error en generació intel·ligent: Error: Plantilla no trobada
```

**Ara** (Step 1 - Prepare):
```json
{
  "templateInvestigation": {
    "templateId": "365429f4-25b3-421f-a04e-b646d1e3939d",
    "exists": false,
    "issues": ["Plantilla no existeix a la base de dades"]
  },
  "recommendations": [
    "Plantilla especificada té problemes: Plantilla no existeix a la base de dades",
    "Recomanació: Utilitzar 'Plantilla Contractes' (plantilla més recent)"
  ],
  "userActions": {
    "selectTemplate": "Tria un ID de plantilla de les disponibles",
    "useRecommended": "abc123"
  }
}
```

L'humà pot veure el problema, rebre recomanacions i seleccionar una plantilla vàlida.

## 🎉 Conclusió

### Sistema Principal: Human-in-the-Loop Individual

✅ **Error resolt**: "Plantilla no trobada" es gestiona amb interacció humana  
✅ **Flux principal**: Generació individual step-by-step amb confirmació humana  
✅ **Control total**: L'usuari decideix en cada pas del procés  
✅ **Transparència**: Informació completa sobre problemes i solucions  
✅ **Flexibilitat**: Permet modificacions i canvis en qualsevol moment  

### Beneficis Clau
- **100% controlat per l'humà**: Cada decisió es pren amb intervenció humana
- **Resolució intel·ligent**: Detecció automàtica de problemes amb recomanacions
- **Flux clar**: 4 passos ben definits amb confirmació explícita
- **Informació completa**: L'usuari sempre sap què està passant i per què

El sistema està llest per producció com a flux principal per generació individual de documents amb human-in-the-loop.
