// lib/supabase/serverClient.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { CookieOptions } from '@supabase/ssr'

/**
 * Retorna un client Supabase per a Next.js App Router
 * amb suport nadiu de cookies per RLS.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => {
          return cookieStore.getAll().map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
          }))
        },
        setAll: (cookies) => {
          cookies.forEach((cookie: { name: string, value: string, options?: CookieOptions }) => {
            cookieStore.set(cookie.name, cookie.value, cookie.options)
          })
        }
      }
    }
  )
}
