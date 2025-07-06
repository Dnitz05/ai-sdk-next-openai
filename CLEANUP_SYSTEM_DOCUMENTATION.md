# 🧹 Sistema de Neteja Massiva - Documentació

## Descripció General

S'ha implementat un sistema complet de neteja massiva per eliminar plantilles i projectes de prova de forma segura i eficient. El sistema inclou APIs backend segures i una interfície d'usuari intuïtiva.

## 🔧 Components Implementats

### 1. **APIs de Neteja Backend**

#### `/api/cleanup/templates` (DELETE)
- **Funcionalitat**: Elimina totes les plantilles de l'usuari autenticat
- **Seguretat**: Usa `supabaseServerClient` per bypassing RLS amb verificació de `user_id`
- **Eliminació completa**:
  - Registres de `plantilla_configs` de la BD
  - Fitxers DOCX originals del Storage
  - Fitxers DOCX indexats del Storage  
  - Fitxers DOCX de placeholders del Storage
  - Fitxers Excel associats del Storage

#### `/api/cleanup/projects` (DELETE)
- **Funcionalitat**: Elimina tots els projectes de l'usuari autenticat
- **Seguretat**: Usa `supabaseServerClient` amb filtres explícits per `user_id`
- **Eliminació en cascada**:
  - Registres de `generated_content`
  - Registres de `generation_jobs`
  - Registres de `generations`
  - Registres de `projects`

### 2. **Interfície d'Usuari**

#### Pàgina d'Administració (`/admin/cleanup`)
- **Accés restringit**: Només usuaris autenticats
- **Autenticació robusta**: Usa Supabase client per verificar sessions
- **Confirmacions dobles**: Modals de confirmació per operacions destructives
- **Feedback visual**: Indicadors de progrés i missatges d'estat
- **Gestió d'errors**: Captura i mostra errors de forma clara

#### Enllaços d'Accés Ràpid
- **Plantilles**: Botó "🧹 Administració" a `/plantilles`
- **Informes**: Botó "🧹 Administració" a `/informes`

## 🔒 Mesures de Seguretat Implementades

### 1. **Autenticació Robusta**
```typescript
// Verificació de token JWT
const authHeader = request.headers.get('authorization');
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return NextResponse.json({ error: 'No autenticat' }, { status: 401 });
}

// Verificació d'usuari autenticat
const { data: { user }, error: userError } = await supabase.auth.getUser();
if (userError || !user) {
  return NextResponse.json({ error: 'Error obtenint usuari' }, { status: 401 });
}
```

### 2. **Filtres de Seguretat per User ID**
```typescript
// SEGURETAT: només eliminar dades de l'usuari autenticat
.eq('user_id', user.id)
```

### 3. **Ús Híbrid de Clients Supabase**
- **User Client**: Per verificació d'autenticació i operacions RLS
- **Server Client**: Per bypassing RLS amb filtres explícits de seguretat

### 4. **Confirmacions Dobles**
- Modals de confirmació amb advertències clares
- Comptadors de registres a eliminar
- Missatges d'advertència sobre irreversibilitat

## 📊 Gestió d'Errors i Logging

### 1. **Logging Detallat**
```typescript
console.log('🧹 Iniciant neteja de plantilles...');
console.log(`📋 Trobades ${templates?.length || 0} plantilles per eliminar`);
console.log(`🗑️ ${allFiles.length} fitxers eliminats per plantilla ${template.id}`);
```

### 2. **Captura d'Errors**
- Errors de Storage es capturen però no bloquegen l'eliminació de BD
- Errors de BD es retornen immediatament
- Arrays d'errors per reportar problemes parcials

### 3. **Responses Estructurades**
```typescript
return NextResponse.json({ 
  success: true, 
  message: `S'han eliminat ${templates.length} plantilles correctament`,
  deleted: templates.length,
  storageErrors: storageErrors.length > 0 ? storageErrors : undefined
});
```

## 🚀 Funcionalitats Avançades

### 1. **Eliminació Recursiva de Storage**
- Explora subcarpetes (`original`, `indexed`, `placeholder`)
- Elimina tots els fitxers de forma batch
- Gestió d'errors per fitxer individual

### 2. **Eliminació en Cascada de BD**
- Ordre correcte d'eliminació per evitar violacions de claus foranes
- Ús de `supabaseServerClient` per bypassing RLS
- Verificacions de seguretat en cada pas

### 3. **Interfície Responsiva**
- Indicadors de càrrega durant operacions llargues
- Deshabilitació de botons durant processos
- Missatges d'estat en temps real

## 🔧 Configuració i Desplegament

### Variables d'Entorn Necessàries (Vercel)
```env
NEXT_PUBLIC_SUPABASE_URL=https://ypunjalpaecspihjeces.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Polítiques RLS Necessàries
```sql
-- Política per DELETE a plantilla_configs
CREATE POLICY "user_deletes_own_configs" 
ON "public"."plantilla_configs" 
AS PERMISSIVE 
FOR DELETE 
TO public 
USING (user_id = auth.uid());
```

## 📝 Ús del Sistema

### 1. **Accés a la Pàgina d'Administració**
- Navegar a `/admin/cleanup`
- O usar els botons "🧹 Administració" a les pàgines principals

### 2. **Neteja de Plantilles**
- Clic a "🗑️ Eliminar Totes les Plantilles"
- Confirmar en el modal de seguretat
- Esperar confirmació d'èxit

### 3. **Neteja de Projectes**
- Clic a "🗑️ Eliminar Tots els Projectes"
- Confirmar en el modal de seguretat
- Esperar confirmació d'èxit

## ⚠️ Consideracions Importants

### 1. **Operacions Irreversibles**
- Totes les eliminacions són permanents
- No hi ha sistema de backup automàtic
- Es recomana fer backup manual abans d'usar

### 2. **Rendiment**
- Les operacions poden trigar segons el volum de dades
- Els fitxers de Storage s'eliminen de forma asíncrona
- Errors de Storage no bloquegen l'eliminació de BD

### 3. **Limitacions**
- Només funciona per l'usuari autenticat
- No permet eliminació selectiva (tot o res)
- Requereix connexió estable durant el procés

## 🔄 Manteniment i Millores Futures

### Possibles Millores
1. **Eliminació Selectiva**: Checkbox per triar què eliminar
2. **Backup Automàtic**: Sistema de backup abans d'eliminar
3. **Programació**: Neteja automàtica programada
4. **Auditoria**: Log d'eliminacions per auditoria
5. **Recuperació**: Sistema de papelera temporal

### Monitorització
- Revisar logs de Vercel per errors
- Monitoritzar ús de Storage de Supabase
- Verificar polítiques RLS periòdicament

---

**Data de creació**: 6 de gener de 2025  
**Versió**: 1.0  
**Estat**: Implementat i funcional en producció
