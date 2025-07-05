'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Template {
  id: string;
  config_name: string;
  base_docx_name: string | null;
  excel_file_name: string | null;
  created_at: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Verificar autenticació
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { createBrowserSupabaseClient } = await import('@/lib/supabase/browserClient');
        const supabase = createBrowserSupabaseClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        setUser(user);
        console.log('Usuari autenticat:', user?.id, user?.email);
      } catch (err) {
        console.error('Error verificant autenticació:', err);
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, []);
  
  // Funció per debug eliminació
  const handleDebugDelete = async (templateId: string) => {
    try {
      const { createBrowserSupabaseClient } = await import('@/lib/supabase/browserClient');
      const supabase = createBrowserSupabaseClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('No autenticat');
      }

      const response = await fetch(`/api/debug/test-delete-template/${templateId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      setDebugInfo(result);
      console.log('Debug info:', result);
    } catch (err) {
      console.error('Error debug:', err);
      setDebugInfo({ error: err instanceof Error ? err.message : 'Error desconegut' });
    }
  };

  // Funció per eliminar plantilla
  const handleDeleteTemplate = async (templateId: string) => {
    setDeletingTemplateId(templateId);
    try {
      const { createBrowserSupabaseClient } = await import('@/lib/supabase/browserClient');
      const supabase = createBrowserSupabaseClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('No autenticat');
      }

      const response = await fetch(`/api/delete-template/${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error eliminant plantilla');
      }

      // Actualitzar la llista de plantilles
      setTemplates(templates.filter(t => t.id !== templateId));
      setShowDeleteModal(null);
    } catch (err) {
      console.error('Error eliminant plantilla:', err);
      alert(`Error eliminant plantilla: ${err instanceof Error ? err.message : 'Error desconegut'}`);
    } finally {
      setDeletingTemplateId(null);
    }
  };

  // Carregar plantilles
  useEffect(() => {
    const fetchTemplates = async () => {
      setIsLoading(true);
      try {
        // Obtenir el token JWT de Supabase (browser client)
        const { createBrowserSupabaseClient } = await import('@/lib/supabase/browserClient');
        const supabase = createBrowserSupabaseClient();
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('Resultat de getSession():', session, 'Error:', sessionError);
        if (sessionError || !session) {
          console.error('No autenticat. Torna a iniciar sessió.');
          throw new Error('No autenticat. Torna a iniciar sessió.');
        }
        const accessToken = session.access_token;
        console.log('accessToken obtingut:', accessToken);
        // LOG DEL USER_ID AUTENTICAT
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          console.warn('No s’ha pogut obtenir el user_id autenticat:', userError);
        } else {
          console.log('user_id autenticat (frontend):', userData.user.id);
        }
        // Log de l'objecte headers
        const headers = {
          Authorization: `Bearer ${accessToken}`,
        };
        console.log('Headers passats al fetch:', headers);
        // Fer fetch passant el token al header Authorization
        const response = await fetch(
          `/api/get-templates${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ''}`,
          {
            headers,
          }
        );
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        setTemplates(data.templates);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconegut');
        console.error('Error carregant plantilles:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplates();
  }, [searchTerm]);
  
  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 bg-gray-100">
      <div className="w-full max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">Les Meves Plantilles</h1>
          <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Nova Plantilla
          </Link>
        </div>
        
        {/* Cercador */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Cerca per nom..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        
        {/* Estat de càrrega */}
        {isLoading && <p className="text-center py-8 text-gray-500">Carregant plantilles...</p>}
        
        {/* Error */}
        {error && <p className="text-center py-8 text-red-500">Error: {error}</p>}
        
        {/* Llista de plantilles */}
        {!isLoading && !error && templates.length === 0 && (
          <p className="text-center py-8 text-gray-500">No s'han trobat plantilles.</p>
        )}
        
        {!isLoading && !error && templates.length > 0 && (
          <div className="grid gap-4">
            {templates.map((template, idx) => {
              console.log('DEBUG plantilla:', idx, template);
              return (
                <div key={template.id} className="bg-white p-4 rounded shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-lg font-medium text-gray-800">
                        {typeof template.config_name === 'string' ? template.config_name : JSON.stringify(template.config_name)}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {template.base_docx_name && `DOCX: ${typeof template.base_docx_name === 'string' ? template.base_docx_name : JSON.stringify(template.base_docx_name)}`}
                        {template.excel_file_name && ` | Excel: ${typeof template.excel_file_name === 'string' ? template.excel_file_name : JSON.stringify(template.excel_file_name)}`}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Creat: {template.created_at ? new Date(template.created_at).toLocaleDateString() : 'Data invàlida'}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Link
                        href={`/plantilles/${template.id}`}
                        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        Detalls
                      </Link>
                      <Link
                        href={`/plantilles/editar/${template.id}`}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Editar
                      </Link>
                      <button
                        onClick={() => handleDebugDelete(template.id)}
                        className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 flex items-center mr-2"
                        title="Debug eliminació"
                      >
                        🔍
                      </button>
                      <button
                        onClick={() => setShowDeleteModal(template.id)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center"
                        title="Eliminar plantilla"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Estat d'autenticació */}
        {!authLoading && (
          <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
            <h3 className="font-bold mb-2 text-blue-800">Estat d'autenticació:</h3>
            {user ? (
              <div className="text-sm text-blue-700">
                ✅ Autenticat com: <strong>{user.email}</strong> (ID: {user.id})
              </div>
            ) : (
              <div className="text-sm text-red-700">
                ❌ No autenticat. <strong>Fes clic a "Inicia sessió" a la barra superior per autenticar-te.</strong>
              </div>
            )}
          </div>
        )}

        {/* Debug info */}
        {debugInfo && (
          <div className="mt-6 p-4 bg-gray-100 rounded">
            <h3 className="font-bold mb-2">Debug Info:</h3>
            <pre className="text-xs overflow-auto">{JSON.stringify(debugInfo, null, 2)}</pre>
            <button 
              onClick={() => setDebugInfo(null)}
              className="mt-2 px-2 py-1 bg-gray-500 text-white rounded text-xs"
            >
              Tancar
            </button>
          </div>
        )}

        {/* Modal de confirmació d'eliminació */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center mb-4">
                <svg className="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900">Eliminar Plantilla</h3>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                Estàs segur que vols eliminar la plantilla <strong>"{templates.find(t => t.id === showDeleteModal)?.config_name}"</strong>? 
                Aquesta acció no es pot desfer.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteModal(null)}
                  disabled={deletingTemplateId === showDeleteModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel·lar
                </button>
                <button
                  onClick={() => handleDeleteTemplate(showDeleteModal)}
                  disabled={deletingTemplateId === showDeleteModal}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center"
                >
                  {deletingTemplateId === showDeleteModal ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Eliminant...
                    </>
                  ) : (
                    'Eliminar'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
