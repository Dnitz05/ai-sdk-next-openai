'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/browserClient';

export default function CleanupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  // Verificar autenticació
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        console.log('Session:', session?.user?.id);
        console.log('User:', user?.id);
        console.log('Session error:', sessionError);
        console.log('User error:', userError);
        
        setIsAuthenticated(!!(session && user));
        setUser(user);
      } catch (err) {
        console.error('Error verificant autenticació:', err);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Funció per obtenir el token d'accés
  const getAccessToken = async () => {
    const supabase = createBrowserSupabaseClient();
    
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      throw new Error('No estàs autenticat. Inicia sessió primer.');
    }
    
    return session.access_token;
  };

  const handleCleanupTemplates = async () => {
    if (!confirm('Estàs segur que vols eliminar TOTES les plantilles? Aquesta acció no es pot desfer.')) {
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // Obtenir el token d'autenticació de Supabase
      const token = await getAccessToken();

      const response = await fetch('/api/cleanup/templates', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        alert(`✅ S'han eliminat ${data.deleted} plantilles correctament!`);
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error en neteja:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Error desconegut'
      });
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Error desconegut'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanupProjects = async () => {
    if (!confirm('Estàs segur que vols eliminar TOTS els projectes? Aquesta acció no es pot desfer.')) {
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // Obtenir el token d'autenticació de Supabase
      const token = await getAccessToken();

      const response = await fetch('/api/cleanup/projects', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        alert(`✅ S'han eliminat ${data.deleted} projectes correctament!`);
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error en neteja:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Error desconegut'
      });
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Error desconegut'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Mostrar indicador de càrrega mentre verifica autenticació
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificant autenticació...</p>
        </div>
      </div>
    );
  }

  // Mostrar missatge si no està autenticat
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">🔒 Accés Restringit</h2>
          <p className="text-gray-700 mb-4">
            Has d'estar autenticat per accedir a aquesta pàgina d'administració.
          </p>
          {user && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
              <p className="text-sm text-blue-700">
                <strong>Debug:</strong> User ID detectat: {user.id}
              </p>
            </div>
          )}
          <button
            onClick={() => router.push('/plantilles')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Anar a Plantilles
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🧹 Neteja d'Administració
          </h1>
          
          <div className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-yellow-800 mb-2">
                ⚠️ Atenció
              </h2>
              <p className="text-yellow-700">
                Aquestes accions eliminaran permanentment les dades de la base de dades i del storage. 
                Assegura't que realment vols fer neteja abans de continuar.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Neteja de Plantilles */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-red-800 mb-4">
                  🗂️ Eliminar Totes les Plantilles
                </h3>
                <p className="text-red-700 mb-4">
                  Elimina totes les plantilles de la base de dades i els seus fitxers del storage.
                </p>
                <button
                  onClick={handleCleanupTemplates}
                  disabled={isLoading}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  {isLoading ? '🔄 Eliminant...' : '🗑️ Eliminar Totes les Plantilles'}
                </button>
              </div>

              {/* Neteja de Projectes */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-orange-800 mb-4">
                  📊 Eliminar Tots els Projectes
                </h3>
                <p className="text-orange-700 mb-4">
                  Elimina tots els projectes d'informes de la base de dades.
                </p>
                <button
                  onClick={handleCleanupProjects}
                  disabled={isLoading}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  {isLoading ? '🔄 Eliminant...' : '🗑️ Eliminar Tots els Projectes'}
                </button>
              </div>
            </div>

            {/* Navegació */}
            <div className="flex gap-4">
              <button
                onClick={() => router.push('/plantilles')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                ← Tornar a Plantilles
              </button>
              <button
                onClick={() => router.push('/informes')}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                ← Tornar a Informes
              </button>
            </div>

            {/* Resultat */}
            {result && (
              <div className={`rounded-lg p-4 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <h3 className={`font-semibold mb-2 ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                  {result.success ? '✅ Èxit' : '❌ Error'}
                </h3>
                <pre className={`text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
