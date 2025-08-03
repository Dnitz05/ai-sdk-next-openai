# Playbook de Depuració: Error 500 (Causa: 401 del Worker)

## 1. Descripció del Problema

Quan s'inicia una generació d'informes, la crida a l'API (`POST /api/reports/generate-smart-enhanced`) retorna un error `500 Internal Server Error`. L'anàlisi dels logs revela que l'error real es produeix quan aquesta API intenta comunicar-se amb el worker (`/api/worker/generation-processor`), i el worker retorna un `401 Unauthorized`.

Aquest document proporciona una guia pas a pas per diagnosticar i resoldre aquest problema d'autenticació entre serveis.

---

## 2. Checklist de Diagnòstic (Versió Ràpida)

Abans de començar, segueix aquests passos per a una verificació ràpida.

1.  **Test de Sessió d'Usuari (SSR):**
    *   Fes una crida `GET` a `/api/debug/test-auth-fix`.
    *   **Resultat esperat:** `200 OK` amb `{ success: true, user: { ... } }`.
    *   **Si falla:** El problema està en com el servidor Next.js gestiona la sessió de l'usuari. Revisa l'ús de `createServerClient` i les cookies.

2.  **Test de Variables d'Entorn (ENV):**
    *   Fes una crida `GET` a `/api/debug/env-test` (cal crear aquest endpoint).
    *   **Resultat esperat:** Ha de mostrar un prefix del `WORKER_SECRET_TOKEN` i el `NEXT_PUBLIC_SITE_URL` que coincideixin amb la configuració de l'entorn de Vercel (Production/Preview) on estàs provant.
    *   **Si falla:** La variable d'entorn no està disponible al worker. Valida que estigui definida a **tots** els entorns de Vercel.

3.  **Anàlisi de la Petició:**
    *   Inicia una generació d'informe des del frontend.
    *   Obre les **DevTools → Network** del navegador i els **Logs** de Vercel.
    *   **Verificació:** Confirma que la petició `POST /api/reports/generate-smart-enhanced` inclou la `Cookie` de sessió i el *header* `Authorization`.

4.  **Consulta a la Base de Dades:**
    *   Executa la següent consulta a la teva base de dades de Supabase:
    ```sql
    SELECT id, status, error_message 
    FROM generations 
    WHERE status = 'error' 
    ORDER BY created_at DESC 
    LIMIT 20;
    ```
    *   **Verificació:** L' `error_message` sovint conté la pista definitiva (ex: "invalid token", "token missing").

---

## 3. Passos Detallats i Solucions

### 3.1. Punt Crític 1: Sessió d'Usuari a nivell de Servidor (SSR)

El primer punt de fallada és que l'API trigger no reconegui la sessió de l'usuari que fa la petició.

*   **Com verificar:** Utilitza un endpoint de prova com `/api/debug/test-auth-fix` que simplement intenti obtenir la sessió de l'usuari i la retorni.
*   **Codi del Test (`/api/debug/test-auth-fix/route.ts`):**
    ```typescript
    import { createServerClient } from '@supabase/ssr'
    import { cookies } from 'next/headers'
    import { NextRequest, NextResponse } from 'next/server'

    export async function GET(request: NextRequest) {
      const cookieStore = cookies()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get: (name) => cookieStore.get(name)?.value } }
      )
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ success: false, error: 'No user found' }, { status: 401 })
      return NextResponse.json({ success: true, user })
    }
    ```
*   **Solució Freqüent:** Assegura't que totes les crides `fetch` des del frontend inclouen `credentials: 'include'` per enviar les cookies de sessió.

### 3.2. Punt Crític 2: Disponibilitat de Variables d'Entorn

El segon punt de fallada és que el worker no tingui accés al `WORKER_SECRET_TOKEN`.

*   **Com verificar:** Crea un endpoint `/api/debug/env-test` que exposi de manera segura les variables necessàries.
*   **Codi del Test (`/api/debug/env-test/route.ts`):**
    ```typescript
    import { NextResponse } from 'next/server'

    export async function GET() {
      const workerToken = process.env.WORKER_SECRET_TOKEN
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

      return NextResponse.json({
        workerTokenSet: !!workerToken,
        workerTokenPrefix: workerToken?.substring(0, 4) || null,
        siteUrl
      })
    }
    ```
*   **Solució Freqüent:** Ves al teu projecte de Vercel, a **Settings → Environment Variables**, i assegura't que `WORKER_SECRET_TOKEN` està definit per a **tots** els entorns (Production, Preview, i Development). Fes un nou *deploy* per aplicar els canvis.

### 3.3. Punt Crític 3: Pas de Tokens entre Serveis

El tercer punt de fallada és que el trigger no enviï correctament el token al worker.

*   **Com verificar:** A l'API trigger (`/api/reports/generate-smart-enhanced`), afegeix un `console.log` just abans de la crida `fetch` al worker per imprimir el header `Authorization` que s'enviarà.
*   **Codi a l'API Trigger:**
    ```typescript
    const workerToken = process.env.WORKER_SECRET_TOKEN;
    console.log('Enviant token al worker amb prefix:', workerToken?.substring(0,4));

    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${workerToken}` // Assegura't que és 'Bearer'
      },
      body: JSON.stringify(payload)
    });
    ```
*   **Codi al Worker:**
    ```typescript
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (token !== process.env.WORKER_SECRET_TOKEN) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    ```
*   **Solució Freqüent:** Assegura't que el prefix `Bearer ` és correcte i que no hi ha espais extra.

---

## 4. Criteris d'Èxit (Com saber que està arreglat)

1.  **L'API respon correctament:** La crida `POST /api/reports/generate-smart-enhanced` retorna `200 OK` o `202 Accepted`.
2.  **Els logs de Vercel estan nets:** No apareixen errors `401` del worker.
3.  **La Base de Dades ho reflecteix:** Els nous registres a la taula `generations` passen a `processing` i després a `completed` o `generated`, sense quedar-se en `error`.
4.  **El Frontend funciona:** L'usuari veu la confirmació i eventualment l'enllaç de descàrrega.

---

## 5. Altres Possibles Causes

*   **Polítiques RLS de Supabase:** Si el worker intenta accedir a una taula amb RLS i no té una sessió d'usuari vàlida (o no utilitza la `service_role_key`), l'accés serà denegat.
*   **Protecció de Deployments de Vercel (SSO):** Si el teu equip utilitza SSO, les crides entre APIs internes poden necessitar el header `x-vercel-protection-bypass`.