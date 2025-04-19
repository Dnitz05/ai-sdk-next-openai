import { createServerClient } from '@supabase/ssr';
import { cookies as nextCookies } from 'next/headers';

/**
 * Crea un client Supabase per a Next.js App Router amb suport nadiu de cookies.
 * @returns Client Supabase autenticat per a RLS
 */
export function createServerSupabaseClient() {
  const cookieStore = nextCookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => {
          // Next.js 14+: si hi ha getAll, l'usaràs
          if (cookieStore && typeof (cookieStore as any).getAll === 'function') {
            return (cookieStore as any).getAll();
          }
          // Fallback a get()
          if (cookieStore && typeof (cookieStore as any).get === 'function') {
            const sb = (cookieStore as any).get('sb-access-token') ||
                       (cookieStore as any).get('sb-ypunjalpaecspihjeces-auth-token');
            const vercel = (cookieStore as any).get('_vercel_jwt');
            return [sb, vercel].filter(Boolean);
          }
          return [];
        },
        setAll: (_newCookies) => {
          // Si necessites refrescar cookies, fes-ho en middleware o response
        },
      },
    }
  );
}
