// lib/supabase/serverClient.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Retorna un client Supabase per a Next.js App Router
 * amb suport nadiu de cookies per RLS.
 */
export async function createServerSupabaseClient() {
  // ReadonlyRequestCookies amb get() i getAll()
  const cookieStore = await cookies()

  // Cast genèric perquè la interfície de Supabase accepti la store
  const cookieMethods = cookieStore as unknown as Parameters<
    typeof createServerClient
  >[2]['cookies']

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieMethods }
  )
}
