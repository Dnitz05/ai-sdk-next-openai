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
            if (session?.user) {
                router.push('/plantilles');
            }
        });
        return () => {
            ignore = true;
            listener?.subscription.unsubscribe();
        };
    }, [router]);

    useEffect(() => {
        if (user) {
            router.push('/plantilles');
        }
    }, [user, router]);

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

    // Si per algun motiu arriba aquí amb usuari, redirigeix
    router.push('/plantilles');
    return null;
}
