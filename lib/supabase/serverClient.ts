import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Cookie, CookieMethodsServer } from '@supabase/ssr'

/**
 * Retorna un client Supabase per a Next.js App Router
 * amb suport nadiu de cookies per RLS.
 */
export async function createServerSupabaseClient() {
  // Llegim el store de cookies de Next.js
  const cookieStore = await cookies()

  // Implementem les quatre crides que Supabase SSR necessita
  const cookieMethods: CookieMethodsServer = {
    get: (name: string) => {
      const c = cookieStore.get(name)
      return c ? { name: c.name, value: c.value } : undefined
    },
    getAll: () =>
      cookieStore.getAll().map((c) => ({
        name: c.name,
        value: c.value,
      })),
    set: () => {
      /* no-op: si vols refrescar-les has de fer-ho en middleware o en la resposta */
    },
    delete: () => {
      /* no-op */
    },
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieMethods }
  )
}
