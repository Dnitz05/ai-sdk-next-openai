import { createServerClient } from '@supabase/ssr';

/**
 * Crea un client Supabase per a Next.js App Router amb suport nadiu de cookies.
 * @param cookiesHeader - El header de cookies (string o array de cookies)
 * @returns Client Supabase autenticat per a RLS
 */
export function createServerSupabaseClient(cookiesHeader: string | any) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // Usa anon_key per a RLS d'usuari, service_role només per a backend sense restriccions
    { cookies: cookiesHeader }
  );
}