import { createServerClient } from '@supabase/ssr';

/**
 * Crea un client Supabase per a Next.js App Router amb suport nadiu de cookies.
 * @param cookiesHeader - El header de cookies (string o array de cookies)
 * @returns Client Supabase autenticat per a RLS
 */
import { cookies as nextCookies } from 'next/headers';

export function createServerSupabaseClient() {
  const cookieStore = nextCookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => {
          // Si getAll existeix, utilitza-la (Next.js 14+)
          if (cookieStore && typeof (cookieStore as any).getAll === 'function') {
            return (cookieStore as any).getAll();
          }
          // Si get existeix, busca manualment les cookies d'autenticació
          if (cookieStore && typeof (cookieStore as any).get === 'function') {
            const sb = (cookieStore as any).get('sb-access-token') || (cookieStore as any).get('sb-ypunjalpaecspihjeces-auth-token');
            const vercel = (cookieStore as any).get('_vercel_jwt');
            return [sb, vercel].filter(Boolean);
          }
          // Fallback: retorna array buit
          return [];
        },
        setAll: (_newCookies) => {
          // Next.js 14+ no permet setAll directament aquí, però pots fer-ho a middleware o response
        },
      },
    }
  );
}