import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Crea un client Supabase per a Next.js App Router
 * amb suport nadiu de cookies (per a RLS).
 */
export function createServerSupabaseClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Retorna **totes** les cookies en format "name=value"
        getAll: () => {
          const all = (cookieStore as any).getAll() as Array<{ name: string; value: string }>
          console.log('[SSR helper] cookies passades a Supabase:', all)
          return all.map(c => `${c.name}=${c.value}`)
        },
        // No n’utilitzem setAll en App Router
        setAll: () => { /** no-op */ },
      },
    }
  )
}
