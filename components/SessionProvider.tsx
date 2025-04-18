// components/SessionProvider.tsx
'use client';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/browserClient';
import { useRef } from 'react';

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const supabaseRef = useRef(createBrowserSupabaseClient());
  return (
    <SessionContextProvider supabaseClient={supabaseRef.current}>
      {children}
    </SessionContextProvider>
  );
}