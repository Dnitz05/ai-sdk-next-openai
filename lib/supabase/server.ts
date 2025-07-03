// lib/supabase/server.ts
import { createClient } from '@supabase/supabase-js';

// Agafem les variables d'entorn necessàries
// NEXT_PUBLIC_SUPABASE_URL és segura al servidor també
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// AQUESTA ÉS LA CLAU SECRETA, NOMÉS PER AL BACKEND
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Comprovació per assegurar que les variables existeixen
if (!supabaseUrl) {
    console.error("❌ Error: Supabase URL no trobada a .env");
    console.error("   Assegura't que NEXT_PUBLIC_SUPABASE_URL està definida a les variables d'entorn");
    throw new Error("Supabase URL not found in environment variables. Check NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseServiceRoleKey) {
    console.error("❌ Error: Supabase Service Role Key no trobada a .env");
    console.error("   Assegura't que SUPABASE_SERVICE_ROLE_KEY està definida a les variables d'entorn");
    throw new Error("Supabase Service Role Key not found. Check SUPABASE_SERVICE_ROLE_KEY");
}

// Validar que les variables tenen el format correcte
if (!supabaseUrl.startsWith('https://')) {
    console.error("❌ Error: NEXT_PUBLIC_SUPABASE_URL no té un format vàlid");
    throw new Error("Invalid Supabase URL format. Must start with https://");
}

console.log("✅ Supabase server client inicialitzat correctament");
console.log(`   URL: ${supabaseUrl}`);
console.log(`   Service Role Key: ${supabaseServiceRoleKey.substring(0, 20)}...`);

// Creem i exportem el client de Supabase per al servidor
// Important: Utilitzem la SERVICE_ROLE_KEY
// Les opcions auth són recomanades per a clients de servidor
const supabaseServerClient = createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// Exportem la instància per poder-la importar a les API routes
export default supabaseServerClient;
