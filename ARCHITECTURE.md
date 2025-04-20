# Arquitectura Recomanada: Editor Enriquit Únic per Plantilles

## Objectiu
Garantir que l'editor enriquit de plantilles sigui **únic i compartit** tant per a la creació com per a l'edició, evitant duplicació de codi i facilitant el manteniment i la millora contínua.

---

## Estructura Recomanada

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

- **TemplateEditor**: Component React únic amb tota la lògica i renderitzat de l'editor enriquit.
- **/plantilles/nova**: Pàgina que mostra l'editor buit (sense plantilla carregada).
- **/plantilles/editar/[id]**: Pàgina que carrega la plantilla via API i passa les dades a TemplateEditor.

---

## Passos Concrets

1. **Extreure l'editor enriquit a `components/TemplateEditor.tsx`**
   - Moure tota la lògica i renderitzat de l'editor de `app/page.tsx` a aquest component.
   - El component rebrà via props:
     - `initialTemplateData` (objecte o null)
     - `mode` ('new' o 'edit')

2. **Crear la pàgina de nova plantilla**
   - `app/plantilles/nova/page.tsx`
   - Renderitza `<TemplateEditor initialTemplateData={null} mode="new" />`

3. **Crear la pàgina d'edició de plantilla**
   - `app/plantilles/editar/[id]/page.tsx`
   - Obté l'`id` de la ruta, carrega la plantilla via API, i renderitza `<TemplateEditor initialTemplateData={...} mode="edit" />`

4. **Millores futures**
   - Qualsevol millora a l'editor només s'ha de fer a `TemplateEditor.tsx`.

---

## Beneficis

- **Un sol lloc per millorar l'editor** (no hi ha duplicació de codi)
- **Flux clar i escalable** per a noves funcionalitats
- **Manteniment i proves més senzilles**

---

## Exemple d'ús

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
  useEffect(() => {
    // Crida a l'API per carregar la plantilla
    // setTemplate(resultat);
  }, [id]);
  if (!template) return <div>Carregant...</div>;
  return <TemplateEditor initialTemplateData={template} mode="edit" />;
}
```

---

Aquesta arquitectura garanteix un editor enriquit **comú i únic** per a totes les operacions de plantilles.