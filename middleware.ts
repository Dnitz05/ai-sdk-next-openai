// middleware.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  try {
    const res = NextResponse.next()
    
    // Validar variables d'entorn abans de crear el client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Middleware: Variables d\'entorn de Supabase no trobades');
      console.error(`   NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'OK' : 'MISSING'}`);
      console.error(`   NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'OK' : 'MISSING'}`);
      
      // En lloc de fallar, continuem sense autenticació
      return res;
    }
    
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
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
    
    // Afegir timeout i error handling per a la crida a Supabase
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Supabase auth timeout')), 5000)
    );
    
    await Promise.race([
      supabase.auth.getUser(),
      timeoutPromise
    ]);
    
    return res;
    
  } catch (error) {
    console.error('❌ Middleware error:', error);
    console.error(`   Request URL: ${req.url}`);
    console.error(`   Request method: ${req.method}`);
    
    // En cas d'error, continuem sense autenticació en lloc de fallar
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
