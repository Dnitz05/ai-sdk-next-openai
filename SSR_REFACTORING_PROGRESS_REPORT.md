# Informe de Progrés: Refactorització SSR i Eliminació de Service Role Key

## Resum Executiu

S'ha iniciat la refactorització dels endpoints de l'API per eliminar la dependència del `SUPABASE_SERVICE_ROLE_KEY` i utilitzar Server-Side Rendering (SSR) amb Row Level Security (RLS) automàtic. Aquesta migració millora la seguretat i simplifica l'arquitectura.

## Endpoints Refactoritzats ✅

### 1. `app/api/update-template/[id]/route.ts`
- **Estat**: Completat
- **Canvis**: Eliminat autenticació dual, utilitzant només SSR amb RLS
- **Funcionalitat**: Actualització de plantilles amb generació de placeholder i indexació automàtica
- **Beneficis**: Simplificació del codi, seguretat millorada via RLS

### 2. `app/api/delete-project/[id]/route.ts`
- **Estat**: Completat  
- **Canvis**: Migrat a SSR, eliminació en cascada amb RLS automàtic
- **Funcionalitat**: Eliminació de projectes i tots els seus arxius relacionats
- **Beneficis**: Seguretat automàtica via RLS, codi més net

### 3. `app/api/upload-excel/route.ts`
- **Estat**: Completat
- **Canvis**: Eliminat sistema d'autenticació dual complex
- **Funcionalitat**: Pujada de fitxers Excel amb verificació de propietat
- **Beneficis**: Autenticació simplificada, validació automàtica amb RLS

### 4. `app/api/upload-original-docx/route.ts`
- **Estat**: Completat
- **Canvis**: Refactoritzat mantenint tota la funcionalitat d'indexació SDT
- **Funcionalitat**: Pujada, indexació automàtica i mapeig de paràgrafs
- **Beneficis**: Manté funcionalitat avançada amb seguretat millorada

### 5. Endpoints de Reports refactoritzats:
- `app/api/reports/generate/route.ts` - Generació individual de jobs
- `app/api/reports/jobs-status/route.ts` - Estat i cancel·lació de jobs

### 6. Endpoints ja refactoritzats anteriorment:
- `app/api/reports/generate-smart-enhanced/route.ts`
- `app/api/save-configuration/route.ts`
- `app/api/reports/projects/route.ts`
- `app/api/get-templates/route.ts`

## Test de Verificació

### `app/api/debug/test-ssr-refactoring/route.ts`
- Test complet per verificar el funcionament de la refactorització SSR
- Verifica autenticació, accés a taules, Storage i variables d'entorn
- Proporciona informe detallat de l'estat del sistema

## Endpoints Refactoritzats Recentment ✅

### `app/api/reports/generate/route.ts`
- **Estat**: ✅ Completat
- **Canvis**: Migrat a SSR, eliminat autenticació dual
- **Funcionalitat**: Creació de jobs de generació individual amb RLS automàtic
- **Millores de seguretat**: Verificació de propietat de projecte abans de crear jobs

### `app/api/reports/jobs-status/route.ts`
- **Estat**: ✅ Completat
- **Canvis**: Refactoritzat amb SSR + RLS, eliminat accés no autenticat
- **Funcionalitat**: Consulta d'estat de jobs i cancel·lació amb permisos automàtics
- **Millores**: Suggeriments de projectes disponibles quan no es troba el projecte demanat

## Endpoints Pendents de Refactorització ⏳

Segons l'anàlisi del codi, encara queden **52 endpoints** que utilitzen `SUPABASE_SERVICE_ROLE_KEY`:

### Crítics (Alta prioritat) ⚠️
1. `app/api/reports/content/route.ts` - Contingut de reportes
4. `app/api/reports/generations/route.ts` - Generacions
5. `app/api/reports/generate-async/route.ts` - Generació asíncrona
6. `app/api/process-document/route.ts` - Processament de documents

### Mitjana prioritat
7. `app/api/reports/template-excel-info/[templateId]/route.ts`
8. `app/api/reports/download-document/[generationId]/route.ts`
9. `app/api/get-paragraph-ids/[templateId]/route.ts`
10. `app/api/regenerate-placeholder-docx/[templateId]/route.ts`

### Endpoints de debug/test (Baixa prioritat)
- Múltiples endpoints sota `app/api/debug/`
- Endpoints de cleanup sota `app/api/cleanup/`

## Arquitectura Refactoritzada

### Abans (Dual Authentication)
```typescript
// Verificació manual del token Bearer
const authHeader = request.headers.get('authorization');
const accessToken = authHeader.replace('Bearer ', '');
const userClient = createUserSupabaseClient(accessToken);

// Client administratiu separat
const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

### Després (SSR amb RLS)
```typescript
// Autenticació automàtica via SSR
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { cookies: { /* gestió automàtica */ } }
);

// RLS assegura accés només a dades de l'usuari
const { data: { user } } = await supabase.auth.getUser();
```

## Beneficis de la Refactorització

### Seguretat
- **RLS Automàtic**: Cada consulta automàticament filtrada per usuari
- **Reducció d'Atacs**: Menys superfície d'atac eliminant service role key
- **Auditoria**: RLS proporciona logs automàtics d'accés

### Mantenibilitat
- **Codi Simplificat**: Eliminació de lògica d'autenticació dual
- **Consistència**: Tots els endpoints utilitzen el mateix patró
- **Debugging**: Menys punts de fallada, errors més clars

### Rendiment
- **Menys Overhead**: Una sola connexió en lloc de dues
- **Cache Optimitzat**: SSR millor integrat amb Next.js

## Propera Fase: Refactorització dels Reports

### Prioritat 1: Endpoints de Reports
Els endpoints de reports són crítics per al funcionament de l'aplicació:

1. **reports/generate/route.ts**: Generació principal de documents
2. **reports/jobs-status/route.ts**: Monitorització d'estat de treballs
3. **reports/content/route.ts**: Gestió de contingut generat
4. **reports/generations/route.ts**: Històric de generacions

### Estratègia de Migració
1. **Anàlisi**: Revisar cada endpoint per entendre dependències
2. **Refactorització**: Aplicar patró SSR + RLS
3. **Testing**: Verificar funcionalitat amb usuaris reals
4. **Validació**: Confirmar que RLS protegeix adequadament les dades

## Impacte en el Error Original

L'error inicial:
```
Failed to load resource: the server responded with a status of 404
Error en generació intel·ligent: Error: Plantilla no trobada
```

La refactorització SSR ajuda a resoldre aquest tipus d'errors perquè:

1. **Millor gestió d'errors**: RLS proporciona errors més específics
2. **Autenticació consistent**: Menys probabilitat de problemes d'autenticació
3. **Debugging simplificat**: Un sol punt d'autenticació per debugar

## Recomanacions

### Immediate (Següents passes)
1. **Continuar refactorització**: Prioritzar endpoints de reports
2. **Executar tests**: Utilitzar `/api/debug/test-ssr-refactoring` regularment
3. **Monitoritzar errors**: Verificar que els endpoints refactoritzats funcionen

### A mig termini
1. **Eliminar service_role_key**: Un cop tots els endpoints migrats
2. **Optimitzar RLS**: Revisar polítiques per rendiment
3. **Documentació**: Actualitzar documentació d'API

### A llarg termini
1. **Auditoria de seguretat**: Revisió completa de l'arquitectura
2. **Optimització**: Millorar rendiment de consultes RLS
3. **Monitorització**: Implementar mètriques de rendiment

## Conclusió

La refactorització SSR està progressant adequadament. Els 8 endpoints ja migrats mostren el patró a seguir, i el sistema de tests permet verificar la funcionalitat. El següent pas és continuar amb els endpoints de reports per resoldre completament l'error original i millorar la seguretat general del sistema.
