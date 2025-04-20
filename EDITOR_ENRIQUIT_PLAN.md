# Pla Definitiu: Editor Enriquit Únic per Plantilles (Nova i Edició)

## 1. Objectiu
Centralitzar tota la lògica i renderitzat de l'editor enriquit en un sol component reutilitzable, garantint:
- Un sol lloc de manteniment i millora.
- Compatibilitat amb la creació i l'edició de plantilles.
- Robustesa davant errors, càrrega asíncrona i autenticació.

---

## 2. Estructura Recomanada

```mermaid
flowchart TD
    subgraph Pàgines
        A1[Nova plantilla<br>/plantilles/nova] --> B[TemplateEditor]
        A2[Editar plantilla<br>/plantilles/editar/[id]] --> C[Carrega plantilla]
        C --> B
    end
    subgraph Components
        B[TemplateEditor]
    end
```

---

## 3. Passos Concrets

### 3.1. Crear el component `components/TemplateEditor.tsx`
- **Props**:
  - `initialTemplateData: TemplateData | null` (objecte per editar, null per nova)
  - `mode: 'new' | 'edit'`
- **Responsabilitats**:
  - Gestionar tots els estats interns (fitxers, HTML, vincles, instruccions IA, etc.).
  - Si `initialTemplateData` és present, inicialitzar els estats amb aquestes dades.
  - Si és null, inicialitzar estats buits.
  - Gestionar la lògica de guardar (POST/PUT segons mode).
  - Gestionar errors i loading states.
  - Gestionar la sessió Supabase (obtenir token, mostrar errors d'autenticació).

### 3.2. Refactoritzar la pàgina de nova plantilla
- `app/plantilles/nova/page.tsx`
- Renderitza `<TemplateEditor initialTemplateData={null} mode="new" />`

### 3.3. Crear la pàgina d'edició de plantilla
- `app/plantilles/editar/[id]/page.tsx`
- Obté l'`id` de la ruta.
- Fa una crida a `/api/get-template/[id]` amb el token d'autenticació.
- Mostra loading i errors si cal.
- Quan la plantilla està carregada, renderitza `<TemplateEditor initialTemplateData={...} mode="edit" />`

### 3.4. Migrar la lògica de l'editor de `app/page.tsx` a `TemplateEditor.tsx`
- Moure tota la lògica d'estats, funcions i renderitzat.
- Eliminar duplicació de codi.
- Assegurar que la inicialització d'estats depèn de les props.

### 3.5. Revisar la compatibilitat amb l'API
- Assegurar que la càrrega i el guardat de plantilles utilitzen els endpoints correctes i passen el token d'autenticació.
- Gestionar errors d'API i mostrar missatges clars a l'usuari.

### 3.6. Supervisar la gestió de la sessió/autenticació
- El component ha d'obtenir el token de Supabase abans de fer crides a l'API.
- Si no hi ha sessió, mostrar un missatge i/o redirigir a login.

### 3.7. Provar tots els casos d'ús
- Crear nova plantilla.
- Editar plantilla existent.
- Carregar, modificar i guardar.
- Gestionar errors d'autenticació, càrrega i guardat.
- Comprovar que no es perd cap estat ni funcionalitat.

---

## 4. Efectes Secundaris i Precaucions

- **Càrrega asíncrona**: L'editor ha de mostrar un loading mentre es carrega la plantilla per editar.
- **Inicialització d'estats**: Cal reinicialitzar correctament els estats quan canvia l'`id` de la plantilla.
- **Autenticació**: Si la sessió expira, cal gestionar-ho elegantment.
- **Evitar duplicació**: Tota la lògica d'editor ha d'estar només a `TemplateEditor.tsx`.
- **Compatibilitat**: Comprovar que l'API no canvia i que els camps de la plantilla són coherents.
- **UX**: Mostrar missatges clars d'error i loading.

---

## 5. Resum Visual

- **Un sol component d'editor enriquit** per a tot.
- **Pàgines lleugeres** que només gestionen la càrrega de dades i passen props.
- **Millores futures** només a un lloc.

---

## 6. Exemple d'ús

```tsx
// app/plantilles/nova/page.tsx
import TemplateEditor from '@/components/TemplateEditor';
export default function NovaPlantilla() {
  return <TemplateEditor initialTemplateData={null} mode="new" />;
}

// app/plantilles/editar/[id]/page.tsx
import TemplateEditor from '@/components/TemplateEditor';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function EditarPlantilla() {
  const { id } = useParams();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Obtenir token de Supabase
    // Crida a l'API per carregar la plantilla
    // setTemplate(resultat);
    // setLoading(false);
    // setError(error);
  }, [id]);

  if (loading) return <div>Carregant...</div>;
  if (error) return <div>Error: {error}</div>;
  return <TemplateEditor initialTemplateData={template} mode="edit" />;
}
```

---

## 7. Conclusió

Aquesta arquitectura:
- Garanteix un editor enriquit únic i coherent.
- Evita errors i efectes secundaris.
- Facilita el manteniment i la millora contínua.
- És escalable i robusta.