// lib/supabase/serverClient.ts
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
          // Next.js 14+: si existeix .getAll(), agafa tots els cookies i converteix-los a "name=value"
          if (cookieStore && typeof (cookieStore as any).getAll === 'function') {
            return (cookieStore as any)
              .getAll()
              .map(({ name, value }: { name: string; value: string }) => `${name}=${value}`);
          }

          // Fallback: només get(), recull els tokens i també els converteix
          if (cookieStore && typeof (cookieStore as any).get === 'function') {
            const list: string[] = [];
            const sb = (cookieStore as any).get('sb-access-token')?.value ||
                       (cookieStore as any).get('sb-ypunjalpaecspihjeces-auth-token')?.value;
            const vercel = (cookieStore as any).get('_vercel_jwt')?.value;
            if (sb)     list.push(`sb-access-token=${sb}`);
            if (vercel) list.push(`_vercel_jwt=${vercel}`);
            return list;
          }

          return [];
        },
        setAll: (_newCookies) => {
          // Si necessites refrescar cookies, fes-ho des del middleware o directament a la resposta
        },
      },
    }
  );
}
