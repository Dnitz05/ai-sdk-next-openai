import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Retorna un client Supabase per a Next.js App Router
 * amb suport nadiu de cookies per RLS.
 */
export function createServerSupabaseClient() {
  // Next.js cookies() retorna un objecte amb get, getAll, set, delete
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: cookies()
    }
  )
}
