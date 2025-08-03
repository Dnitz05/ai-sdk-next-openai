# Anàlisi d'Arquitectura del Projecte de Generació d'Informes

**Data:** 03 d'agost de 2025
**Autor:** Roo (Technical Leader)

## 1. Visió General del Projecte

Aquest projecte és una aplicació web avançada dissenyada per automatitzar la creació de documents complexos. El seu nucli funcional permet als usuaris pujar plantilles de documents `.docx` i fitxers de dades `.xlsx`. Posteriorment, el sistema utilitza intel·ligència artificial per omplir intel·ligentment les plantilles amb les dades corresponents, generant múltiples informes personalitzats i coherents. L'aplicació inclou funcionalitats per a la gestió de projectes, edició de plantilles, i generació de documents tant de manera individual com en lots.

---

## 2. Pila Tecnològica (Tech Stack)

El projecte es construeix sobre un stack tecnològic modern i robust, aprofitant serveis al núvol i llibreries de codi obert capdavanteres.

*   **Framework:** Next.js 14+ (amb App Router)
*   **Llenguatge:** TypeScript (en mode estricte)
*   **Base de Dades i Autenticació:** Supabase (Auth, PostgreSQL, Storage)
*   **Intel·ligència Artificial:**
    *   **Orquestració:** Vercel AI SDK
    *   **Model de Llenguatge:** Mistral AI (amb integracions preparades per a OpenAI, Google AI, etc.)
    *   **Anàlisi de Documents (Opcional):** Google Document AI
*   **Generació de Documents:** `docxtemplater` amb `xlsx` per al processament de plantilles i dades.
*   **Frontend:** React, Tailwind CSS
*   **Validació de Dades:** Zod
*   **Testing:** Jest, React Testing Library

---

## 3. Diagrama d'Arquitectura

El següent diagrama il·lustra els components principals del sistema i les seves interaccions:

```mermaid
graph TD
    subgraph Client [Client - Navegador]
        direction LR
        UI_Pages[Pàgines React - Next.js]
        TemplateEditor[Editor de Plantilles]
        State[Gestió d'Estat <br> useState, useSupabase]
        
        UI_Pages -- Edita --> TemplateEditor
        UI_Pages -- Gestiona --> State
    end

    subgraph Vercel_Platform [Plataforma Vercel]
        direction LR
        subgraph NextServer [Servidor Next.js]
            direction TB
            API_Gateway[API Routes]
            Worker[Worker API <br> /api/worker/generation-processor]
            SmartProcessor[lib/smart/SmartDocumentProcessor]
        end
    end

    subgraph ExternalServices [Serveis Externs]
        direction LR
        subgraph Supabase
            Auth[Auth]
            DB[PostgreSQL <br> Dades, Projectes, Generacions]
            Storage[Storage <br> Plantilles, Excels, Documents Generats]
        end
        Mistral[Mistral AI API]
        GoogleAI[Google Document AI <br> (Opcional - Anàlisi)]
    end

    %% Flux d'Autenticació
    UI_Pages -- 1. Login/Signup --> Auth
    Auth -- 2. Retorna Sessió/JWT --> UI_Pages

    %% Flux de Preparació
    TemplateEditor -- 3. Puja Plantilla/Excel --> API_Gateway
    API_Gateway -- 4. Guarda a --> Storage

    %% Flux de Generació Principal
    UI_Pages -- 5. Inicia Generació --> API_Gateway
    API_Gateway -- 6. Dispara Worker --> Worker
    Worker -- Utilitza --> SmartProcessor
    
    SmartProcessor -- 7. Llegeix Plantilla de --> Storage
    SmartProcessor -- 8. Llegeix Dades de --> DB
    SmartProcessor -- 9. Crida per generar contingut --> Mistral
    Mistral -- 10. Retorna contingut JSON --> SmartProcessor
    SmartProcessor -- 11. Genera .docx i puja a --> Storage
    SmartProcessor -- 12. Actualitza estat a --> DB
    
    Worker -- 13. Retorna èxit/error --> API_Gateway
    API_Gateway -- 14. Retorna resultat --> UI_Pages

    classDef client fill:#D9E5FF,stroke:#3366CC
    classDef vercel fill:#F0F0F0,stroke:#333
    classDef external fill:#E0F2F1,stroke:#00796B
    
    class Client client
    class Vercel_Platform vercel
    class ExternalServices external
```

---

## 4. Anàlisi de Components Clau

### Backend
El backend està implementat com a API Routes de Next.js. La peça central és el `SmartDocumentProcessor`, una classe a `lib/` que conté tota la lògica de negoci. El flux de generació és asíncron, utilitzant un patró `trigger/worker`:
1.  **API Trigger (`/api/reports/generate-smart-enhanced`):** Un endpoint lleuger que rep la petició de l'usuari, valida les dades i dispara el worker.
2.  **API Worker (`/api/worker/generation-processor`):** Un endpoint dissenyat per a tasques de llarga durada. Executa el `SmartDocumentProcessor`, que orchestra la comunicació amb Supabase (BBDD, Storage) i Mistral AI.
3.  **Prompt Engineering:** El sistema construeix prompts dinàmics i molt estructurats, exigint respostes en format JSON a la IA per a més fiabilitat.

### Frontend
La interfície d'usuari, construïda amb React, està ben organitzada en pàgines i components reutilitzables.
*   **Autenticació:** Es gestiona amb les llibreries de Supabase. Cada pàgina protegida verifica l'estat de la sessió de l'usuari en carregar-se.
*   **Gestió d'Estat:** Es basa en l'estat local dels components (`useState`) i el context de React (`useContext`) per a la distribució del client de Supabase, evitant la necessitat de llibreries d'estat globals més pesades.
*   **Editor de Plantilles:** El component `TemplateEditor` és una de les funcionalitats més potents, permetent als usuaris definir els placeholders intel·ligents directament des de la interfície.

---

## 5. Anàlisi Estratègica i Recomanacions

### ✅ Fortaleses
*   **Arquitectura Sòlida i Moderna:** El projecte és mantenible i escalable.
*   **Motor de Generació Potent:** El `SmartDocumentProcessor` és robust, resilient i eficient.
*   **Alta Qualitat del Codi:** L'ús d'eines com TypeScript estricte i `Zod` assegura la fiabilitat.

### 🔧 Oportunitats de Millora
1.  **Centralitzar l'Autenticació amb Middleware:** Refactoritzar la protecció de rutes utilitzant `middleware.ts` per eliminar codi duplicat i millorar la seguretat.
2.  **Optimitzar la Càrrega de Dades:** Migrar la càrrega de dades del client al servidor en les pàgines per millorar el rendiment percebut.
3.  **Netejar el Codi de Depuració:** Eliminar la extensa carpeta `app/api/debug` per reduir el deute tècnic.
4.  **Implementar un Sistema de Cues:** Per a futures necessitats de generació massiva, introduir una cua (ex: Vercel KV) per desacoblar el trigger i el worker, augmentant l'escalabilitat.

### ⚠️ Riscos Potencials
*   **Dependència de Serveis Externs:** El funcionament depèn críticament de Supabase i Mistral AI.
*   **Costos d'Escalat:** L'ús de la IA té un cost variable que cal monitorar.
*   **Fragilitat dels Prompts:** Canvis en el comportament del model d'IA podrien requerir ajustos als prompts.

---

## 6. Conclusió Final

El projecte està construït sobre una base tècnica excel·lent i resol un problema de negoci complex d'una manera innovadora i robusta. Les debilitats identificades són menors i es poden resoldre amb refactoritzacions puntuals. Les recomanacions se centren en enfortir encara més l'arquitectura de cara al futur creixement i l'escalabilitat. En general, el projecte és un exemple clar d'una aplicació web moderna, ben dissenyada i potent.