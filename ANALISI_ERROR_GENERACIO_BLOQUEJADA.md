# Anàlisi Tècnica de l'Error de Generacions Bloquejades

## 1. Descripció del Problema

S'ha detectat un error crític en el sistema de generació d'informes. En iniciar una generació seqüencial per a un projecte, el procés es queda bloquejat indefinidament. La interfície d'usuari mostra el primer informe en estat "Processant...", però aquest estat no canvia mai, impedint que la resta d'informes de la cua es processin i sense donar cap missatge d'error clar a l'usuari.

## 2. Arquitectura del Sistema de Generació Asíncrona

La investigació ha revelat una arquitectura distribuïda de tres components principals que participen en la generació d'un informe individual:

1.  **Frontend (Client-Side Logic):** El codi del client (React) gestiona la cua de generacions. Per a cada informe pendent, realitza una crida a l'API disparadora. Està ubicat a les pàgines sota `app/informes/[projectId]/...`.
2.  **API Disparadora (Trigger):** Un endpoint de l'API de Next.js que rep la petició del frontend per a un sol informe. La seva funció és preparar i llançar la tasca en segon pla. L'endpoint responsable és:
    *   `app/api/reports/generate-smart-enhanced/route.ts`
3.  **Worker de Processament:** Un altre endpoint de l'API que realitza la feina pesada: contacta amb la IA, genera el contingut i construeix el document. Aquest és cridat per l'API Disparadora. L'endpoint responsable és:
    *   `app/api/worker/generation-processor/route.ts`

El flux és: **Frontend** -> **API Disparadora** -> **Worker**.

## 3. Identificació de la Causa Arrel

El problema era una fallada en cascada amb dues causes arrel diferents en dos punts de la cadena.

### Causa Arrel #1: Bloqueig Indefinit en el Worker

El primer problema es trobava dins de la lògica del worker, específicament a la classe `SmartDocumentProcessor`.

*   **Fitxer:** [`lib/smart/SmartDocumentProcessor.ts`](lib/smart/SmartDocumentProcessor.ts:752)
*   **Funció:** `downloadTemplateFromStorage()`
*   **Problema:** Aquesta funció, responsable de descarregar la plantilla DOCX des de Supabase Storage, **no tenia un mecanisme de timeout**. Si la connexió a Supabase Storage es quedava bloquejada per qualsevol motiu, la promesa de descàrrega mai es resolia, deixant el worker penjat indefinidament.

### Causa Arrel #2: Gestió d'Errors Inexistent a l'API Disparadora

El segon i més subtil problema estava en com l'API disparadora invocava el worker.

*   **Fitxer:** [`app/api/reports/generate-smart-enhanced/route.ts`](app/api/reports/generate-smart-enhanced/route.ts)
*   **Problema:** L'endpoint utilitzava un patró **"fire-and-forget"**. Cridava al worker però **no utilitzava `await`** per esperar la seva resposta. Simplement llançava la petició i retornava un `202 Accepted` al frontend.
*   **Conseqüència:** Quan el worker fallava (ja sigui pel timeout de descàrrega que vam afegir, o per qualsevol altre error), l'API disparadora **mai se n'assabentava**. Com a resultat, no podia actualitzar l'estat de la generació a la base de dades a "error", deixant-la permanentment en "processing".

## 4. Solució Implementada

S'ha aplicat una solució en dos fronts per corregir ambdues causes arrel i fer el sistema més robust.

### 4.1. Robustesa al Worker

*   **Fitxer Modificat:** [`lib/smart/SmartDocumentProcessor.ts`](lib/smart/SmartDocumentProcessor.ts:752)
*   **Canvi:** S'ha refactoritzat la funció `downloadTemplateFromStorage` per incloure un **timeout de 30 segons** utilitzant `Promise.race`. Si la descàrrega excedeix aquest temps, ara llança un error controlat en lloc de quedar-se penjada.

### 4.2. Gestió d'Errors a l'API Disparadora

*   **Fitxer Modificat:** [`app/api/reports/generate-smart-enhanced/route.ts`](app/api/reports/generate-smart-enhanced/route.ts)
*   **Canvi:** S'ha eliminat el patró "fire-and-forget".
    *   L'endpoint ara fa **`await`** a la promesa de `fetch` que crida al worker, esperant que aquest completi la seva execució.
    *   S'ha implementat una lògica per comprovar l'estat de la resposta del worker (`workerResponse.ok`).
    *   Si el worker retorna un error, el disparador ara llegeix el missatge d'error i **actualitza l'estat de la generació a la base de dades a 'error'**.
    *   S'ha afegit una gestió d'errors millorada capaç d'interpretar respostes d'error tant en format JSON com en text/html, evitant errors de parsing i assegurant que sempre es registri un error coherent.

## 5. Resum Final

L'error original era una combinació d'un worker poc robust i un orquestrador que no gestionava els errors d'aquest. La solució implementada corregeix ambdós punts, assegurant que els errors es propaguen correctament a través de tot el sistema i es reflecteixen a la base de dades, proporcionant una experiència d'usuari final més fiable.