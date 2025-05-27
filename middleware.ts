// middleware.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => {
          return req.cookies.getAll().map(cookie => ({
            name: cookie.name,
            value: cookie.value,
          }))
        },
        setAll: cookies => {
          cookies.forEach(cookie => {
            res.cookies.set({
              name: cookie.name,
              value: cookie.value,
              ...cookie.options
            })
          })
        }
      }
    }
  )
  
  await supabase.auth.getUser() // ← sincronitza la cookie
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/test-sdt-public).*)'],
};
