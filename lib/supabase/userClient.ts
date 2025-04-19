// lib/supabase/userClient.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

/**
 * Crea un client Supabase autenticat amb el token JWT de l'usuari.
 * Aquest mètode és útil per API routes que reben el token via headers.
 * @param {string} accessToken - JWT de l'usuari autenticat
 */
export function createUserSupabaseClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { 
      persistSession: false,
      autoRefreshToken: false 
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}
