// lib/supabase/browserClient.ts
'use client';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';

export const createBrowserSupabaseClient = createPagesBrowserClient;