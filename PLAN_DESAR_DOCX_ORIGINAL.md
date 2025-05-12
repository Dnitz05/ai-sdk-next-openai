# Pla Detallat: Implementació del Desat del Fitxer DOCX Original (Versió 3.2)

**Objectiu:** Modificar el sistema perquè, quan un usuari pugi un fitxer DOCX a través de l'editor de plantilles, el fitxer DOCX original s'emmagatzemi a Supabase Storage i la ruta d'aquest fitxer s'associï amb la plantilla a la base de dades. La ruta API `/api/process-document` serà modificada per llegir el fitxer des de Supabase Storage. Per a noves plantilles, el frontend generarà un UUID que s'utilitzarà com a `id` de la plantilla (tant per a la BD com per a la ruta de Storage).

**Estructura de Supabase Storage Proposada:**

*   **Bucket:** `template-docx` (ha de ser creat com a privat)
*   **Ruta del Fitxer Original:** `user-<userId>/template-<templateId_UUID_del_frontend>/original/<timestamp>-<originalName>.docx`

---

## Fase 1: Configuració de Supabase

### Tasca 1.1: Crear el Bucket a Supabase Storage
*   **Acció:** Crear el bucket anomenat `template-docx`.
*   **Configuració:** Marcar-lo com a **privat**.
*   **Eina:** Interfície d'usuari de Supabase Studio o Supabase CLI.

### Tasca 1.2: Modificar la Taula `plantilla_configs`
*   **Acció:** Assegurar/Modificar l'estructura de la taula `plantilla_configs`.
    1.  La columna `id` ha de ser de tipus `UUID` i permetre que el valor sigui proporcionat en la inserció (no auto-generat de manera que sobreescrigui el valor del client). Cal verificar si ja és així o si requereix un `ALTER TABLE`.
    2.  Afegir una nova columna:
        *   **Nom:** `base_docx_storage_path`
        *   **Tipus:** `TEXT`
        *   **Pot ser Nul·la:** Sí
*   **Eina:** Script de migració SQL.

---

## Fase 2: Modificacions al Backend

### Tasca 2.1: Implementar Nova Ruta API [`app/api/upload-original-docx/route.ts`](app/api/upload-original-docx/route.ts)
*   **Objectiu:** Rebre un fitxer DOCX i el `templateId` (UUID generat pel frontend). Pujar-lo a Supabase Storage i retornar la seva ruta.
*   **Mètode HTTP:** `POST`
*   **Cos de la Petició:** `FormData` contenint:
    *   `file`: El fitxer DOCX.
    *   `templateId`: L'UUID generat pel frontend (per a noves plantilles) o l'ID existent (per a edició).
*   **Lògica:**
    1.  Obtenir `userId` de la sessió de l'usuari autenticat (la ruta ha d'estar protegida).
    2.  Validar `file` i `templateId`.
    3.  Construir `storagePath`: `const storagePath = \`user-${userId}/template-${templateId}/original/${Date.now()}-${fileObject.name}\`;` (on `fileObject` és el fitxer rebut).
    4.  Inicialitzar el client Supabase amb `service_role_key`.
    5.  Pujar el buffer del fitxer a Supabase Storage: `await supabaseAdmin.storage.from('template-docx').upload(storagePath, fileBuffer, { contentType: fileObject.type, upsert: true });` (considerar `upsert`).
    6.  Gestionar errors de pujada.
*   **Resposta Èxit (200 OK):** JSON `{ success: true, originalDocxPath: storagePath }`
*   **Resposta Error:** JSON amb missatge d'error i codi d'estat apropiat (400, 500).

### Tasca 2.2: Modificar Ruta API existent [`app/api/process-document/route.ts`](app/api/process-document/route.ts)
*   **Objectiu:** En lloc de rebre el fitxer, rebrà la `storagePath` del DOCX ja pujat, el descarregarà de Storage i el convertirà a HTML.
*   **Mètode HTTP:** `POST`
*   **Cos de la Petició:** JSON `{ "storagePath": "user-..." }`
*   **Lògica:**
    1.  Validar `storagePath` rebuda.
    2.  Inicialitzar el client Supabase amb `service_role_key`.
    3.  Descarregar el fitxer de Supabase Storage: `const { data: fileData, error: downloadError } = await supabaseAdmin.storage.from('template-docx').download(storagePath);`.
    4.  Gestionar `downloadError`.
    5.  Convertir el `Blob` (`fileData`) a `ArrayBuffer` i després a `Buffer` de Node.js.
    6.  Continuar amb la lògica existent de `mammoth.convertToHtml({ buffer: nodeBuffer }, mammothOptions)`.
    7.  Continuar amb la neteja d'HTML amb `cheerio`.
*   **Resposta Èxit (200 OK):** JSON `{ html: cleanedHtml, messages: messagesFromMammoth }`
*   **Resposta Error:** JSON amb missatge d'error i codi d'estat apropiat.

### Tasca 2.3: Actualitzar Ruta API [`app/api/save-configuration/route.ts`](app/api/save-configuration/route.ts)
*   **Objectiu:** En crear una nova plantilla, utilitzar l'UUID proporcionat pel frontend com a `id` i desar el `originalDocxPath`.
*   **Modificacions a `SaveConfigPayload` (interfície d'entrada):**
    *   Afegir `id: string;` (per a l'UUID del frontend).
    *   Afegir `originalDocxPath?: string | null;`.
*   **Lògica d'Inserció (`configToInsert`):**
    *   `id: configurationData.id,`
    *   `base_docx_storage_path: configurationData.originalDocxPath || null,`
    *   ...altres camps existents.

### Tasca 2.4: Actualitzar Ruta API [`app/api/update-template/[id]/route.ts`](app/api/update-template/[id]/route.ts)
*   **Objectiu:** Permetre l'actualització del `base_docx_storage_path` si es puja un nou DOCX per a una plantilla existent.
*   **Modificacions al `body` esperat:**
    *   Ha de poder rebre `originalDocxPath?: string | null;`.
*   **Lògica d'Actualització (`updateData`):**
    *   Si `body.originalDocxPath` està present (incloent `null` per desvincular), actualitzar `base_docx_storage_path = body.originalDocxPath;`.
    *   (Consideració futura: si `originalDocxPath` canvia, s'hauria d'eliminar l'antic fitxer de Supabase Storage?)

---

## Fase 3: Modificacions al Frontend ([`components/TemplateEditor.tsx`](components/TemplateEditor.tsx))

### Tasca 3.1: Gestionar `currentTemplateId` per a Noves i Existents Plantilles
*   **Accions:**
    1.  Importar una llibreria per generar UUIDs (p.ex., `import { v4 as uuidv4 } from 'uuid';`).
    2.  Afegir nou estat: `const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);`.
    3.  Afegir nou estat: `const [originalDocxStoragePath, setOriginalDocxStoragePath] = useState<string | null>(initialTemplateData?.base_docx_storage_path || null);`.
    4.  En `useEffect` (o similar, quan `initialTemplateData` i `mode` estiguin disponibles):
        ```typescript
        useEffect(() => {
          if (mode === 'edit' && initialTemplateData?.id) {
            setCurrentTemplateId(initialTemplateData.id);
            setOriginalDocxStoragePath(initialTemplateData.base_docx_storage_path || null);
          } else if (mode === 'new') {
            setCurrentTemplateId(uuidv4());
            setOriginalDocxStoragePath(null); // Comença sense DOCX per a noves plantilles
          }
        }, [mode, initialTemplateData]);
        ```

### Tasca 3.2: Actualitzar `handleFileChange`
*   **Objectiu:** Orquestrar les dues crides API: primer pujar el DOCX original, després processar-lo per obtenir HTML.
*   **Lògica (dins de `if (fileType === 'docx')`):**
    1.  Validar que `currentTemplateId` no sigui `null`. Si ho és, mostrar error o impedir la pujada.
    2.  **Primera Crida (Pujada del DOCX Original):**
        *   Crear `formDataUpload = new FormData();`.
        *   `formDataUpload.append('file', file);`
        *   `formDataUpload.append('templateId', currentTemplateId!);`
        *   Fer `fetch('/api/upload-original-docx', { method: 'POST', body: formDataUpload })`.
        *   Gestionar la resposta:
            *   Si èxit: `const { originalDocxPath: path } = await response.json(); setOriginalDocxStoragePath(path);`.
            *   Si error: Mostrar error a l'usuari i aturar el flux.
    3.  **Segona Crida (Processament a HTML) - Només si la primera va ser exitosa:**
        *   Obtenir `pathFromState` (el `originalDocxStoragePath` acabat de desar a l'estat).
        *   Fer `fetch('/api/process-document', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ storagePath: pathFromState }) })`.
        *   Gestionar la resposta:
            *   Si èxit: `const { html } = await response.json(); setConvertedHtml(html);`.
            *   Si error: Mostrar error a l'usuari.
    4.  Actualitzar `setDocxNameValue(file.name);` i `setHasUnsavedChanges(true);`.
    5.  Gestionar missatges de càrrega i èxit/error per a l'usuari durant tot el procés.

### Tasca 3.3: Actualitzar `saveTemplate`
*   **Objectiu:** Enviar `currentTemplateId` (com a `id`) i `originalDocxStoragePath` al backend.
*   **Lògica:**
    1.  **Per a `mode === 'new'` (dins de `saveData`):**
        *   `id: currentTemplateId!,` (assegurar que no és nul).
        *   `originalDocxPath: originalDocxStoragePath,`
    2.  **Per a `mode === 'edit'` (dins de `updateData`):**
        *   `originalDocxPath: originalDocxStoragePath,` (l'`id` de la plantilla ja s'obté de `initialTemplateData.id` per a la URL de l'API).

---

## Fase 4: Proves

### Tasca 4.1: Proves End-to-End
*   **Escenari 1: Creació de Nova Plantilla amb DOCX**
    1.  Iniciar creació de nova plantilla.
    2.  Pujar un fitxer DOCX.
        *   Verificar: Es fa crida a `/api/upload-original-docx`. El fitxer es puja a Supabase Storage a la ruta correcta (`user-<uid>/template-<uuid_frontend>/original/...`).
        *   Verificar: Es fa crida a `/api/process-document` amb la `storagePath`. L'HTML es mostra a l'editor.
    3.  Desar la plantilla.
        *   Verificar: Es fa crida a `/api/save-configuration` amb l'`id` (UUID del frontend) i `originalDocxPath`.
        *   Verificar: Es crea una nova fila a `plantilla_configs` amb l'ID correcte i el `base_docx_storage_path` correcte.
*   **Escenari 2: Edició de Plantilla, Afegint/Canviant DOCX**
    1.  Obrir una plantilla existent (amb o sense DOCX previ).
    2.  Pujar un nou fitxer DOCX.
        *   Verificar flux de crides API i emmagatzematge com a l'Escenari 1 (la ruta a Storage utilitzarà l'ID existent de la plantilla).
    3.  Desar la plantilla.
        *   Verificar: Es fa crida a `/api/update-template/[id]` amb el `originalDocxPath` actualitzat.
        *   Verificar: La fila a `plantilla_configs` té el `base_docx_storage_path` actualitzat.
*   **Escenari 3: Edició de Plantilla, Sense Canviar DOCX**
    1.  Obrir plantilla amb DOCX. Modificar només text o prompts.
    2.  Desar.
        *   Verificar: `base_docx_storage_path` a la BD no canvia.
*   **Escenari 4: Errors**
    *   Provar errors de pujada a `/api/upload-original-docx`.
    *   Provar errors de processament a `/api/process-document` (p.ex., DOCX corrupte llegit des de Storage).
    *   Verificar que el frontend mostra missatges d'error adequats.