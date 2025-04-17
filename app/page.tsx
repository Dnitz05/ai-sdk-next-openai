// app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import AuthForm from '../components/AuthForm';
import supabase from '../lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function Home() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        let ignore = false;
        const getSession = async () => {
            const { data } = await supabase.auth.getUser();
            if (!ignore) {
                setUser(data?.user || null);
                setLoading(false);
            }
        };
        getSession();
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user || null);
            // Eliminada la redirecció automàtica a /plantilles després del login
        });
        return () => {
            ignore = true;
            listener?.subscription.unsubscribe();
        };
    }, [router]);

    // Eliminada la redirecció automàtica a /plantilles per evitar bucles

    if (loading) {
        return (
            <main className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100">
                <div className="text-gray-500">Carregant...</div>
            </main>
        );
    }

    if (!user) {
        return (
            <main className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100">
                <div className="w-full max-w-md mb-8">
                    <AuthForm />
                </div>
            </main>
        );
    }

    // Ara, si l'usuari està autenticat, es mostra la pàgina de creació de plantilles (no es redirigeix automàticament)
    return (
        <main className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100">
            <div className="w-full max-w-3xl mb-8">
                {/* Aquí va el contingut de creació de plantilles, barra lateral, etc. */}
                <h1 className="text-2xl font-bold mb-4">Creació de Plantilla</h1>
                {/* ... (resta de la UI de creació) ... */}
                <p className="text-gray-500">Aquí pots crear i configurar una nova plantilla.</p>
            </div>
        </main>
    );
}
