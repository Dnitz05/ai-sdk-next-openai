// lib/supabase/server.ts
import { createClient } from '@supabase/supabase-js';

// Agafem les variables d'entorn necessàries
// NEXT_PUBLIC_SUPABASE_URL és segura al servidor també
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// AQUESTA ÉS LA CLAU SECRETA, NOMÉS PER AL BACKEND
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Comprovació per assegurar que les variables existeixen
if (!supabaseUrl) {
    console.error("Error: Supabase URL no trobada a .env");
    // Podríem llançar un error més formal si volem aturar l'execució
    // throw new Error("Supabase URL not found in environment variables.");
}
if (!supabaseServiceRoleKey) {
    console.error("Error: Supabase Service Role Key no trobada a .env. Assegura't que SUPABASE_SERVICE_ROLE_KEY està definida.");
    // throw new Error("Supabase Service Role Key not found.");
}

// Creem i exportem el client de Supabase per al servidor
// Important: Utilitzem la SERVICE_ROLE_KEY
// Les opcions auth són recomanades per a clients de servidor
const supabaseServerClient = createClient(
    supabaseUrl || '', // Proporcionem un string buit si és undefined per evitar error de tipus inicial
    supabaseServiceRoleKey || '', // Proporcionem un string buit si és undefined
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// Exportem la instància per poder-la importar a les API routes
export default supabaseServerClient;