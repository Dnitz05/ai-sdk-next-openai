'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '../lib/supabase/browserClient';

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-xl font-bold text-blue-700 hover:text-blue-900">
      <span className="inline-block w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-extrabold">AI</span>
      <span className="hidden sm:inline">Plantilles IA</span>
    </Link>
  );
}

function UserMenu() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      setLoading(true);
      try {
        const supabase = createBrowserSupabaseClient();
        const { data } = await supabase.auth.getUser();
        setUser(data?.user ? { email: data.user.email ?? '' } : null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, []);

  const handleLogout = async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (loading) return <div className="w-24 h-6 bg-gray-100 rounded animate-pulse" />;

  if (user) {
    return (
      <div className="relative group">
        <button className="flex items-center gap-2 px-3 py-1 rounded hover:bg-blue-50 transition">
          <span className="font-medium text-blue-700">{user.email}</span>
          <svg className="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition z-50">
          <button
            onClick={handleLogout}
            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            Tanca sessió
          </button>
        </div>
      </div>
    );
  }

  return (
    <Link
      href="/"
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold transition"
    >
      Inicia sessió
    </Link>
  );
}

export default function AppNavbar() {
  return (
    <nav className="w-full bg-white shadow flex items-center justify-between px-4 sm:px-8 py-3 z-50">
      <div className="flex items-center gap-6">
        <Logo />
        <Link href="/" className="text-sm font-medium text-blue-700 hover:text-blue-900 transition hidden sm:inline">
          Nova plantilla
        </Link>
        <Link href="/plantilles" className="text-sm font-medium text-blue-700 hover:text-blue-900 transition hidden sm:inline">
          Les meves plantilles
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <UserMenu />
      </div>
    </nav>
  );
}