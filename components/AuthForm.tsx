'use client';

import React, { useState } from 'react';
import supabase from '../lib/supabase/client';

type AuthMode = 'login' | 'signup';

const AuthForm: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else setMessage('Sessió iniciada correctament!');
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMessage('Compte creat! Revisa el teu correu per verificar-lo.');
    }
    setLoading(false);
  };

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