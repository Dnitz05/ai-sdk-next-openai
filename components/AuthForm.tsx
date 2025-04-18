'use client';

import React, { useState, useEffect } from 'react';
import supabase from '../lib/supabase/client';

type AuthMode = 'login' | 'signup';

const AuthForm: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // Recupera la sessió actual i escolta canvis d'autenticació
  useEffect(() => {
    let ignore = false;
    const getSession = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!ignore) setUser(data?.user || null);
    };
    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      ignore = true;
      listener?.subscription.unsubscribe();
    };
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (mode === 'login') {
      console.log('Intentant iniciar sessió amb:', { email, passwordLength: password.length });
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      console.log('Resposta signin:', { data: data ? 'Rebut' : 'No rebut', error });
      
      if (error) {
        console.error('Error login detallat:', { 
          message: error.message, 
          status: error.status,
          code: error.code,
          name: error.name
        });
        setError(`${error.message} (${error.code || 'No code'})`);
      } else {
        setMessage('Sessió iniciada correctament!');
      }
    } else {
      console.log('Intentant registrar-se amb:', { email, passwordLength: password.length });
      const { data, error } = await supabase.auth.signUp({ email, password });
      console.log('Resposta signup:', { data: data ? 'Rebut' : 'No rebut', error });
      
      if (error) {
        console.error('Error signup detallat:', { 
          message: error.message, 
          status: error.status,
          code: error.code,
          name: error.name
        });
        setError(`${error.message} (${error.code || 'No code'})`);
      } else {
        setMessage(data?.user?.identities?.length === 0 
          ? 'Aquest correu ja està registrat. Prova d\'iniciar sessió.'
          : 'Compte creat! Revisa el teu correu per verificar-lo.');
      }
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    const { error } = await supabase.auth.signOut();
    if (error) setError(error.message);
    setLoading(false);
  };

  if (user) {
    return (
      <div className="max-w-sm mx-auto p-4 border rounded shadow flex flex-col items-center">
        <div className="mb-2 text-green-700 font-semibold">
          Sessió iniciada com a <span className="font-mono">{user.email}</span>
        </div>
        <button
          onClick={handleLogout}
          disabled={loading}
          className="btn btn-secondary mt-2"
        >
          {loading ? 'Sortint...' : 'Tanca sessió'}
        </button>
        {error && <div className="text-red-600 mt-2">{error}</div>}
        {message && <div className="text-green-600 mt-2">{message}</div>}
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto p-4 border rounded shadow">
      <h2 className="text-xl font-bold mb-4">
        {mode === 'login' ? 'Inicia sessió' : 'Registra’t'}
      </h2>
      <form onSubmit={handleAuth} className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="Correu electrònic"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="input input-bordered"
        />
        <input
          type="password"
          placeholder="Contrasenya"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="input input-bordered"
        />
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Enviant...' : mode === 'login' ? 'Entrar' : 'Registrar-se'}
        </button>
      </form>
      <div className="mt-2 flex justify-between">
        <button
          className="text-sm underline"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login'
            ? 'No tens compte? Registra’t'
            : 'Ja tens compte? Inicia sessió'}
        </button>
      </div>
      {error && <div className="text-red-600 mt-2">{error}</div>}
      {message && <div className="text-green-600 mt-2">{message}</div>}
    </div>
  );
};

export default AuthForm;
