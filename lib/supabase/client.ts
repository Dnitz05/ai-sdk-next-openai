// lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

// Variables d'entorn públiques per al frontend
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// Comprovació bàsica
if (!supabaseUrl) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL no definida');
}
if (!supabaseAnonKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_ANON_KEY no definida');
}

// Creació del client Supabase per al frontend
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;