# Protecció de taules amb Row Level Security (RLS) a Supabase

## 1. Activa RLS a la taula

```sql
ALTER TABLE plantilla_configs ENABLE ROW LEVEL SECURITY;
```

## 2. Afegeix la columna user_id (si no existeix)

```sql
ALTER TABLE plantilla_configs ADD COLUMN user_id uuid REFERENCES auth.users(id);
```

## 3. Policy: Accés només a les pròpies plantilles

```sql
CREATE POLICY "Accés només a les pròpies plantilles"
  ON plantilla_configs
  FOR ALL
  USING (user_id = auth.uid());
```

## 4. Policy: Inserció segura

```sql
CREATE POLICY "Inserció segura"
  ON plantilla_configs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
```

## 5. Repeteix per a la resta de taules sensibles

Exemple per a la taula informes_generats:

```sql
ALTER TABLE informes_generats ENABLE ROW LEVEL SECURITY;

ALTER TABLE informes_generats ADD COLUMN user_id uuid REFERENCES auth.users(id);

CREATE POLICY "Accés només als propis informes"
  ON informes_generats
  FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Inserció segura"
  ON informes_generats
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
```

## 6. Comprova el frontend i les API routes

Assegura’t que el frontend i les API routes envien el JWT de l’usuari autenticat a Supabase (l’access token) per tal que auth.uid() funcioni correctament.

---

Amb aquestes instruccions, només l’usuari autenticat podrà llegir, modificar o eliminar els seus propis registres a la base de dades.