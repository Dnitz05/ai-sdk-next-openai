// components/SessionProvider.tsx
'use client'
import { useState, createContext, useContext } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browserClient'
import { SupabaseClient } from '@supabase/supabase-js'

// Create a typed context for the Supabase client
const SupabaseContext = createContext<SupabaseClient | null>(null)

// Hook for components to easily access the Supabase client
export const useSupabase = () => {
  const context = useContext(SupabaseContext)
  if (context === null) {
    throw new Error('useSupabase must be used within a SessionProvider')
  }
  return context
}

export default function SessionProvider({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  // Create the Supabase client once and keep it for the component's lifetime
  const [supabase] = useState(() => createBrowserSupabaseClient())

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  )
}
