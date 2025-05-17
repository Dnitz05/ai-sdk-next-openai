# Pla per a Placeholder DOCX

Aquest document descriu com generar i desar un segon `.docx` amb placeholders en paràgrafs associats a Excel i/o prompts IA.

```mermaid
sequenceDiagram
  participant Client
  participant UpdateAPI as API /update-template
  participant SupaStorage as Supabase Storage
  participant GenUtil as util/generatePlaceholderDocx
  participant DB as BD (plantilla_configs)

  Client->>UpdateAPI: PUT /api/update-template/{id} + body {…, link_mappings, ai_instructions}
  UpdateAPI->>DB: UPDATE plantilla_configs (campes normals)
  DB-->>UpdateAPI: updatedTemplate
  alt hi ha associacions
    UpdateAPI->>SupaStorage: DOWNLOAD original.docx (ruta base_docx_storage_path)
    SupaStorage-->>GenUtil: Buffer original + associations
    GenUtil-->>GenUtil: Obre amb PizZip+Docxtemplater  
      Substitueix paràgrafs amb tags `{{paragraphId}}`
    GenUtil-->>UpdateAPI: Buffer placeholder.docx
    UpdateAPI->>SupaStorage: UPLOAD placeholder.docx a `…/placeholder/placeholder.docx`
    SupaStorage-->>UpdateAPI: path_placeholder
    UpdateAPI->>DB: UPDATE plantilla_configs SET placeholder_docx_storage_path=path_placeholder
  end
  UpdateAPI-->>Client: { template: updatedTemplate, placeholderDocxPath }
```

## Passos

1. **Migració de base de dades**  
   Afegir un camp `placeholder_docx_storage_path` a la taula `plantilla_configs` (text).

2. **Funció `generatePlaceholderDocx`**  
   Crear `util/generatePlaceholderDocx.ts` que:
   - Rebi el `Buffer` del .docx original i les `link_mappings` i `ai_instructions`.
   - Utilitzi **PizZip** + **docxtemplater** per obrir i manipular el document.
   - Reemplaçi cada paràgraf identificat per `paragraphId` per un tag `{{paragraphId}}`.
   - Retorni el `Buffer` del nou .docx amb placeholders.

3. **Modificació de l’API `update-template`**  
   A `app/api/update-template/[id]/route.ts`:
   - Després de l’`UPDATE`, comprovar si `body.link_mappings` o `body.ai_instructions` contenen elements.
   - Si cal, descarregar el fitxer original amb `.download()`.
   - Invocar `generatePlaceholderDocx`.
   - Pujar el resultat a `user-{userId}/template-{templateId}/placeholder/placeholder.docx`.
   - Actualitzar `placeholder_docx_storage_path` a la BD.

4. **Gestió d’errors robusta**  
   - Envoltar la generació i pujada de placeholder en `try/catch`.
   - Registrar errors amb `console.error` i continuar, retornant l’`updatedTemplate` amb un warning.

5. **Rutes i noms de fitxer**  
   - Original: `user-{userId}/template-{templateId}/original/original.docx`  
   - Placeholder: `user-{userId}/template-{templateId}/placeholder/placeholder.docx`

6. **Proves unitàries**  
   - Crear tests per a `generatePlaceholderDocx` amb un `.docx` de prova i associacions simulades.

Aquest enfocament aïlla la lògica de generació en `util/`, facilita tests i redueix riscos d’errors greus.