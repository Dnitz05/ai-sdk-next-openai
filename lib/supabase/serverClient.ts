// lib/supabase/serverClient.ts
import { createServerClient, type CookieMethodsServer } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Retorna un client Supabase per a Next.js App Router
 * amb suport nadiu de cookies per RLS.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

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
      /* no-op: refresca cookies en middleware o a la resposta */
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
